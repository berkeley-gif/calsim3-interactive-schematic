import * as d3 from 'd3';

// Visualize the network schematic using D3
async function visualizeNetwork() {
  try {
    const response = await fetch('/data/json/networkSchematic.json');
    const data = await response.json();
    
    /**
     * Extract node/link arrays from the JSON structure.
     * Adjust these paths to match your actual data structure.
     */
    const nodeArray = data.Diagram.Nodes?.[0]?.Node ?? [];
    const linkArray = data.Diagram.Links?.[0]?.Link ?? [];

    const nodes = nodeArray.map((n) => {
      const bounds = n.Bounds?.[0].split(',').map(parseFloat);
      return {
        id: n.$.Id,
        label: n.Text?.[0] ?? "",
        x: bounds[0],
        y: bounds[1],
        width: bounds[2],
        height: bounds[3],
        visible: n.Visible?.[0] === "true"
      };
    });

    const nodeById = new Map(nodes.map(node => [node.id, node]));

    const links = linkArray.map((l) => {
      const sourceNode = nodeById.get(l.Origin?.[0]?.$.Id);
      const targetNode = nodeById.get(l.Destination?.[0]?.$.Id);

      if (!sourceNode || !targetNode) {
        console.warn(`Missing node for link: source ${l.Origin?.[0]?.$.Id}, target ${l.Destination?.[0]?.$.Id}`);
      }

      return {
        source: sourceNode,
        target: targetNode,
        color: l.Pen?.[0]?.Color?.[0] ?? "#555",
        width: 50
      };
    }).filter(l => l.source && l.target);

    const xExtent = d3.extent(nodes, d => d.x);
    const yExtent = d3.extent(nodes, d => d.y);

    const width = xExtent[1] - xExtent[0] + 200;
    const height = yExtent[1] - yExtent[0] + 200;

    // Clear any existing SVG (useful for hot reloading)
    d3.select('#network-container').selectAll('svg').remove();

    const svg = d3.select('#network-container')
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [xExtent[0] - 100, yExtent[0] - 100, width, height]);

    const link = svg.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => d.color)
      .attr('stroke-width', d => d.width)
      .attr('x1', d => d.source.x + d.source.width / 2)
      .attr('y1', d => d.source.y + d.source.height / 2)
      .attr('x2', d => d.target.x + d.target.width / 2)
      .attr('y2', d => d.target.y + d.target.height / 2);

    const node = svg.selectAll('rect')
      .data(nodes)
      .enter()
      .append('rect')
      .attr('x', d => d.x)
      .attr('y', d => d.y)
      .attr('width', d => d.width)
      .attr('height', d => d.height)
      .attr('fill', '#69b3a2');

    const labels = svg.selectAll('text')
      .data(nodes)
      .enter().append('text')
      .attr('x', d => d.x + d.width / 2)
      .attr('y', d => d.y + d.height / 2)
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text(d => d.label);

    console.log("Static network visualization rendered successfully!");
    
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