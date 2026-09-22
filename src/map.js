import { tokens } from './exec-shell.js';
/** Leaflet wiring. Everything here touches the DOM or Leaflet; nothing computes. */
import { clusterEvents, shouldCluster } from './cluster.js';
import { mag, utc } from './format.js';
import { DEPTH_BINS, depthColour, magnitudeRadius } from './geo.js';

export function loadLeaflet() {
  return globalThis.L ?? null;
}

const TILES = {
  // CARTO's free dark tiles now require an API key (they render "API KEY REQUIRED"); Esri's Dark Gray canvas does not.
  dark: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ', maxZoom: 16 }],
  street: ['https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors', maxZoom: 19 }],
  topo: ['https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)', maxZoom: 17 }],
  satellite: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Tiles &copy; Esri', maxZoom: 18 }]
};

function popupHtml(e) {
  const el = document.createElement('div');
  const h = document.createElement('strong');
  h.textContent = `${mag(e.mag)} — ${e.place}`;
  const p = document.createElement('p');
  p.textContent = `Depth ${e.depth.toFixed(1)} km · ${utc(e.time)}${e.tsunami ? ' · tsunami flag' : ''}`;
  el.append(h, p);
  if (e.url) {
    const a = document.createElement('a');
    a.href = e.url;
    a.textContent = 'USGS event page';
    a.rel = 'noopener';
    a.target = '_blank';
    el.append(a);
  }
  return el;
}

export function createMap(L, container) {
  const base = Object.fromEntries(Object.entries(TILES).map(([k, [url, opts]]) => [k, L.tileLayer(url, opts)]));
  const map = L.map(container, { center: [20, 0], zoom: 2, layers: [base.dark], worldCopyJump: true, zoomControl: true });
  L.control.layers({ Dark: base.dark, Street: base.street, Topographic: base.topo, Satellite: base.satellite }, {}, { collapsed: true, position: 'topright' }).addTo(map);
  L.control.scale().addTo(map);
  const quakes = L.layerGroup().addTo(map);
  const plates = L.layerGroup();
  let heat = null;
  let heatOn = false;
  let current = [];

  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = () => {
    const div = L.DomUtil.create('div', 'legend');
    const title = document.createElement('h4');
    title.textContent = 'Depth (km)';
    div.append(title);
    for (const b of DEPTH_BINS) {
      const row = document.createElement('div');
      const sw = document.createElement('i');
      sw.className = 'legend__swatch';
      sw.style.setProperty('background', b.colour);
      row.append(sw, document.createTextNode(b.label));
      div.append(row);
    }
    return div;
  };
  legend.addTo(map);

  function draw() {
    quakes.clearLayers();
    const zoom = map.getZoom();
    if (shouldCluster(zoom)) {
      for (const c of clusterEvents(current, zoom)) {
        if (c.count === 1) {
          addEvent(c.events[0]);
          continue;
        }
        const size = Math.min(44, 18 + Math.round(Math.log2(c.count) * 5));
        const icon = L.divIcon({ className: 'cluster', html: `<span>${c.count}</span>`, iconSize: [size, size] });
        const m = L.marker([c.lat, c.lon], { icon, keyboard: true, title: `${c.count} earthquakes, strongest ${mag(c.strongest.mag)}` });
        m.on('click', () => map.setView([c.lat, c.lon], Math.min(zoom + 2, 7)));
        m.addTo(quakes);
      }
    } else {
      for (const e of current) addEvent(e);
    }
  }
  function addEvent(e) {
    L.circleMarker([e.lat, e.lon], { radius: magnitudeRadius(e.mag, map.getZoom()), fillColor: depthColour(e.depth), color: tokens().bg, weight: 1, opacity: 1, fillOpacity: 0.85 })
      .bindPopup(popupHtml(e))
      .addTo(quakes);
  }
  map.on('zoomend', draw);

  return {
    map,
    setEvents(events) {
      current = events;
      draw();
      if (heat) {
        map.removeLayer(heat);
        heat = null;
      }
      if (L.heatLayer) {
        heat = L.heatLayer(events.map((e) => [e.lat, e.lon, Math.max(0.2, e.mag / 2)]), { radius: 22, blur: 18, maxZoom: 8 });
        if (heatOn) heat.addTo(map);
      }
    },
    toggleHeat(on) {
      heatOn = on;
      if (!heat) return;
      if (on) heat.addTo(map);
      else map.removeLayer(heat);
    },
    setPlates(geojson) {
      plates.clearLayers();
      L.geoJSON(geojson, { style: { color: '#ff6500', weight: 1.5, opacity: 0.7 } }).addTo(plates);
    },
    togglePlates(on) {
      if (on) plates.addTo(map);
      else map.removeLayer(plates);
    },
    focus(e) {
      map.setView([e.lat, e.lon], 6);
      L.popup().setLatLng([e.lat, e.lon]).setContent(popupHtml(e)).openOn(map);
    },
    setZoom: (z) => map.setZoom(z)
  };
}
