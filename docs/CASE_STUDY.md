# Case Study — Global Earthquake Visualization

**Repository:** [earthquake-visualization](https://github.com/Freddricklogan/earthquake-visualization) · **Live demo:** [freddricklogan.github.io/earthquake-visualization](https://freddricklogan.github.io/earthquake-visualization/) · **Author:** Freddrick Logan

---

## 1. Who has this problem

Anyone who puts a live public feed on a page and lets others rely on it: an emergency-management office with a wall display, a geoscience instructor projecting the week's events, students who copy the pattern, and the technologist — my job at Illinois Tech and in consulting — asked why the map is blank this morning. The map is fine the day it is built; the question is what it does when the feed is slow, the tile provider changes its terms, or the room has no mouse.

## 2. The problem, as a scenario

An instructor opens the map before a lecture on plate tectonics. Every tile says "API KEY REQUIRED": the basemap provider changed its terms months ago and nobody visited since. The feed loads slowly and the page freezes while two thousand overlapping circles draw on the main thread. A student who navigates by keyboard asks how to reach an event; there is no way. When the feed fails, the error dialog offers "backup data" pointing at a branch that does not exist. The previous version of this page was that map. I wrote it; its audit is in the repository.

## 3. What it costs to leave it alone

A lecture without its centrepiece, a wall display showing a watermark, a student excluded from the exercise, a pattern copied into other projects. I will not attach a figure — this is a teaching page, not an operational system. Each failure was foreseeable: providers change terms, feeds slow down, and a map without a text alternative fails part of any room.

## 4. The approach, and the alternative I rejected

I rebuilt the page around a source chain that names itself. The USGS seven-day feed is fetched in a Web Worker with a fifteen-second timeout, cached in the browser for fifteen minutes, and replaced by a dated snapshot committed to the repository when the live fetch fails; the status line and a KPI say which of the three is on screen and when the feed was generated. Events are clustered below zoom 7 by a pure, conservation-tested grid clusterer, so a week reads as count bubbles instead of a smear. Markers are coloured by depth and sized by magnitude with a zoom-aware scale. Filters for magnitude, window and depth drive the map, the KPI strip and a table of the strongest events whose Show buttons pan and open the popup — the map is not the only way in. The default basemap needs no key, libraries are pinned with integrity hashes, and no feed field is interpolated into HTML.

The alternative I rejected was a marker-cluster plugin and a third-party "live map" component. Both add dependencies I cannot test; neither addresses what mattered: the source chain, accessibility, the terms change.

## 5. What the code does today

Real: a live USGS fetch in a module worker; cache policy as a pure function; the committed snapshot fallback; GeoJSON normalisation with rejection counts; magnitude, window and depth filters; summaries by depth and magnitude bin, median depth and events per day; Web-Mercator grid clustering; a heat layer and plate boundaries; four basemaps; popups and a table built with `textContent`; the Executive Shell with KPIs from the live summary.

Simulated: nothing. The events are the USGS feed or its committed snapshot, and the page states which; the heat layer's magnitude weighting is a visual convention, not a physical quantity.

Worth knowing: clustering is a grid, not distance-based, so membership shifts at cell boundaries as you pan; the fallback snapshot is the M2.5+ feed, smaller than the live "all" feed, and the status line says so when in use.

## 6. Evidence

Measured locally with the commands CI runs: 12 tests passing across three files; 97.82% statement and 90.47% branch coverage of the pure modules; ESLint and html-validate clean. Tests cover depth-bin edges, the zoom-scaled radius, feature normalisation with rejection, parsing the committed snapshot of 346 features, the three filters, summaries on a hand-built set, the cache window, projection and latitude clamping, cluster conservation at zoom 2 and 12, and the formatting helpers. Headless Chrome on 2026-09-21: zero console errors; the live feed returned 1,878 events, 1,798 in the seven-day window, strongest M 6.5 near Nikolski, Alaska; 41 clusters at zoom 2; the 4.5 filter left 112 events; heat and plate layers toggled; the table's Show button opened the popup; five tour steps; no horizontal scroll at 1280 or 400 pixels. Those counts are what the feed held that day.

## 7. What it would take to run this in production

As a public teaching page it is production now. As an operational display it would need a server-side fetch with its own cache so a hundred screens do not each hit USGS, alerting on feed age, a Service Worker for offline use, a tile provider under contract rather than public terms, and a contrast review of the depth scale on the chosen basemap. Days of work; the source chain and accessibility carry over.

## 8. Limits and next steps

Grid clustering with boundary effects, one week of history, no time animation, a decorative heat layer, no per-region statistics. Next: a time slider that replays the week, distance-based clustering compared against the grid in tests, a per-plate-boundary count, and a CSV of the filtered events.

## 9. Who should look at this

**Hiring manager:** evidence that I design for the day the feed fails and the reader has no mouse, and audit my own earlier work in writing.
**Consulting client:** a reference for any page that depends on a public feed — source chain, freshness on screen, pinned dependencies, keyboard access.
**Engineer:** read `src/cluster.js` and `tests/cluster.test.js` for the grid clusterer and its conservation tests, and `src/main.js` for the source chain.
