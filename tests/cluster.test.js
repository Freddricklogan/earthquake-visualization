import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { clusterEvents, project, shouldCluster } from '../src/cluster.js';
import { parseFeed } from '../src/geo.js';

const events = parseFeed(JSON.parse(readFileSync(new URL('../data/usgs-2.5-week-snapshot.geojson', import.meta.url), 'utf8'))).events;

describe('project', () => {
  it('maps the origin to the centre and clamps latitude', () => {
    expect(project(0, 0, 0)).toEqual({ x: 128, y: 128 });
    expect(project(-180, 0, 1).x).toBe(0);
    expect(project(0, 89, 0).y).toBeCloseTo(project(0, 85.05, 0).y, 9);
  });
});

describe('clusterEvents', () => {
  it('conserves events, merges at low zoom and separates at high zoom', () => {
    const low = clusterEvents(events, 2);
    const high = clusterEvents(events, 12);
    expect(low.reduce((s, c) => s + c.count, 0)).toBe(events.length);
    expect(high.reduce((s, c) => s + c.count, 0)).toBe(events.length);
    expect(low.length).toBeLessThan(high.length);
    expect(high.length).toBeGreaterThan(events.length * 0.8);
    for (const c of low) {
      expect(c.events).toHaveLength(c.count);
      expect(c.strongest.mag).toBe(Math.max(...c.events.map((e) => e.mag)));
      expect(c.lat).toBeCloseTo(c.events.reduce((s, e) => s + e.lat, 0) / c.count, 9);
    }
  });
  it('is deterministic and respects the zoom threshold', () => {
    expect(clusterEvents(events, 3)).toEqual(clusterEvents(events, 3));
    expect(shouldCluster(6)).toBe(true);
    expect(shouldCluster(7)).toBe(false);
    expect(clusterEvents([], 3)).toEqual([]);
  });
});
