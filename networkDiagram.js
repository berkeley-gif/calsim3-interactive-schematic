import * as d3 from 'd3';

// Visualize the network schematic using D3
async function visualizeNetwork() {
  try {
    // Load the JSON data using fetch instead of fs
    const response = await fetch('/data/json/networkSchematic.json');
    const data = await response.json();
    
    /**
     * Extract node/link arrays from the JSON structure.
     * Adjust these paths to match your actual data structure.
     */
    const nodeArray = data.Diagram.Nodes?.[0]?.Node ?? [];
    const linkArray = data.Diagram.Links?.[0]?.Link ?? [];

    // Convert to D3-friendly shape
    const nodes = nodeArray.map((n) => ({
      id: n.$.Id,
      label: n.Text?.[0] ?? "",
      text: n.Text?.[0] ?? "", // For tooltip or display
      bounds: n.Bounds?.[0] ?? "", // For positioning if available
      visible: n.Visible?.[0] === "true", // For visibility
      brush: n.Brush?.[0]?.Id ?? "" // For styling
    }));

    const links = linkArray.map((l) => ({
      source: l.Origin?.[0]?.$.Id,
      target: l.Destination?.[0]?.$.Id,
      color: l.Pen?.[0]?.Color?.[0] ?? "#999", // Use link color from data if available
      width: parseFloat(l.Pen?.[0]?.Width?.[0]) || 2 // Use link width from data if available
    }));

    /** Set up the SVG element */
    const width = window.innerWidth;
    const height = window.innerHeight;

    // Clear any existing SVG (useful for hot reloading)
    d3.select('#network-container').selectAll('svg').remove();

    const svg = d3.select('#network-container')
      .append('svg')
      .attr('width', width)
      .attr('height', height)
      .attr('viewBox', [0, 0, width, height]);

    // Add zoom behavior
    const zoom = d3.zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });
    
    svg.call(zoom);
    
    // Create a container for all elements to apply zoom
    const container = svg.append('g');

    /** Build a force simulation */
    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(d => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2));

    /** Draw lines for every link */
    const link = container.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.width);

    /** Draw circles for every node */
    const node = container.selectAll('circle')
      .data(nodes)
      .enter()
      .append('circle')
      .attr('r', 8)
      .attr('fill', '#69b3a2')
      .call(d3.drag()
        .on('start', dragStarted)
        .on('drag', dragged)
        .on('end', dragEnded));

    /** Add labels */
    const labels = container.selectAll('text')
      .data(nodes)
      .enter()
      .append('text')
      .attr('dy', -10)
      .attr('text-anchor', 'middle')
      .text(d => d.label);

    /** Run the simulation, letting nodes move to stable positions */
    simulation.on('tick', () => {
      link
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y);

      node
        .attr('cx', d => d.x)
        .attr('cy', d => d.y);

      labels
        .attr('x', d => d.x)
        .attr('y', d => d.y - 15);
    });

    // Add tooltip
    node.append('title')
      .text(d => d.text);

    // Define drag behaviors
    function dragStarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragEnded(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    console.log("Network visualization rendered successfully!");
    
    // Add a status message to the page
    const status = document.createElement('div');
    status.className = 'status-message';
    status.textContent = `Rendered ${nodes.length} nodes and ${links.length} links`;
    document.body.appendChild(status);
    
  } catch (error) {
    console.error('Error visualizing network:', error);
    // Display error on the page
    const errorMsg = document.createElement('div');
    errorMsg.className = 'error-message';
    errorMsg.textContent = `Error: ${error.message}`;
    document.body.appendChild(errorMsg);
  }
}

// Call the function when the page loads
document.addEventListener('DOMContentLoaded', visualizeNetwork);