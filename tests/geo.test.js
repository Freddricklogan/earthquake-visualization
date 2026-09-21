import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEPTH_BINS, depthColour, filterEvents, isFresh, magnitudeRadius, median, parseFeed, perDay, summarize, toEvent, topEvents } from '../src/geo.js';

const snapshot = JSON.parse(readFileSync(new URL('../data/usgs-2.5-week-snapshot.geojson', import.meta.url), 'utf8'));

describe('scales', () => {
  it('colours by depth bin edges', () => {
    expect(depthColour(-2)).toBe('#98ee00');
    expect(depthColour(10)).toBe('#d4ee00');
    expect(depthColour(29.9)).toBe('#d4ee00');
    expect(depthColour(90)).toBe('#ea2c2c');
    expect(depthColour(600)).toBe('#ea2c2c');
    expect(DEPTH_BINS).toHaveLength(6);
  });
  it('radius grows with magnitude and floors at 3', () => {
    expect(magnitudeRadius(-1)).toBe(3);
    expect(magnitudeRadius(0)).toBe(3);
    expect(magnitudeRadius(2)).toBe(6);
    expect(magnitudeRadius(7)).toBe(46);
    expect(magnitudeRadius(7, 2)).toBe(17); // scaled to 3/8 at zoom 2
    expect(magnitudeRadius(7, 0)).toBe(16); // floor of the scale at 0.35
    expect(magnitudeRadius(undefined)).toBe(3);
  });
});

describe('toEvent / parseFeed', () => {
  it('normalises a feature and rejects malformed ones', () => {
    const f = { id: 'x', geometry: { coordinates: [-120.5, 36.1, 8.2] }, properties: { mag: 3.4, time: 1700000000000, place: 'Somewhere', url: 'https://example.invalid', tsunami: 0 } };
    expect(toEvent(f)).toEqual({ id: 'x', lon: -120.5, lat: 36.1, depth: 8.2, mag: 3.4, time: 1700000000000, place: 'Somewhere', url: 'https://example.invalid', tsunami: false });
    expect(toEvent({ geometry: { coordinates: [1, 2] }, properties: { mag: 1, time: 1 } })).toBeNull();
    expect(toEvent({ geometry: { coordinates: [1, 2, 3] }, properties: { mag: null, time: 1 } })).toBeNull();
    expect(toEvent({ geometry: { coordinates: [1, 2, 3] }, properties: { mag: 1 } })).toBeNull();
    expect(toEvent(null)).toBeNull();
  });
  it('parses the committed USGS snapshot and counts dropped features', () => {
    const feed = parseFeed(snapshot);
    expect(feed.events.length + feed.dropped).toBe(snapshot.features.length);
    expect(feed.events.length).toBeGreaterThan(100);
    expect(feed.title).toMatch(/Magnitude 2.5\+/);
    expect(Math.min(...feed.events.map((e) => e.mag))).toBeGreaterThanOrEqual(2.4); // feed is M2.5+ before revisions
    expect(() => parseFeed({ type: 'Feature' })).toThrow(/FeatureCollection/);
  });
});

describe('filters and summaries', () => {
  const now = 1_000_000_000_000;
  const ev = (mag, hoursAgo, depth = 10) => ({ id: `${mag}-${hoursAgo}`, lon: 0, lat: 0, depth, mag, time: now - hoursAgo * 3600e3, place: 'p', url: '', tsunami: false });
  const events = [ev(1, 1), ev(3, 30), ev(5, 100), ev(6.5, 200, 120), ev(2.6, 2, 45)];
  it('filters by magnitude, window and depth', () => {
    expect(filterEvents(events, { minMag: 2.5, hours: 24, now }).map((e) => e.mag)).toEqual([2.6]);
    expect(filterEvents(events, { hours: 24 * 7, now })).toHaveLength(4); // the 200-hour-old event is outside the week
    expect(filterEvents(events, { hours: 24 * 10, now, maxDepth: 70 })).toHaveLength(4);
  });
  it('summarises counts, strongest, median depth and bins', () => {
    const s = summarize(events);
    expect(s.count).toBe(5);
    expect(s.maxMag).toBe(6.5);
    expect(s.strongest.id).toBe('6.5-200');
    expect(s.medianDepth).toBe(10);
    expect(s.magBins).toEqual({ '< 2.5': 1, '2.5–4.4': 2, '4.5–5.9': 1, '6+': 1 });
    expect(s.depthBins.map((b) => b.count)).toEqual([0, 3, 1, 0, 0, 1]); // 10 km falls in the 10–30 bin, matching depthColour
    expect(summarize([]).count).toBe(0);
    expect(median([3, 1, 2, 4])).toBe(2.5);
    expect(median([])).toBeNaN();
  });
  it('orders top events by magnitude then recency and counts per day', () => {
    expect(topEvents(events, 2).map((e) => e.mag)).toEqual([6.5, 5]);
    const days = perDay(events);
    expect(days.reduce((s, d) => s + d.count, 0)).toBe(5);
    expect(days.map((d) => d.day)).toEqual([...days.map((d) => d.day)].sort());
  });
  it('cache freshness window', () => {
    expect(isFresh(now - 1000, now)).toBe(true);
    expect(isFresh(now - 16 * 60e3, now)).toBe(false);
    expect(isFresh(now + 1000, now)).toBe(false);
    expect(isFresh(NaN, now)).toBe(false);
  });
});
