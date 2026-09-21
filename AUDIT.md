# AUDIT — Global Earthquake Visualization (pre-refactor)

Audit of the previous build: `index.html` (57 lines), `logic.js` (273
lines), `style.css`, three CDN scripts. The map worked when USGS and the
tile servers answered; the findings are about what happened when they did
not, what a strict policy could not run, and what nobody could test.

---

## A. Correctness and resilience

### A1 — The "backup data" pointed at a branch that does not exist
`logic.js:140` fetched `…/earthquake-visualization/backup-data/backup_earthquakes.json`;
that branch returns 404, so the Retry/Backup dialog's second button could
never succeed and ended in `alert()` (`logic.js:155`). **Fix:** a dated
snapshot of the USGS M2.5+ week feed is committed at
`data/usgs-2.5-week-snapshot.geojson` and loaded automatically when the
live fetch fails or times out; the status line names the source and the
feed's own generation time.

### A2 — The default basemap now renders "API KEY REQUIRED"
`logic.js:14` used CARTO's `dark_all` tiles, which are no longer served
without a key: every tile carries the watermark. **Fix:** Esri's Dark Gray
canvas (no key, attribution required) is the default; Street, Topographic
and Satellite remain. The CSP `img-src` lists exactly those hosts.

### A3 — Every fetch was on the main thread with no cache and no timeout
`d3.json` (`logic.js:106`) pulled ~1.2 MB on every load, and a slow USGS
response froze the page. **Fix:** `src/worker.js` fetches and parses in a
module Web Worker with a 15-second timeout; the parsed feed is cached in
`localStorage` for 15 minutes (`isFresh()` is tested); "Refresh from USGS"
clears it.

### A4 — Legend added on every data load
`logic.js:205–222` created and added a new legend control inside
`processEarthquakes`, so each Retry stacked another legend. **Fix:** one
legend, created once in `createMap()`.

### A5 — No clustering, so a week of ~2,000 events drew ~2,000 overlapping circles
`logic.js:165` sized markers as `magnitude * 4` with no aggregation.
**Fix:** `src/cluster.js` buckets events into a tile-space grid below zoom
7 (pure, tested for conservation of counts and centroid arithmetic);
marker radius also scales with zoom so a M6 no longer covers a country.

## B. Security and policy

### B1 — No Content-Security-Policy; unpinned CDN scripts without integrity
Leaflet, leaflet.heat and D3 from unpkg and d3js.org (`index.html:12,52–54`)
with no `integrity`. **Fix:** Leaflet 1.9.4 and leaflet.heat 0.2.0 pinned on
jsDelivr with SRI hashes computed from the downloaded artifacts and vendored
copies; D3 removed (it was only used for `d3.json`); strict CSP with
`connect-src` limited to USGS and `worker-src 'self'`.

### B2 — Feed fields interpolated into HTML
`logic.js:191` built popups with a template literal containing
`feature.properties.place`, and lines 64 and 76 used `innerHTML` for the
loader and error dialog. USGS is a trusted source, but the pattern is the
same one that becomes XSS the day the source changes. **Fix:** popups,
table rows and the legend are built with `textContent`.

## C. Structure, accessibility and honesty

### C1 — Global mutable state, nothing testable
`window.earthquakeData` (`logic.js:112`), module-level `let` layers, and
all logic inside callbacks. **Fix:** `src/{geo,cluster,format}.js` are pure
and covered by 12 tests including the committed snapshot; the DOM layer is
`src/map.js` and `src/main.js`.

### C2 — The map was the only way in
No text alternative: keyboard and screen-reader users had a `<div id="map">`.
**Fix:** a table of the strongest shown events with a "Show" button per
row that pans and opens the popup; cluster markers are keyboard-focusable
with a title; the status line is `aria-live`; filters are labelled controls.

### C3 — "Real-time" copy with no statement of freshness
The header said "Live seismic activity" without saying when the feed was
generated or whether the page was showing cached data. **Fix:** the status
line and the Feed-age KPI show the feed's `metadata.generated` timestamp
and the source (live, cached, snapshot).
