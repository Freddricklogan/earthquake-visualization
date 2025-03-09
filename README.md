# Advanced Earthquake Visualization

![Earthquake Visualization](https://raw.githubusercontent.com/freddricklogan/earthquake-visualization/main/screenshot.png)

An interactive web application that visualizes real-time earthquake data from around the world using the USGS Earthquake Hazards Program API.

## Features

- **Multiple Map Layers**: Street, satellite, topographic, and dark mode
- **Earthquake Visualization**: Dynamic markers sized by magnitude and colored by depth
- **Tectonic Plate Boundaries**: Overlay showing relationship between plate boundaries and earthquake occurrence
- **Heatmap View**: Intensity-based visualization of earthquake concentration
- **Interactive Elements**: Popups with detailed information on each earthquake
- **Real-time Data**: Fetches the latest 7-day earthquake data from USGS

## How to Use

1. Use the layer control in the top right to toggle between different map views and data layers
2. Click on any earthquake marker to view detailed information
3. Toggle between different visualization methods to analyze patterns
4. View the legend in the bottom right for depth color reference

## Technologies Used

- **Leaflet.js**: Interactive mapping library
- **D3.js**: Data handling and manipulation
- **Leaflet.heat**: Heat map visualization plugin
- **USGS API**: Earthquake data source

## Data Sources

- **Earthquake Data**: [USGS Earthquake Hazards Program](https://earthquake.usgs.gov/earthquakes/feed/v1.0/geojson.php)
- **Tectonic Plates**: [GitHub - fraxen/tectonicplates](https://github.com/fraxen/tectonicplates)

## Live Demo

You can view the live application at: [https://freddricklogan.github.io/earthquake-visualization/](https://freddricklogan.github.io/earthquake-visualization/)

## Educational Purpose

This visualization serves as an educational tool to understand the global distribution of seismic activity and its relationship with tectonic plate boundaries.
