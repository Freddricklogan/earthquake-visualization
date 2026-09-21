/**
 * Grid clustering in Web-Mercator tile space: at zoom z the world is 2^z × 256 px;
 * points are bucketed into cells of `cellPx` and each cell becomes one cluster
 * with a centroid, a count and the strongest event. Pure and deterministic.
 */

export function project(lon, lat, zoom) {
  const scale = 256 * 2 ** zoom;
  const x = ((lon + 180) / 360) * scale;
  const s = Math.sin((Math.max(-85.05, Math.min(85.05, lat)) * Math.PI) / 180);
  const y = (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function clusterEvents(events, zoom, cellPx = 48) {
  const cells = new Map();
  for (const e of events) {
    const { x, y } = project(e.lon, e.lat, zoom);
    const key = `${Math.floor(x / cellPx)}:${Math.floor(y / cellPx)}`;
    let c = cells.get(key);
    if (!c) {
      c = { key, count: 0, sumLat: 0, sumLon: 0, strongest: e, events: [] };
      cells.set(key, c);
    }
    c.count += 1;
    c.sumLat += e.lat;
    c.sumLon += e.lon;
    c.events.push(e);
    if (e.mag > c.strongest.mag) c.strongest = e;
  }
  return [...cells.values()].map((c) => ({ key: c.key, count: c.count, lat: c.sumLat / c.count, lon: c.sumLon / c.count, strongest: c.strongest, events: c.events }));
}

/** Clusters of one event render as the event itself; the threshold zoom is where clustering stops. */
export function shouldCluster(zoom, threshold = 7) {
  return zoom < threshold;
}
