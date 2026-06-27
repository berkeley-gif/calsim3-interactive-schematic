import fs from 'fs';

// Function to export node and link data to separate CSV files
export function exportToCSV(nodes, links) {
  const nodeHeaders = ['Schematic_Node_ID', 'Schematic_Text'];
  const linkHeaders = ['Schematic_Link_ID', 'Schematic_Origin_ID', 'Schematic_Destination_ID'];

  const nodeRows = nodes.map(node => [node.id, node.label]);
  const linkRows = links.map(link => [link.id, link.sourceId, link.targetId]);

  const nodeCsvContent = [nodeHeaders, ...nodeRows].map(e => e.join(",")).join("\n");
  const linkCsvContent = [linkHeaders, ...linkRows].map(e => e.join(",")).join("\n");

  // Write nodes to CSV
  fs.writeFileSync('data/nodes_data.csv', nodeCsvContent, 'utf8');

  // Write links to CSV
  fs.writeFileSync('data/links_data.csv', linkCsvContent, 'utf8');
} 