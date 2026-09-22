/** Loads the feed (live, cached, or the committed snapshot), filters it, and drives the map, the table and the Executive Shell. */
import { mountExecShell } from './exec-shell.js';
import { ago, mag, utc } from './format.js';
import { filterEvents, isFresh, parseFeed, summarize, topEvents } from './geo.js';
import { createMap, loadLeaflet } from './map.js';

const FEED = 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson';
const SNAPSHOT = 'data/usgs-2.5-week-snapshot.geojson';
const PLATES = 'data/PB2002_boundaries.json';
const CACHE_KEY = 'eq:feed:all_week';
const $ = (id) => document.getElementById(id);

const state = { source: 'loading', feed: null, fetchedAt: null, filtered: [], summary: null, view: null };
let shell;

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw);
    return isFresh(c.fetchedAt, Date.now()) ? c : null;
  } catch {
    return null;
  }
}
function writeCache(feed, fetchedAt) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ feed, fetchedAt }));
  } catch {
    /* storage unavailable or full: the live copy still renders */
  }
}

function fetchViaWorker(url) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    } catch (err) {
      reject(err);
      return;
    }
    const timer = setTimeout(() => {
      worker.terminate();
      reject(new Error('USGS feed timed out after 15 s'));
    }, 15000);
    worker.onmessage = (e) => {
      clearTimeout(timer);
      worker.terminate();
      if (e.data.error) reject(new Error(e.data.error));
      else resolve(e.data);
    };
    worker.onerror = (e) => {
      clearTimeout(timer);
      worker.terminate();
      reject(new Error(e.message || 'worker failed'));
    };
    worker.postMessage({ id: 1, url });
  });
}

async function loadFeed() {
  const cached = readCache();
  if (cached) {
    state.feed = cached.feed;
    state.fetchedAt = cached.fetchedAt;
    state.source = 'live (cached)';
    return;
  }
  try {
    const { feed, fetchedAt } = await fetchViaWorker(FEED);
    state.feed = feed;
    state.fetchedAt = fetchedAt;
    state.source = 'live';
    writeCache(feed, fetchedAt);
  } catch (err) {
    const res = await fetch(SNAPSHOT);
    state.feed = parseFeed(await res.json());
    state.fetchedAt = state.feed.generated;
    state.source = `snapshot (live feed unavailable: ${err.message})`;
  }
}

function currentFilter() {
  return { minMag: parseFloat($('min-mag').value), hours: parseInt($('window').value, 10), maxDepth: parseFloat($('max-depth').value) || Infinity, now: Date.now() };
}

function render() {
  const f = currentFilter();
  state.filtered = filterEvents(state.feed.events, f);
  state.summary = summarize(state.filtered);
  state.view.setEvents(state.filtered);
  $('min-mag-out').textContent = f.minMag.toFixed(1);
  const s = state.summary;
  $('status').textContent = `${s.count.toLocaleString()} of ${state.feed.events.length.toLocaleString()} events shown · source: ${state.source} · feed generated ${state.feed.generated ? utc(state.feed.generated) : 'unknown'} (${state.feed.generated ? ago(state.feed.generated) : '—'})${state.feed.dropped ? ` · ${state.feed.dropped} malformed features dropped` : ''}`;
  const tbody = $('top-tbody');
  tbody.replaceChildren();
  for (const e of topEvents(state.filtered, 12)) {
    const tr = document.createElement('tr');
    const cells = [mag(e.mag), e.place, `${e.depth.toFixed(0)} km`, utc(e.time)];
    for (const c of cells) {
      const td = document.createElement('td');
      td.textContent = c;
      tr.append(td);
    }
    const td = document.createElement('td');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn btn--small';
    b.textContent = 'Show';
    b.setAttribute('aria-label', `Show ${mag(e.mag)} ${e.place} on the map`);
    b.addEventListener('click', () => state.view.focus(e));
    td.append(b);
    tr.append(td);
    tbody.append(tr);
  }
  const bins = $('depth-bins');
  bins.replaceChildren();
  for (const b of s.depthBins) {
    const li = document.createElement('li');
    const sw = document.createElement('i');
    sw.className = 'legend__swatch';
    sw.style.setProperty('background', b.colour);
    li.append(sw, document.createTextNode(`${b.label} km: ${b.count}`));
    bins.append(li);
  }
  $('mag-bins').textContent = Object.entries(s.magBins).map(([k, v]) => `${k}: ${v}`).join(' · ');
  shell?.refreshKpis();
}

async function boot() {
  const L = loadLeaflet();
  if (!L) {
    $('status').textContent = 'Leaflet failed to load; the table below still works.';
  }
  await loadFeed();
  if (L) {
    state.view = createMap(L, 'map');
    fetch(PLATES).then((r) => r.json()).then((g) => state.view.setPlates(g)).catch(() => {});
  } else {
    state.view = { setEvents() {}, toggleHeat() {}, togglePlates() {}, focus() {}, setZoom() {} };
  }
  for (const id of ['min-mag', 'window', 'max-depth']) $(id).addEventListener('input', render);
  $('heat').addEventListener('change', (e) => state.view.toggleHeat(e.target.checked));
  $('plates').addEventListener('change', (e) => state.view.togglePlates(e.target.checked));
  $('refresh').addEventListener('click', async () => {
    localStorage.removeItem(CACHE_KEY);
    $('status').textContent = 'Refreshing from USGS…';
    await loadFeed();
    render();
  });
  render();

  shell = mountExecShell({
  theme: 'signal',
    title: 'Global Earthquake Visualization',
    tagline: 'Live USGS feed for the past seven days, fetched in a Web Worker and cached for fifteen minutes; grid clustering, depth-coloured markers, a heat layer, plate boundaries, and a keyboard-reachable table of the strongest events. A dated snapshot is the fallback.',
    repo: 'https://github.com/Freddricklogan/earthquake-visualization',
    pagesUrl: 'https://freddricklogan.github.io/earthquake-visualization/',
    badges: [{ label: 'USGS live feed', tone: 'accent' }, { label: 'Web Worker + cache', dot: true }, { label: 'Clustered', dot: true }],
    kpis: [
      { label: 'Events shown', compute: () => state.summary?.count.toLocaleString() ?? '—', tone: 'accent' },
      { label: 'Strongest', compute: () => (state.summary?.strongest ? `${mag(state.summary.strongest.mag)} ${state.summary.strongest.place}` : '—'), tone: 'danger' },
      { label: 'Median depth', compute: () => (state.summary && Number.isFinite(state.summary.medianDepth) ? `${state.summary.medianDepth.toFixed(0)} km` : '—') },
      { label: 'M 4.5+', compute: () => (state.summary ? state.summary.magBins['4.5–5.9'] + state.summary.magBins['6+'] : '—'), tone: 'warn' },
      { label: 'Feed age', compute: () => (state.feed?.generated ? ago(state.feed.generated) : '—'), tone: 'muted' }
    ],
    tour: [
      { selector: '#map', title: 'A week of earthquakes, clustered', body: 'At low zoom nearby events merge into count bubbles (grid clustering in tile space, tested for conservation). Click a bubble to zoom in.', action: () => state.view.setZoom(2) },
      { selector: '#filters', title: 'Filter to what matters', body: 'Raise the magnitude floor to 4.5 and the map keeps only the events a seismologist would call notable; the KPI strip and the table follow.', action: () => { $('min-mag').value = '4.5'; render(); } },
      { selector: '#layers', title: 'Heat and plate boundaries', body: 'The heat layer weights by magnitude; plate boundaries (Bird 2003) show why the clusters sit where they do.', action: () => { $('heat').checked = true; $('plates').checked = true; state.view.toggleHeat(true); state.view.togglePlates(true); } },
      { selector: '#top-table', title: 'Strongest events, reachable by keyboard', body: 'Every row has a Show button that pans the map and opens the popup — the map is not the only way in.', action: () => { const b = document.querySelector('#top-tbody button'); if (b) b.click(); } },
      { selector: '#status', title: 'Where the data came from', body: 'Live, cached, or the committed snapshot — the status line always says which, with the feed’s own generation time.', action: () => {} }
    ]
  });
  shell.refreshKpis();
}

boot();
