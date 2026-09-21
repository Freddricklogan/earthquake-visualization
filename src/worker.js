/** Module worker: fetches and parses the USGS feed off the main thread and returns flat events plus summaries. */
import { parseFeed, summarize } from './geo.js';

self.onmessage = async (event) => {
  const { id, url } = event.data;
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`USGS responded ${res.status}`);
    const feed = parseFeed(await res.json());
    self.postMessage({ id, feed, summary: summarize(feed.events), fetchedAt: Date.now() });
  } catch (error) {
    self.postMessage({ id, error: error.message });
  }
};
