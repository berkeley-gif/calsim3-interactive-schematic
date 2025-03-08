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

    const links = linkArray.map((l) => ({
      sourceId: l.Origin?.[0]?.$.Id,
      targetId: l.Destination?.[0]?.$.Id,
      color: l.Pen?.[0]?.Color?.[0] ?? "#555",
      width: 50
    })).filter(l => nodeById.has(l.sourceId) && nodeById.has(l.targetId));

    const linkedNodes = new Set(links.flatMap(l => [l.sourceId, l.targetId]));
    const unlinkedNodes = nodes.filter(node => !linkedNodes.has(node.id));

    if (unlinkedNodes.length > 0) {
      console.warn('Nodes without links:', unlinkedNodes.map(node => node.id));

      // Create a downloadable JSON file for unlinked nodes
      const blob = new Blob([JSON.stringify(unlinkedNodes.map(node => node.id), null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);

      const downloadLink = document.createElement('a');
      downloadLink.href = url;
      downloadLink.download = 'unlinkedNodes.json';
      downloadLink.textContent = 'Download Unlinked Nodes JSON';
      downloadLink.className = 'download-button';
      document.body.appendChild(downloadLink);
    }

    // Check explicitly for links referencing nodes 147 and 148
    const specificNodeIds = new Set(['147', '148']);
    const specificLinks = linkArray.filter(l => specificNodeIds.has(l.Origin?.[0]?.$.Id) || specificNodeIds.has(l.Destination?.[0]?.$.Id));

    if (specificLinks.length > 0) {
      console.log('Links referencing nodes 147 or 148:', specificLinks);
    } else {
      console.warn('No links found referencing nodes 147 or 148.');
    }

    // Log all unique shape types
    const shapeTypes = new Set(nodeArray.map(n => n.Shape?.[0]?.$.Id).filter(Boolean));
    console.log('Unique shape types:', Array.from(shapeTypes));

    // Explicitly set SVG viewBox to ensure visibility
    const padding = 200;
    const xExtent = d3.extent(nodes, d => d.x);
    const yExtent = d3.extent(nodes, d => d.y);

    const svgWidth = xExtent[1] - xExtent[0] + 2 * padding;
    const svgHeight = yExtent[1] - yExtent[0] + 2 * padding;

    d3.select('#network-container').selectAll('svg').remove();

    const svgContainer = d3.select('#network-container')
      .append('svg')
      .attr('width', '100%')
      .attr('height', '100%')
      .attr('viewBox', [xExtent[0] - padding, yExtent[0] - padding, svgWidth, svgHeight]);

    const svg = svgContainer.append('g');

    // Add zoom and pan functionality
    const zoom = d3.zoom()
      .scaleExtent([0.1, 50])
      .on('zoom', (event) => {
        svg.attr('transform', event.transform);
      });

    svgContainer.call(zoom);

    // Add zoom controls
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    zoomControls.innerHTML = `
      <button id="zoom-in">Zoom In</button>
      <button id="zoom-out">Zoom Out</button>
    `;
    document.body.appendChild(zoomControls);

    d3.select('#zoom-in').on('click', () => {
      svgContainer.transition().call(zoom.scaleBy, 2);
    });

    d3.select('#zoom-out').on('click', () => {
      svgContainer.transition().call(zoom.scaleBy, 0.5);
    });

    // Explicitly reorder SVG groups for correct layering
    const linkGroup = svg.append('g').attr('class', 'links');
    const nodeGroup = svg.append('g').attr('class', 'nodes');

    // Define arrow markers explicitly
    svg.append('defs').append('marker')
      .attr('id', 'end')
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 15)
      .attr('refY', 0)
      .attr('markerWidth', 6)
      .attr('markerHeight', 6)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-5L10,0L0,5')
      .attr('fill', '#555');

    // Render links with increased width and arrow markers
    linkGroup.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', d => d.color || '#555')
      .attr('stroke-width', 5)
      .attr('opacity', 1)
      .attr('x1', d => nodeById.get(d.sourceId).x + nodeById.get(d.sourceId).width / 2)
      .attr('y1', d => nodeById.get(d.sourceId).y + nodeById.get(d.sourceId).height / 2)
      .attr('x2', d => nodeById.get(d.targetId).x + nodeById.get(d.targetId).width / 2)
      .attr('y2', d => nodeById.get(d.targetId).y + nodeById.get(d.targetId).height / 2)
      .attr('marker-end', 'url(#end)');

    // Render nodes after links
    nodeGroup.selectAll('.node')
      .data(nodes)
      .enter()
      .append('g')
      .attr('class', 'node');

    // Properly render nodes within nodeGroup
    nodeGroup.selectAll('.node')
      .each(function(node) {
        const originalNode = nodeArray.find(n => n.$.Id === node.id);
        const shapeType = originalNode?.Shape?.[0]?.$.Id;
        const pen = originalNode?.Pen?.[0];
        const strokeColor = pen?.Color?.[0] ?? '#000';
        const strokeWidth = parseFloat(pen?.Width?.[0]) || 2;

        let fillColor;
        switch (shapeType) {
          case 'Ellipse': fillColor = 'yellow'; break;
          case 'Alternative': fillColor = 'blue'; break;
          case 'Cylinder': fillColor = 'orange'; break;
          default: fillColor = '#69b3a2';
        }

        switch (shapeType) {
          case 'Ellipse':
            d3.select(this).append('ellipse')
              .attr('cx', node.x + node.width / 2)
              .attr('cy', node.y + node.height / 2)
              .attr('rx', node.width / 2)
              .attr('ry', node.height / 2)
              .attr('fill', fillColor)
              .attr('stroke', strokeColor)
              .attr('stroke-width', strokeWidth);
            break;

          case 'Alternative':
            d3.select(this).append('polygon')
              .attr('points', `${node.x + node.width / 2},${node.y} ${node.x},${node.y + node.height} ${node.x + node.width},${node.y + node.height}`)
              .attr('fill', fillColor)
              .attr('stroke', strokeColor)
              .attr('stroke-width', strokeWidth);
            break;

          case 'Cylinder':
            d3.select(this).append('rect')
              .attr('x', node.x)
              .attr('y', node.y)
              .attr('width', node.width)
              .attr('height', node.height)
              .attr('rx', node.width / 2)
              .attr('ry', node.width / 4)
              .attr('fill', fillColor)
              .attr('stroke', strokeColor)
              .attr('stroke-width', strokeWidth);
            break;

          default:
            d3.select(this).append('rect')
              .attr('x', node.x)
              .attr('y', node.y)
              .attr('width', node.width)
              .attr('height', node.height)
              .attr('fill', fillColor)
              .attr('stroke', strokeColor)
              .attr('stroke-width', strokeWidth);
        }

        // Append labels
        d3.select(this).append('text')
          .attr('x', node.x + node.width / 2)
          .attr('y', node.y + node.height / 2)
          .attr('text-anchor', 'middle')
          .attr('alignment-baseline', 'middle')
          .text(node.label);
      });

    console.log("Static network visualization rendered successfully!");
    
    // Add a status message to the page
    const status = document.createElement('div');
    status.className = 'status-message';
    status.textContent = `Rendered ${nodes.length} nodes and ${links.length} links`;
    document.body.appendChild(status);
    
    // Add tooltip div
    const tooltip = d3.select('body').append('div')
      .attr('class', 'tooltip')
      .style('position', 'absolute')
      .style('opacity', 0)
      .style('background-color', 'rgba(0,0,0,0.7)')
      .style('color', '#fff')
      .style('padding', '5px')
      .style('border-radius', '5px')
      .style('pointer-events', 'none');

    // Properly bind data and add tooltip interaction to all node shapes
    nodeGroup.selectAll('rect, ellipse, polygon')
      .data(nodes)
      .on('mouseover', (event, d) => {
        tooltip.transition().duration(200).style('opacity', 0.9);
        tooltip.html(`ID: ${d.id}<br>Label: ${d.label}<br>Position: (${d.x}, ${d.y})`)
          .style('left', (event.pageX + 10) + 'px')
          .style('top', (event.pageY - 28) + 'px');
      })
      .on('mouseout', () => {
        tooltip.transition().duration(500).style('opacity', 0);
      });

    // Add detailed logging for specific problematic link
    const problematicLink = links.find(l => l.sourceId === '1285' && l.targetId === '1827');
    if (problematicLink) {
      const sourceNode = nodeById.get(problematicLink.sourceId);
      const targetNode = nodeById.get(problematicLink.targetId);
      console.log(`Problematic link coordinates: source (${sourceNode.x}, ${sourceNode.y}), target (${targetNode.x}, ${targetNode.y})`);
    } else {
      console.warn('Problematic link between nodes 1285 and 1827 not found.');
    }

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