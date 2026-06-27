import json

# Read storage.txt
with open('../data/storage.txt', 'r') as file:
    storage_items = [line.strip().replace('"', '').strip().lower() for line in file.readlines()]

# Read networkSchematic.json
with open('../public/data/json/networkSchematic.json', 'r') as file:
    json_data = json.load(file)

node_array = json_data.get('Diagram', {}).get('Nodes', [{}])[0].get('Node', [])

# Create a map of lowercase Text to original Text and Id
text_to_original = {node.get('Text', [''])[0].strip().lower(): (node.get('Text', [''])[0], node.get('$', {}).get('Id')) for node in node_array}

# Match storage items to node Ids and write to output file
output_lines = [
    f"\"{text_to_original.get(item, ('Not Found', 'Not Found'))[0]}\": {text_to_original.get(item, ('Not Found', 'Not Found'))[1]}"
    for item in storage_items
]

with open('output.txt', 'w') as file:
    file.write('\n'.join(output_lines))

print('Output written to output.txt')
