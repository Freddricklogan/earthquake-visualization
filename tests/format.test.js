import { describe, expect, it } from 'vitest';
import { ago, mag, utc } from '../src/format.js';

describe('format', () => {
  it('relative and absolute times, magnitude label', () => {
    const now = 1_700_000_000_000;
    expect(ago(now - 30e3, now)).toBe('30s ago');
    expect(ago(now - 5 * 60e3, now)).toBe('5 min ago');
    expect(ago(now - 3 * 3600e3, now)).toBe('3 h ago');
    expect(ago(now - 72 * 3600e3, now)).toBe('3 d ago');
    expect(ago(now + 5e3, now)).toBe('0s ago');
    expect(utc(0)).toBe('1970-01-01 00:00 UTC');
    expect(mag(4.25)).toBe('M 4.3');
  });
});
