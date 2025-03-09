// Enhanced Earthquake Visualization
// Global variables
let map, earthquakeLayer, majorEarthquakeLayer, tectonicPlatesLayer, heatmapLayer;
let timeSlider, timeLabel, lastWeekData, majorData;
let timeFilterActive = false;
let currentFilters = {
  minMagnitude: 0,
  maxDepth: Infinity
};

// Initialize the map once the DOM is fully loaded
document.addEventListener('DOMContentLoaded', function() {
  initMap();
  loadData();
});

// Initialize the map with tile layers and controls
function initMap() {
  // Create base map layers
  const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  });
  
  const satellite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
  });
  
  const topo = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
    attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
  });

  const dark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  });
  
  // Create layer groups
  earthquakeLayer = new L.LayerGroup();
  majorEarthquakeLayer = new L.LayerGroup();
  tectonicPlatesLayer = new L.LayerGroup();
  heatmapLayer = new L.LayerGroup();
  
  // Create map with default settings
  map = L.map("map", {
    center: [37.09, -95.71],
    zoom: 3,
    layers: [dark, earthquakeLayer, tectonicPlatesLayer]
  });
  
  // Define base maps
  const baseMaps = {
    "Street Map": street,
    "Satellite": satellite,
    "Topographic Map": topo,
    "Dark Mode": dark
  };
  
  // Define overlay maps
  const overlayMaps = {
    "All Earthquakes": earthquakeLayer,
    "Major Earthquakes (4.5+)": majorEarthquakeLayer,
    "Tectonic Plates": tectonicPlatesLayer,
    "Earthquake Heatmap": heatmapLayer
  };
  
  // Add layer control
  L.control.layers(baseMaps, overlayMaps, {
    collapsed: false
  }).addTo(map);

  // Add scale control
  L.control.scale().addTo(map);
  
  // Add legend
  createLegend().addTo(map);

  // Add filter controls
  createFilterControls().addTo(map);

  // Add info panel
  createInfoPanel().addTo(map);
}

// Load all data sets
function loadData() {
  // Show loading indicator
  showLoading(true);
  
  // Load earthquake data
  d3.json("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_week.geojson")
    .then(function(data) {
      lastWeekData = data;
      // Load major earthquake data
      return d3.json("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/4.5_week.geojson");
    })
    .then(function(majorEarthquakeData) {
      majorData = majorEarthquakeData;
      // Load tectonic plates data
      return d3.json("https://raw.githubusercontent.com/fraxen/tectonicplates/master/GeoJSON/PB2002_boundaries.json");
    })
    .then(function(plateData) {
      // Process earthquake data
      processEarthquakeData(lastWeekData);
      
      // Process major earthquake data
      processMajorEarthquakeData(majorData);
      
      // Process tectonic plates data
      processTectonicPlateData(plateData);

      // Create heatmap
      createHeatmap(lastWeekData);
      
      // Create time slider after data is loaded
      createTimeSlider(lastWeekData);
      
      // Update stats
      updateEarthquakeStats(lastWeekData);
      
      // Hide loading indicator
      showLoading(false);
    })
    .catch(function(error) {
      console.error("Error loading data:", error);
      alert("Failed to load earthquake data. Please try again later.");
      showLoading(false);
    });
}

// Process earthquake data and add to map
function processEarthquakeData(data) {
  // Clear existing layer
  earthquakeLayer.clearLayers();

  // Create GeoJSON layer for earthquakes
  L.geoJson(data, {
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng, {
        radius: calculateMarkerSize(feature.properties.mag),
        fillColor: getDepthColor(feature.geometry.coordinates[2]),
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      });
    },
    onEachFeature: function(feature, layer) {
      layer.bindPopup(createPopupContent(feature));
    },
    filter: function(feature) {
      // Apply current filters
      const mag = feature.properties.mag;
      const depth = feature.geometry.coordinates[2];
      const time = feature.properties.time;
      
      // Apply magnitude and depth filters
      if (mag < currentFilters.minMagnitude || depth > currentFilters.maxDepth) {
        return false;
      }
      
      // Apply time filter if active
      if (timeFilterActive && timeSlider) {
        const sliderTime = parseInt(timeSlider.value);
        const featureTime = feature.properties.time;
        return featureTime >= sliderTime;
      }
      
      return true;
    }
  }).addTo(earthquakeLayer);
}

// Process major earthquake data and add to map
function processMajorEarthquakeData(data) {
  // Clear existing layer
  majorEarthquakeLayer.clearLayers();

  // Create GeoJSON layer for major earthquakes
  L.geoJson(data, {
    pointToLayer: function(feature, latlng) {
      return L.circleMarker(latlng, {
        radius: calculateMarkerSize(feature.properties.mag),
        fillColor: getMajorEarthquakeColor(feature.properties.mag),
        color: "#000",
        weight: 1,
        opacity: 1,
        fillOpacity: 0.8
      });
    },
    onEachFeature: function(feature, layer) {
      layer.bindPopup(createPopupContent(feature));
    },
    filter: function(feature) {
      // Apply time filter if active
      if (timeFilterActive && timeSlider) {
        const sliderTime = parseInt(timeSlider.value);
        const featureTime = feature.properties.time;
        return featureTime >= sliderTime;
      }
      
      return true;
    }
  }).addTo(majorEarthquakeLayer);
}

// Process tectonic plate data and add to map
function processTectonicPlateData(data) {
  // Clear existing layer
  tectonicPlatesLayer.clearLayers();

  // Create GeoJSON layer for tectonic plates
  L.geoJson(data, {
    style: {
      color: "#ff6500",
      weight: 2,
      opacity: 0.7
    }
  }).addTo(tectonicPlatesLayer);
}

// Create heatmap from earthquake data
function createHeatmap(data) {
  // Clear existing layer
  heatmapLayer.clearLayers();
  
  // Extract coordinates and intensity for heatmap
  const heatData = data.features.map(feature => {
    const lat = feature.geometry.coordinates[1];
    const lng = feature.geometry.coordinates[0];
    const intensity = feature.properties.mag * 2; // Use magnitude as intensity
    return [lat, lng, intensity];
  });
  
  // Create heat layer
  const heat = L.heatLayer(heatData, {
    radius: 20,
    blur: 15,
    maxZoom: 10,
    gradient: {0.4: 'blue', 0.6: 'lime', 0.8: 'yellow', 1.0: 'red'}
  });
  
  // Add to heatmap layer
  heatmapLayer.addLayer(heat);
}

// Create popup content for earthquake markers
function createPopupContent(feature) {
  // Format date
  const date = new Date(feature.properties.time);
  const formattedDate = date.toLocaleDateString("en-US", {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  });
  
  // Calculate time ago
  const timeAgo = getTimeAgo(feature.properties.time);
  
  // Create popup content
  return `
    <div class="earthquake-popup">
      <h3>${feature.properties.place || 'Unknown Location'}</h3>
      <div class="popup-magnitude">Magnitude: <strong>${feature.properties.mag.toFixed(1)}</strong></div>
      <div class="popup-depth">Depth: <strong>${feature.geometry.coordinates[2].toFixed(1)} km</strong></div>
      <div class="popup-time">Time: ${formattedDate}</div>
      <div class="popup-time-ago">${timeAgo}</div>
      <div class="popup-link"><a href="${feature.properties.url}" target="_blank">View Details on USGS</a></div>
    </div>
  `;
}

// Calculate the size of earthquake markers based on magnitude
function calculateMarkerSize(magnitude) {
  // Make smaller earthquakes more visible but still scale with magnitude
  return Math.max(4, magnitude * 3.5);
}

// Get color based on earthquake depth
function getDepthColor(depth) {
  return depth > 90 ? "#ea2c2c" :
         depth > 70 ? "#ea822c" :
         depth > 50 ? "#ee9c00" :
         depth > 30 ? "#eecc00" :
         depth > 10 ? "#d4ee00" :
                     "#98ee00";
}

// Get color based on major earthquake magnitude
function getMajorEarthquakeColor(magnitude) {
  return magnitude >= 6 ? "#800026" :
         magnitude >= 5 ? "#BD0026" :
                         "#E31A1C";
}

// Create legend control
function createLegend() {
  let legend = L.control({position: "bottomright"});
  
  legend.onAdd = function() {
    let div = L.DomUtil.create("div", "legend");
    let depths = [-10, 10, 30, 50, 70, 90];
    let colors = ["#98ee00", "#d4ee00", "#eecc00", "#ee9c00", "#ea822c", "#ea2c2c"];
    
    div.innerHTML = `
      <h4>Earthquake Depth</h4>
      <div class="legend-scale">
        ${depths.map((depth, i) => `
          <div class="legend-item">
            <i style="background: ${colors[i]}"></i>
            <span>${depth}${depths[i + 1] ? ' - ' + depths[i + 1] : '+'} km</span>
          </div>
        `).join('')}
      </div>
      <h4 class="legend-section">Major Earthquakes</h4>
      <div class="legend-scale">
        <div class="legend-item">
          <i style="background: #E31A1C"></i>
          <span>4.5 - 5.0</span>
        </div>
        <div class="legend-item">
          <i style="background: #BD0026"></i>
          <span>5.0 - 6.0</span>
        </div>
        <div class="legend-item">
          <i style="background: #800026"></i>
          <span>6.0+</span>
        </div>
      </div>
    `;
    
    return div;
  };
  
  return legend;
}

// Create filter controls
function createFilterControls() {
  let control = L.control({position: "topleft"});
  
  control.onAdd = function() {
    let div = L.DomUtil.create("div", "filter-control");
    
    div.innerHTML = `
      <div class="filter-panel">
        <h4>Earthquake Filters</h4>
        <div class="filter-item">
          <label for="magnitude-filter">Minimum Magnitude:</label>
          <input type="range" id="magnitude-filter" min="0" max="8" step="0.1" value="0">
          <span id="magnitude-value">0</span>
        </div>
        <div class="filter-item">
          <label for="depth-filter">Maximum Depth (km):</label>
          <input type="range" id="depth-filter" min="0" max="700" step="10" value="700">
          <span id="depth-value">700</span>
        </div>
        <div class="filter-item">
          <button id="reset-filters">Reset Filters</button>
        </div>
      </div>
    `;
    
    // Prevent map click events from propagating through the control
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    
    return div;
  };
  
  // Add event listeners after the control is added to the map
  control.on('add', function() {
    // Get filter elements
    const magnitudeFilter = document.getElementById('magnitude-filter');
    const depthFilter = document.getElementById('depth-filter');
    const magnitudeValue = document.getElementById('magnitude-value');
    const depthValue = document.getElementById('depth-value');
    const resetButton = document.getElementById('reset-filters');
    
    // Add event listeners
    magnitudeFilter.addEventListener('input', function() {
      magnitudeValue.textContent = this.value;
      currentFilters.minMagnitude = parseFloat(this.value);
      processEarthquakeData(lastWeekData);
    });
    
    depthFilter.addEventListener('input', function() {
      depthValue.textContent = this.value;
      currentFilters.maxDepth = parseFloat(this.value);
      processEarthquakeData(lastWeekData);
    });
    
    resetButton.addEventListener('click', function() {
      magnitudeFilter.value = 0;
      depthFilter.value = 700;
      magnitudeValue.textContent = '0';
      depthValue.textContent = '700';
      currentFilters.minMagnitude = 0;
      currentFilters.maxDepth = Infinity;
      processEarthquakeData(lastWeekData);
    });
  });
  
  return control;
}

// Create time slider for temporal filtering
function createTimeSlider(data) {
  // Create control
  let timeControl = L.control({position: "bottomleft"});
  
  timeControl.onAdd = function() {
    let div = L.DomUtil.create("div", "time-slider-control");
    
    // Get the time range from the data
    const times = data.features.map(f => f.properties.time);
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    div.innerHTML = `
      <div class="time-slider-panel">
        <h4>Time Filter</h4>
        <div class="time-slider-container">
          <input type="range" id="time-slider" min="${minTime}" max="${maxTime}" step="86400000" value="${minTime}">
          <div class="time-labels">
            <span>${new Date(minTime).toLocaleDateString()}</span>
            <span id="current-time">${new Date(minTime).toLocaleDateString()}</span>
            <span>${new Date(maxTime).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="time-slider-controls">
          <button id="play-button">&#9658; Play</button>
          <button id="reset-time">Reset</button>
        </div>
      </div>
    `;
    
    // Prevent map click events from propagating through the control
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.disableScrollPropagation(div);
    
    return div;
  };
  
  timeControl.addTo(map);
  
  // Get elements after they're added to the DOM
  timeSlider = document.getElementById('time-slider');
  timeLabel = document.getElementById('current-time');
  const playButton = document.getElementById('play-button');
  const resetTimeButton = document.getElementById('reset-time');
  
  // Animation variables
  let animationId = null;
  let isPlaying = false;
  
  // Add event listeners
  timeSlider.addEventListener('input', function() {
    const selectedTime = parseInt(this.value);
    timeLabel.textContent = new Date(selectedTime).toLocaleDateString();
    timeFilterActive = true;
    processEarthquakeData(lastWeekData);
    processMajorEarthquakeData(majorData);
  });
  
  playButton.addEventListener('click', function() {
    if (isPlaying) {
      // Stop animation
      clearInterval(animationId);
      this.innerHTML = "&#9658; Play";
      isPlaying = false;
    } else {
      // Start animation
      isPlaying = true;
      this.innerHTML = "&#9616;&#9616; Pause";
      
      animationId = setInterval(() => {
        let currentValue = parseInt(timeSlider.value);
        const maxValue = parseInt(timeSlider.max);
        
        if (currentValue >= maxValue) {
          // Reset to beginning when reaching the end
          currentValue = parseInt(timeSlider.min);
        } else {
          // Increment by one day (86400000 ms)
          currentValue += 86400000;
        }
        
        timeSlider.value = currentValue;
        timeLabel.textContent = new Date(currentValue).toLocaleDateString();
        timeFilterActive = true;
        processEarthquakeData(lastWeekData);
        processMajorEarthquakeData(majorData);
      }, 1000); // Update every second
    }
  });
  
  resetTimeButton.addEventListener('click', function() {
    // Stop animation if running
    if (isPlaying) {
      clearInterval(animationId);
      playButton.innerHTML = "&#9658; Play";
      isPlaying = false;
    }
    
    // Reset slider to minimum
    timeSlider.value = timeSlider.min;
    timeLabel.textContent = new Date(parseInt(timeSlider.min)).toLocaleDateString();
    
    // Disable time filter
    timeFilterActive = false;
    processEarthquakeData(lastWeekData);
    processMajorEarthquakeData(majorData);
  });
}

// Create info panel for earthquake statistics
function createInfoPanel() {
  let info = L.control({position: "topright"});
  
  info.onAdd = function() {
    let div = L.DomUtil.create("div", "info");
    div.innerHTML = `
      <h4>Earthquake Statistics</h4>
      <div id="earthquake-stats">
        <p>Total Earthquakes: <span id="total-count">Loading...</span></p>
        <p>Major Earthquakes (4.5+): <span id="major-count">Loading...</span></p>
        <p>Average Magnitude: <span id="avg-magnitude">Loading...</span></p>
        <p>Strongest Earthquake: <span id="max-magnitude">Loading...</span></p>
      </div>
    `;
    return div;
  };
  
  return info;
}

// Update earthquake statistics
function updateEarthquakeStats(data) {
  // Get elements
  const totalCount = document.getElementById('total-count');
  const majorCount = document.getElementById('major-count');
  const avgMagnitude = document.getElementById('avg-magnitude');
  const maxMagnitude = document.getElementById('max-magnitude');
  
  // Calculate statistics
  const features = data.features;
  const count = features.length;
  const majors = features.filter(f => f.properties.mag >= 4.5).length;
  
  // Calculate average magnitude
  const totalMagnitude = features.reduce((sum, f) => sum + f.properties.mag, 0);
  const avg = totalMagnitude / count;
  
  // Find max magnitude
  const maxMag = Math.max(...features.map(f => f.properties.mag));
  const maxEarthquake = features.find(f => f.properties.mag === maxMag);
  
  // Update display
  totalCount.textContent = count.toLocaleString();
  majorCount.textContent = majors.toLocaleString();
  avgMagnitude.textContent = avg.toFixed(2);
  maxMagnitude.textContent = `${maxMag.toFixed(1)} (${maxEarthquake.properties.place})`;
}

// Get human-readable time difference
function getTimeAgo(timestamp) {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now - date;
  
  // Convert to seconds, minutes, hours, days
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHrs = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHrs / 24);
  
  if (diffDays > 0) {
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  } else if (diffHrs > 0) {
    return `${diffHrs} hour${diffHrs > 1 ? 's' : ''} ago`;
  } else if (diffMin > 0) {
    return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  } else {
    return 'Just now';
  }
}

// Show or hide loading indicator
function showLoading(isLoading) {
  // Create loading indicator if it doesn't exist
  let loader = document.getElementById('map-loader');
  
  if (!loader && isLoading) {
    loader = document.createElement('div');
    loader.id = 'map-loader';
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner"></div>
        <p>Loading earthquake data...</p>
      </div>
    `;
    document.body.appendChild(loader);
  } else if (loader && !isLoading) {
    loader.remove();
  }
}
