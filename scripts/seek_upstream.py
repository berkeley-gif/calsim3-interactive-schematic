import json

# Read storage.txt
with open('../data/storage.txt', 'r') as file:
    storage_items = [line.strip().replace('"', '').strip().lower() for line in file.readlines()]

# Read networkSchematic.json
with open('../public/data/json/networkSchematic.json', 'r') as file:
    json_data = json.load(file)

node_array = json_data.get('Diagram', {}).get('Nodes', [{}])[0].get('Node', [])
link_array = json_data.get('Diagram', {}).get('Links', [{}])[0].get('Link', [])

# Create a map of lowercase Text to original Text and Id
text_to_original = {node.get('Text', [''])[0].strip().lower(): (node.get('Text', [''])[0], node.get('$', {}).get('Id')) for node in node_array}

# Create a map of node Ids to their upstream nodes
upstream_map = {}
for link in link_array:
    source_id = link.get('Origin', [{}])[0].get('$', {}).get('Id')
    target_id = link.get('Destination', [{}])[0].get('$', {}).get('Id')
    if target_id and source_id:
        if target_id not in upstream_map:
            upstream_map[target_id] = []
        upstream_map[target_id].append(source_id)

# Function to find all upstream nodes
def find_upstream_nodes(node_id, visited=None):
    if visited is None:
        visited = set()
    if node_id in visited:
        return []
    visited.add(node_id)
    upstream_nodes = upstream_map.get(node_id, [])
    for upstream_node in upstream_nodes:
        upstream_nodes.extend(find_upstream_nodes(upstream_node, visited))
    return list(set(upstream_nodes))

# Match storage items to node Ids and write to output file
output_lines = []
for item in storage_items:
    original_text, node_id = text_to_original.get(item, ('Not Found', 'Not Found'))
    if node_id != 'Not Found':
        upstream_ids = find_upstream_nodes(node_id)
        output_lines.append(f"\"{original_text}\": {node_id}, {upstream_ids}")
    else:
        output_lines.append(f"\"{original_text}\": {node_id}, []")

with open('upstream_output.txt', 'w') as file:
    file.write('\n'.join(output_lines))

print('Upstream output written to upstream_output.txt')
