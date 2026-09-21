/** Pure helpers over USGS GeoJSON features: validation, scales, filters, summaries. */

export const DEPTH_BINS = [
  { min: -Infinity, max: 10, colour: '#98ee00', label: '< 10' },
  { min: 10, max: 30, colour: '#d4ee00', label: '10–30' },
  { min: 30, max: 50, colour: '#eecc00', label: '30–50' },
  { min: 50, max: 70, colour: '#ee9c00', label: '50–70' },
  { min: 70, max: 90, colour: '#ea822c', label: '70–90' },
  { min: 90, max: Infinity, colour: '#ea2c2c', label: '90+' }
];

export function depthColour(depthKm) {
  for (const b of DEPTH_BINS) if (depthKm < b.max) return b.colour;
  return DEPTH_BINS[DEPTH_BINS.length - 1].colour;
}

/**
 * Marker radius in px: magnitude is logarithmic energy, so radius grows faster than linearly
 * but stays bounded; at low zoom the whole scale shrinks so a M6 does not cover a country.
 */
export function magnitudeRadius(mag, zoom = 7) {
  const m = Math.max(0, mag ?? 0);
  const scale = Math.min(1, Math.max(0.35, (zoom + 1) / 8));
  return Math.max(3, Math.round((2 + m * m * 0.9) * scale));
}

/**
 * Normalises a USGS feature into a flat record. Returns null for features
 * missing coordinates, a numeric magnitude or a time — they are counted, not
 * silently dropped, by `parseFeed`.
 */
export function toEvent(feature) {
  const c = feature?.geometry?.coordinates;
  const p = feature?.properties;
  if (!Array.isArray(c) || c.length < 3 || !p) return null;
  const [lon, lat, depth] = c;
  const mag = typeof p.mag === 'number' ? p.mag : NaN;
  if (!Number.isFinite(lon) || !Number.isFinite(lat) || !Number.isFinite(depth) || !Number.isFinite(mag) || !Number.isFinite(p.time)) return null;
  return { id: feature.id ?? `${lon},${lat},${p.time}`, lon, lat, depth, mag, time: p.time, place: String(p.place ?? 'unknown location'), url: typeof p.url === 'string' ? p.url : '', tsunami: p.tsunami === 1 };
}

export function parseFeed(geojson) {
  if (!geojson || geojson.type !== 'FeatureCollection' || !Array.isArray(geojson.features)) throw new Error('not a GeoJSON FeatureCollection');
  const events = [];
  let dropped = 0;
  for (const f of geojson.features) {
    const e = toEvent(f);
    if (e) events.push(e);
    else dropped += 1;
  }
  return { events, dropped, generated: geojson.metadata?.generated ?? null, title: geojson.metadata?.title ?? '' };
}

export function filterEvents(events, { minMag = 0, hours = 24 * 7, now = Date.now(), maxDepth = Infinity } = {}) {
  const since = now - hours * 3600 * 1000;
  return events.filter((e) => e.mag >= minMag && e.time >= since && e.depth <= maxDepth);
}

export function median(xs) {
  if (xs.length === 0) return NaN;
  const s = Float64Array.from(xs).sort();
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function summarize(events) {
  if (events.length === 0) return { count: 0, maxMag: NaN, strongest: null, medianDepth: NaN, magBins: {}, depthBins: DEPTH_BINS.map((b) => ({ label: b.label, colour: b.colour, count: 0 })), perDay: [] };
  let strongest = events[0];
  const magBins = { '< 2.5': 0, '2.5–4.4': 0, '4.5–5.9': 0, '6+': 0 };
  const depthBins = DEPTH_BINS.map((b) => ({ label: b.label, colour: b.colour, count: 0 }));
  for (const e of events) {
    if (e.mag > strongest.mag) strongest = e;
    if (e.mag < 2.5) magBins['< 2.5'] += 1;
    else if (e.mag < 4.5) magBins['2.5–4.4'] += 1;
    else if (e.mag < 6) magBins['4.5–5.9'] += 1;
    else magBins['6+'] += 1;
    depthBins[DEPTH_BINS.findIndex((b) => e.depth < b.max)].count += 1;
  }
  return { count: events.length, maxMag: strongest.mag, strongest, medianDepth: median(events.map((e) => e.depth)), magBins, depthBins, perDay: perDay(events) };
}

/** Events per UTC day, oldest first. */
export function perDay(events) {
  const by = new Map();
  for (const e of events) {
    const day = new Date(e.time).toISOString().slice(0, 10);
    by.set(day, (by.get(day) ?? 0) + 1);
  }
  return [...by.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([day, count]) => ({ day, count }));
}

export function topEvents(events, n = 10) {
  return [...events].sort((a, b) => b.mag - a.mag || b.time - a.time).slice(0, n);
}

/** Cache policy for the live feed: a stored copy is fresh for `ttlMs`. */
export function isFresh(storedAt, now, ttlMs = 15 * 60 * 1000) {
  return Number.isFinite(storedAt) && now - storedAt >= 0 && now - storedAt < ttlMs;
}
