import * as d3 from 'd3';

// Configuration for your API endpoints
const API_CONFIG = {
  baseUrl: 'http://localhost:8000/api', // Adjust this to your API base URL
  endpoints: {
    nodes: '/network_node',
    arcs: '/network_arc'
  }
};

// Visualize the network schematic using data from your database API
async function visualizeNetworkFromAPI() {
  try {
    // Show loading message
    showStatus('Loading network data from API...');
    
    // Fetch data from your API endpoints
    const [nodesResponse, arcsResponse] = await Promise.all([
      fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.nodes}`),
      fetch(`${API_CONFIG.baseUrl}${API_CONFIG.endpoints.arcs}`)
    ]);

    if (!nodesResponse.ok || !arcsResponse.ok) {
      throw new Error(`API request failed: ${nodesResponse.status} ${arcsResponse.status}`);
    }

    const nodesData = await nodesResponse.json();
    const arcsData = await arcsResponse.json();

    // Transform your database data to the format needed for visualization
    const nodes = transformNodes(nodesData);
    const links = transformArcs(arcsData, nodes);

    console.log(`Loaded ${nodes.length} nodes and ${links.length} links from API`);

    // Create the visualization
    createVisualization(nodes, links);
    
  } catch (error) {
    console.error('Error loading network from API:', error);
    showError(`Failed to load network data: ${error.message}`);
  }
}

// Transform database node data to visualization format
function transformNodes(nodesData) {
  return nodesData.map((node, index) => {
    // Extract coordinates from geom if available (assuming it's in a standard format)
    let x = 0, y = 0;
    if (node.geom) {
      // Parse geometry - adjust this based on your actual geom format
      // This assumes PostGIS POINT format or similar
      const coords = parseGeometry(node.geom);
      if (coords) {
        x = coords.x;
        y = coords.y;
      }
    }
    
    // If no geometry, use a simple layout based on diagram_id
    if (x === 0 && y === 0) {
      x = (node.diagram_id % 50) * 100; // Simple grid layout
      y = Math.floor(node.diagram_id / 50) * 100;
    }

    return {
      id: node.short_code,
      label: node.name || node.short_code,
      description: node.description,
      x: x,
      y: y,
      width: 60,  // Default width
      height: 40, // Default height
      visible: node.integration_status === 'active',
      nodeType: node.node_type_id,
      modelNodeId: node.model_node_id,
      diagramId: node.diagram_id,
      attributes: node.model_attributes || {}
    };
  });
}

// Transform database arc data to visualization format
function transformArcs(arcsData, nodes) {
  const nodeMap = new Map(nodes.map(node => [node.id, node]));
  
  return arcsData
    .filter(arc => {
      // Only include arcs where both nodes exist
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

// Helper function to get node short_code by diagram_id
function getNodeShortCode(nodeId, nodes) {
  const node = nodes.find(n => n.diagramId === nodeId);
  return node ? node.id : nodeId.toString();
}

// Parse geometry string to coordinates
function parseGeometry(geomString) {
  if (!geomString) return null;
  
  try {
    // Handle different geometry formats
    if (typeof geomString === 'string') {
      // PostGIS POINT format: "POINT(x y)" or similar
      const pointMatch = geomString.match(/POINT\s*\(\s*([+-]?\d*\.?\d+)\s+([+-]?\d*\.?\d+)\s*\)/i);
      if (pointMatch) {
        return {
          x: parseFloat(pointMatch[1]),
          y: parseFloat(pointMatch[2])
        };
      }
      
      // GeoJSON Point format
      const geoJson = JSON.parse(geomString);
      if (geoJson.type === 'Point' && geoJson.coordinates) {
        return {
          x: geoJson.coordinates[0],
          y: geoJson.coordinates[1]
        };
      }
    }
    
    // If it's already an object with coordinates
    if (geomString.coordinates) {
      return {
        x: geomString.coordinates[0],
        y: geomString.coordinates[1]
      };
    }
  } catch (e) {
    console.warn('Could not parse geometry:', geomString);
  }
  
  return null;
}

// Get color based on arc type
function getArcColor(arcTypeId) {
  const colorMap = {
    1: '#FF6B6B', // Red
    2: '#4ECDC4', // Teal
    3: '#45B7D1', // Blue
    4: '#96CEB4', // Green
    5: '#FFEAA7', // Yellow
    6: '#DDA0DD', // Plum
    7: '#98D8C8', // Mint
    8: '#F7DC6F', // Light Yellow
    9: '#BB8FCE', // Light Purple
    10: '#85C1E9'  // Light Blue
  };
  return colorMap[arcTypeId] || '#555555';
}

// Get width based on arc type
function getArcWidth(arcTypeId) {
  const widthMap = {
    1: 3,  // Thin
    2: 5,  // Medium
    3: 7,  // Thick
    4: 4,
    5: 2,  // Very thin
    6: 6,
    7: 4,
    8: 3,
    9: 5,
    10: 4
  };
  return widthMap[arcTypeId] || 3;
}

// Create the D3 visualization
function createVisualization(nodes, links) {
  // Clear any existing visualization
  d3.select('#network-container').selectAll('svg').remove();
  
  // Filter to only visible nodes and their links
  const visibleNodes = nodes.filter(node => node.visible);
  const visibleNodeIds = new Set(visibleNodes.map(node => node.id));
  const visibleLinks = links.filter(link => 
    visibleNodeIds.has(link.sourceId) && visibleNodeIds.has(link.targetId)
  );

  console.log(`Rendering ${visibleNodes.length} visible nodes and ${visibleLinks.length} visible links`);

  // Calculate bounds for the visualization
  const padding = 200;
  const xExtent = d3.extent(visibleNodes, d => d.x);
  const yExtent = d3.extent(visibleNodes, d => d.y);

  const svgWidth = xExtent[1] - xExtent[0] + 2 * padding;
  const svgHeight = yExtent[1] - yExtent[0] + 2 * padding;

  // Create SVG container
  const svgContainer = d3.select('#network-container')
    .append('svg')
    .attr('width', '100%')
    .attr('height', '100%')
    .attr('viewBox', [xExtent[0] - padding, yExtent[0] - padding, svgWidth, svgHeight]);

  const svg = svgContainer.append('g');

  // Add zoom behavior
  const zoom = d3.zoom()
    .scaleExtent([0.1, 50])
    .on('zoom', (event) => {
      svg.attr('transform', event.transform);
    });

  svgContainer.call(zoom);

  // Add zoom controls
  addZoomControls(svgContainer, zoom);

  // Create groups for proper layering
  const linkGroup = svg.append('g').attr('class', 'links');
  const nodeGroup = svg.append('g').attr('class', 'nodes');

  // Add arrow markers for directed links
  addArrowMarkers(svg);

  // Create node lookup map
  const nodeById = new Map(visibleNodes.map(node => [node.id, node]));

  // Render links
  renderLinks(linkGroup, visibleLinks, nodeById);

  // Render nodes
  renderNodes(nodeGroup, visibleNodes);

  // Add interactivity
  addInteractivity(nodeGroup, linkGroup, visibleNodes, visibleLinks, nodeById);

  // Add search functionality
  addSearchFunctionality(nodeGroup, linkGroup, visibleNodes, visibleLinks, nodeById);

  // Update status
  showStatus(`Rendered ${visibleNodes.length} nodes and ${visibleLinks.length} links from API`);
}

// Add arrow markers to SVG
function addArrowMarkers(svg) {
  svg.append('defs').append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 15)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#555');
}

// Render links
function renderLinks(linkGroup, links, nodeById) {
  linkGroup.selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke', d => d.color)
    .attr('stroke-width', d => d.width)
    .attr('opacity', 0.8)
    .attr('x1', d => nodeById.get(d.sourceId).x + nodeById.get(d.sourceId).width / 2)
    .attr('y1', d => nodeById.get(d.sourceId).y + nodeById.get(d.sourceId).height / 2)
    .attr('x2', d => nodeById.get(d.targetId).x + nodeById.get(d.targetId).width / 2)
    .attr('y2', d => nodeById.get(d.targetId).y + nodeById.get(d.targetId).height / 2)
    .attr('marker-end', 'url(#arrowhead)');
}

// Render nodes
function renderNodes(nodeGroup, nodes) {
  const nodeElements = nodeGroup.selectAll('.node')
    .data(nodes)
    .enter()
    .append('g')
    .attr('class', 'node');

  // Add shapes based on node type
  nodeElements.each(function(node) {
    const element = d3.select(this);
    const fillColor = getNodeColor(node.nodeType);
    
    // Default to rectangle, but you can add more shapes based on nodeType
    element.append('rect')
      .attr('x', node.x)
      .attr('y', node.y)
      .attr('width', node.width)
      .attr('height', node.height)
      .attr('fill', fillColor)
      .attr('stroke', '#333')
      .attr('stroke-width', 2)
      .attr('rx', 5); // Rounded corners

    // Add labels
    element.append('text')
      .attr('x', node.x + node.width / 2)
      .attr('y', node.y + node.height / 2)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#000')
      .text(node.label);
  });
}

// Get node color based on type
function getNodeColor(nodeTypeId) {
  const colorMap = {
    1: '#FFE5E5', // Light Red
    2: '#E5F9F6', // Light Teal
    3: '#E5F4FD', // Light Blue
    4: '#F0F8F0', // Light Green
    5: '#FFF9E5', // Light Yellow
    6: '#F5E5F5', // Light Purple
    7: '#E5F5F0', // Light Mint
    8: '#FFFAE5', // Very Light Yellow
    9: '#F0E5F5', // Very Light Purple
    10: '#E5F0FA'  // Very Light Blue
  };
  return colorMap[nodeTypeId] || '#F0F0F0';
}

// Add zoom controls
function addZoomControls(svgContainer, zoom) {
  const zoomControls = document.createElement('div');
  zoomControls.className = 'zoom-controls';
  zoomControls.innerHTML = `
    <button id="zoom-in">Zoom In</button>
    <button id="zoom-out">Zoom Out</button>
    <button id="zoom-reset">Reset</button>
  `;
  document.body.appendChild(zoomControls);

  d3.select('#zoom-in').on('click', () => {
    svgContainer.transition().call(zoom.scaleBy, 2);
  });

  d3.select('#zoom-out').on('click', () => {
    svgContainer.transition().call(zoom.scaleBy, 0.5);
  });

  d3.select('#zoom-reset').on('click', () => {
    svgContainer.transition().call(zoom.transform, d3.zoomIdentity);
  });
}

// Add interactivity (tooltips, highlighting)
function addInteractivity(nodeGroup, linkGroup, nodes, links, nodeById) {
  // Add tooltip
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

  // Add hover effects to nodes
  nodeGroup.selectAll('.node')
    .on('mouseover', (event, node) => {
      // Show tooltip
      tooltip.transition().duration(200).style('opacity', 0.9);
      tooltip.html(`
        <strong>${node.label}</strong><br/>
        ID: ${node.id}<br/>
        Type: ${node.nodeType}<br/>
        Description: ${node.description || 'N/A'}
      `)
        .style('left', (event.pageX + 10) + 'px')
        .style('top', (event.pageY - 28) + 'px');

      // Highlight connected nodes and links
      highlightConnections(node.id, nodeGroup, linkGroup, links);
    })
    .on('mouseout', () => {
      tooltip.transition().duration(500).style('opacity', 0);
      resetHighlighting(nodeGroup, linkGroup);
    });
}

// Highlight connected nodes and links
function highlightConnections(nodeId, nodeGroup, linkGroup, links) {
  const connectedNodes = new Set([nodeId]);
  const connectedLinks = [];

  // Find all connected nodes and links
  links.forEach(link => {
    if (link.sourceId === nodeId || link.targetId === nodeId) {
      connectedNodes.add(link.sourceId);
      connectedNodes.add(link.targetId);
      connectedLinks.push(link);
    }
  });

  // Dim non-connected elements
  nodeGroup.selectAll('.node')
    .style('opacity', node => connectedNodes.has(node.id) ? 1 : 0.2);

  linkGroup.selectAll('line')
    .style('opacity', link => 
      connectedLinks.some(cl => cl.id === link.id) ? 1 : 0.1
    );
}

// Reset highlighting
function resetHighlighting(nodeGroup, linkGroup) {
  nodeGroup.selectAll('.node').style('opacity', 1);
  linkGroup.selectAll('line').style('opacity', 0.8);
}

// Add search functionality
function addSearchFunctionality(nodeGroup, linkGroup, nodes, links, nodeById) {
  const searchContainer = d3.select('body').append('div')
    .attr('class', 'search-container')
    .style('position', 'absolute')
    .style('top', '120px')
    .style('left', '20px')
    .style('background-color', 'rgba(255, 255, 255, 0.9)')
    .style('padding', '10px')
    .style('border-radius', '5px')
    .style('box-shadow', '0 2px 5px rgba(0,0,0,0.3)');

  searchContainer.html(`
    <input type="text" id="search-box" placeholder="Search nodes..." style="width: 200px;">
    <button id="reset-search">Reset</button>
  `);

  // Search functionality
  d3.select('#search-box').on('input', function() {
    const query = this.value.toLowerCase();
    
    nodeGroup.selectAll('.node')
      .style('opacity', node => 
        node.label.toLowerCase().includes(query) || 
        node.id.toLowerCase().includes(query) ||
        (node.description && node.description.toLowerCase().includes(query))
          ? 1 : 0.2
      );

    linkGroup.selectAll('line')
      .style('opacity', link => {
        const sourceMatch = nodeById.get(link.sourceId).label.toLowerCase().includes(query) ||
                           nodeById.get(link.sourceId).id.toLowerCase().includes(query);
        const targetMatch = nodeById.get(link.targetId).label.toLowerCase().includes(query) ||
                           nodeById.get(link.targetId).id.toLowerCase().includes(query);
        return sourceMatch || targetMatch ? 0.8 : 0.1;
      });
  });

  // Reset search
  d3.select('#reset-search').on('click', () => {
    d3.select('#search-box').property('value', '');
    resetHighlighting(nodeGroup, linkGroup);
  });
}

// Utility functions for status messages
function showStatus(message) {
  // Remove existing status
  d3.select('.status-message').remove();
  
  const status = document.createElement('div');
  status.className = 'status-message';
  status.textContent = message;
  document.body.appendChild(status);
}

function showError(message) {
  // Remove existing error
  d3.select('.error-message').remove();
  
  const error = document.createElement('div');
  error.className = 'error-message';
  error.textContent = message;
  document.body.appendChild(error);
}

// Export the main function
export { visualizeNetworkFromAPI, API_CONFIG };

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', visualizeNetworkFromAPI);

