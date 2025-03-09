import fs from 'fs';
import { exportToCSV } from './exportData.js';

// Read the JSON file
const data = JSON.parse(fs.readFileSync('public/data/json/networkSchematic.json', 'utf8'));

// Extract nodes and links
const nodeArray = data.Diagram.Nodes?.[0]?.Node ?? [];
const linkArray = data.Diagram.Links?.[0]?.Link ?? [];

const nodes = nodeArray.map((n) => ({
  id: n.$.Id,
  label: n.Text?.[0] ?? ""
}));

const links = linkArray.map((l) => ({
  id: l.$.Id,
  sourceId: l.Origin?.[0]?.$.Id,
  targetId: l.Destination?.[0]?.$.Id
}));

// Export to CSV
exportToCSV(nodes, links);
