import * as d3 from 'd3';

// Configuration for map-based visualization
const MAP_CONFIG = {
  // California bounds (approximate)
  bounds: {
    minLat: 32.5,
    maxLat: 42.0,
    minLon: -124.5,
    maxLon: -114.0
  },
  // Map projection settings
  projection: {
    type: 'mercator', // or 'albers', 'geoAlbers', etc.
    scale: 50000,
    center: [-119.5, 37.0] // California center
  }
};

// API Configuration (same as networkDiagramAPI.js)
const API_CONFIG = {
  baseUrl: 'http://localhost:8000/api',
  endpoints: {
    nodes: '/network_node',
    arcs: '/network_arc'
  }
};

// Visualize the network on a geographic map
async function visualizeNetworkOnMap() {
  try {
    showStatus('Loading network data for map visualization...');
    
    // Fetch data from API
    const [nodesResponse, arcsResponse] = await Promise.all([
      fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.nodes}`),
      fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.arcs}`)
    ]);

    if (!nodesResponse.ok || !arcsResponse.ok) {
      throw new Error(`API request failed: ${nodesResponse.status} ${arcsResponse.status}`);
    }

    const nodesData = await nodesResponse.json();
    const arcsData = await arcsResponse.json();

    // Transform data for map visualization
    const nodes = transformNodesForMap(nodesData);
    const links = transformArcsForMap(arcsData, nodes);

    // Filter nodes with valid coordinates
    const geoNodes = nodes.filter(node => node.lat && node.lon);
    const geoNodeIds = new Set(geoNodes.map(node => node.id));
    const geoLinks = links.filter(link => 
      geoNodeIds.has(link.sourceId) && geoNodeIds.has(link.targetId)
    );

    console.log(`Map visualization: ${geoNodes.length} geo-located nodes, ${geoLinks.length} links`);

    if (geoNodes.length === 0) {
      throw new Error('No nodes with geographic coordinates found. Make sure your geom field contains valid coordinates.');
    }

    // Create the map visualization
    createMapVisualization(geoNodes, geoLinks);
    
  } catch (error) {
    console.error('Error loading network for map:', error);
    showError(`Failed to load network data for map: ${error.message}`);
  }
}

// Transform nodes with geographic coordinates
function transformNodesForMap(nodesData) {
  return nodesData.map(node => {
    const coords = parseGeometryToLatLon(node.geom);
    
    return {
      id: node.short_code,
      label: node.name || node.short_code,
      description: node.description,
      lat: coords ? coords.lat : null,
      lon: coords ? coords.lon : null,
      visible: node.integration_status === 'active',
      nodeType: node.node_type_id,
      modelNodeId: node.model_node_id,
      diagramId: node.diagram_id,
      attributes: node.model_attributes || {}
    };
  });
}

// Transform arcs for map (same as regular transform)
function transformArcsForMap(arcsData, nodes) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  return arcsData
    .filter(arc => {
      const fromNodeExists = nodeMap.has(getNodeShortCode(arc.from_node_id, nodes));
      const toNodeExists = nodeMap.has(getNodeShortCode(arc.to_node_id, nodes));
      return fromNodeExists && toNodeExists && arc.integration_status === 'active';
    })
    .map(arc => ({
      id: arc.short_code,
      sourceId: getNodeShortCode(arc.from_node_id, nodes),
      targetId: getNodeShortCode(arc.to_node_id, nodes),
      name: arc.name,
      description: arc.description,
      arcType: arc.arc_type_id,
      isReversible: arc.is_reversible,
      flowCapacity: arc.flow_capacity,
      color: getArcColor(arc.arc_type_id),
      width: getArcWidth(arc.arc_type_id),
      attributes: arc.model_attributes || {}
    }));
}

// Parse geometry to lat/lon coordinates
function parseGeometryToLatLon(geomString) {
  if (!geomString) return null;
  
  try {
    // Handle different geometry formats
    if (typeof geomString === 'string') {
      // PostGIS POINT format: "POINT(lon lat)" - note: PostGIS uses lon/lat order
      const pointMatch = geomString.match(/POINT\s*\(\s*([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*\)/i);
      if (pointMatch) {
        return {
          lon: parseFloat(pointMatch[1]),
          lat: parseFloat(pointMatch[2])
        };
      }
      
      // GeoJSON Point format
      const geoJson = JSON.parse(geomString);
      if (geoJson.type === 'Point' && geoJson.coordinates) {
        return {
          lon: geoJson.coordinates[0],
          lat: geoJson.coordinates[1]
        };
      }
    }
    
    // If it's already an object with coordinates
    if (geomString.coordinates) {
      return {
        lon: geomString.coordinates[0],
        lat: geomString.coordinates[1]
      };
    }
  } catch (e) {
    console.warn('Could not parse geometry to lat/lon:', geomString);
  }
  
  return null;
}

// Create map-based visualization
function createMapVisualization(nodes, links) {
  // Clear existing visualization
  d3.select('#network-container').selectAll('svg').remove();

  // Calculate map bounds from data
  const latExtent = d3.extent(nodes, d => d.lat);
  const lonExtent = d3.extent(nodes, d => d.lon);

  // Set up map projection
  const projection = d3.geoMercator()
    .domain([[lonExtent[0], latExtent[0]], [lonExtent[1], latExtent[1]]])
    .fitSize([window.innerWidth, window.innerHeight], {
      type: "FeatureCollection",
      features: nodes.map(node => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [node.lon, node.lat]
        }
      }))
    });

  // Create SVG
  const svg = d3.select('#network-container')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%');

  const g = svg.append('g');

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.5, 20])
    .on('zoom', (event) => {
      g.attr('transform', event.transform);
    });

  svg.call(zoom);

  // Add California outline (simplified - you might want to load actual state boundaries)
  addCaliforniaOutline(g, projection);

  // Create groups for layering
  const linkGroup = g.append('g').attr('class', 'links');
  const nodeGroup = g.append('g').attr('class', 'nodes');

  // Create node lookup
  const nodeById = new Map(nodes.map(node => [node.id, node]));

  // Render links on map
  renderMapLinks(linkGroup, links, nodeById, projection);

  // Render nodes on map
  renderMapNodes(nodeGroup, nodes, projection);

  // Add controls
  addMapControls(svg, zoom);
  
  // Add interactivity
  addMapInteractivity(nodeGroup, linkGroup, nodes, links, nodeById);

  showStatus(`Map: ${nodes.length} geo-located nodes, ${links.length} connections`);
}

// Add simplified California outline
function addCaliforniaOutline(g, projection) {
  // Simplified California boundary points (you might want to use actual GeoJSON)
  const californiaOutline = [
    [-124.4, 42.0], [-124.4, 32.5], [-114.1, 32.5], [-114.1, 35.0],
    [-117.0, 35.0], [-118.0, 34.0], [-119.0, 34.5], [-120.0, 35.5],
    [-121.0, 37.0], [-122.5, 38.0], [-123.0, 39.0], [-124.0, 40.0], [-124.4, 42.0]
  ];

  const line = d3.line()
    .x(d => projection([d[0], d[1]])[0])
    .y(d => projection([d[0], d[1]])[1]);

  g.append('path')
    .datum(californiaOutline)
    .attr('d', line)
    .attr('fill', 'none')
    .attr('stroke', '#ccc')
    .attr('stroke-width', 2)
    .attr('stroke-dasharray', '5,5');
}

// Render links on map
function renderMapLinks(linkGroup, links, nodeById, projection) {
  linkGroup.selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', d => d.color)
    .attr('stroke-width', d => d.width)
    .attr('opacity', 0.7)
    .attr('x1', d => {
      const sourceNode = nodeById.get(d.sourceId);
      return projection([sourceNode.lon, sourceNode.lat])[0];
    })
    .attr('y1', d => {
      const sourceNode = nodeById.get(d.sourceId);
      return projection([sourceNode.lon, sourceNode.lat])[1];
    })
    .attr('x2', d => {
      const targetNode = nodeById.get(d.targetId);
      return projection([targetNode.lon, targetNode.lat])[0];
    })
    .attr('y2', d => {
      const targetNode = nodeById.get(d.targetId);
      return projection([targetNode.lon, targetNode.lat])[1];
    });
}

// Render nodes on map
function renderMapNodes(nodeGroup, nodes, projection) {
  const nodeElements = nodeGroup.selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node')
    .attr('transform', d => {
      const [x, y] = projection([d.lon, d.lat]);
      return `translate(${x},${y})`;
    });

  // Add circles for nodes
  nodeElements.append('circle')
    .attr('r', 8)
    .attr('fill', d => getNodeColor(d.nodeType))
    .attr('stroke', '#333')
    .attr('stroke-width', 2);

  // Add labels (only show on zoom or hover)
  nodeElements.append('text')
    .attr('dy', -12)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('fill', '#000')
    .attr('opacity', 0)
    .text(d => d.label);
}

// Add map-specific controls
function addMapControls(svg, zoom) {
  const controls = document.createElement('div');
  controls.className = 'zoom-controls';
  controls.innerHTML = `
    <button id="zoom-in">Zoom In</button>
    <button id="zoom-out">Zoom Out</button>
    <button id="zoom-reset">Reset View</button>
    <button id="show-labels">Toggle Labels</button>
  `;
  document.body.appendChild(controls);

  d3.select('#zoom-in').on('click', () => {
    svg.transition().call(zoom.scaleBy, 2);
  });

  d3.select('#zoom-out').on('click', () => {
    svg.transition().call(zoom.scaleBy, 0.5);
  });

  d3.select('#zoom-reset').on('click', () => {
    svg.transition().call(zoom.transform, d3.zoomIdentity);
  });

  // Toggle labels
  let labelsVisible = false;
  d3.select('#show-labels').on('click', () => {
    labelsVisible = !labelsVisible;
    d3.selectAll('.node text')
      .transition()
      .duration(300)
      .attr('opacity', labelsVisible ? 1 : 0);
  });
}

// Add map-specific interactivity
function addMapInteractivity(nodeGroup, linkGroup, nodes, links, nodeById) {
  // Tooltip
  const tooltip = d3.select('body').append('div')
    .attr('class', 'tooltip')
    .style('position', 'absolute')
    .style('opacity', 0)
    .style('background-color', 'rgba(0,0,0,0.8)')
    .style('color', '#fff')
    .style('padding', '10px')
    .style('border-radius', '5px')
    .style('pointer-events', 'none')
    .style('font-size', '12px');

  // Node interactions
  nodeGroup.selectAll('.node')
    .on('mouseover', (event, node) => {
      // Show tooltip
      tooltip.transition().duration(200).style('opacity', 0.9);
      tooltip.html(`
        <strong>${node.label}</strong><br/>
        ID: ${node.id}<br/>
        Coordinates: ${node.lat.toFixed(4)}, ${node.lon.toFixed(4)}<br/>
        Type: ${node.nodeType}<br/>
        Description: ${node.description || 'N/A'}
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');

      // Highlight node
      d3.select(event.currentTarget).select('circle')
        .transition()
        .attr('r', 12);

      // Show label
      d3.select(event.currentTarget).select('text')
        .transition()
        .attr('opacity', 1);
    })
    .on('mouseout', (event) => {
      tooltip.transition().duration(500).style('opacity', 0);
      
      // Reset node size
      d3.select(event.currentTarget).select('circle')
        .transition()
        .attr('r', 8);

      // Hide label (unless labels are toggled on)
      d3.select(event.currentTarget).select('text')
        .transition()
        .attr('opacity', 0);
    });
}

// Helper functions (reuse from networkDiagramAPI.js)
function getNodeShortCode(nodeId, nodes) {
  const node = nodes.find(n => n.diagramId === nodeId);
  return node ? node.id : nodeId.toString();
}

function getArcColor(arcTypeId) {
  const colorMap = {
    1: '#FF6B6B', 2: '#4ECDC4', 3: '#45B7D1', 4: '#96CEB4', 5: '#FFEAA7',
    6: '#DDA0DD', 7: '#98D8C8', 8: '#F7DC6F', 9: '#BB8FCE', 10: '#85C1E9'
  };
  return colorMap[arcTypeId] || '#555555';
}

function getArcWidth(arcTypeId) {
  const widthMap = {
    1: 2, 2: 3, 3: 4, 4: 3, 5: 1, 6: 4, 7: 3, 8: 2, 9: 3, 10: 3
  };
  return widthMap[arcTypeId] || 2;
}

function getNodeColor(nodeTypeId) {
  const colorMap = {
    1: '#FFE5E5', 2: '#E5F9F6', 3: '#E5F4FD', 4: '#F0F8F0', 5: '#FFF9E5',
    6: '#F5E5F5', 7: '#E5F5F0', 8: '#FFFAE5', 9: '#F0E5F5', 10: '#E5F0FA'
  };
  return colorMap[nodeTypeId] || '#F0F0F0';
}

function showStatus(message) {
  d3.select('.status-message').remove();
  const status = document.createElement('div');
  status.className = 'status-message';
  status.textContent = message;
  document.body.appendChild(status);
}

function showError(message) {
  d3.select('.error-message').remove();
  const error = document.createElement('div');
  error.className = 'error-message';
  error.textContent = message;
  document.body.appendChild(error);
}

// Export functions
export { visualizeNetworkOnMap, API_CONFIG, MAP_CONFIG };

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', visualizeNetworkOnMap);

