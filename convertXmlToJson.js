const fs = require('fs');
const xml2js = require('xml2js');
const iconv = require('iconv-lite'); // added iconv-lite

const parser = new xml2js.Parser();

fs.readFile('./data/xml/CS3_NetworkSchematic_Integrated_11.28.23.xml', null, (err, data) => {
    if (err) {
        console.error('Error reading XML file:', err);
        return;
    }

    // Decode as UTF-16BE. If your file uses UTF-16LE, change to 'UTF-16LE':
    const xmlString = iconv.decode(data, 'UTF-16BE');

    parser.parseString(xmlString, (err, result) => {
        if (err) {
            console.error('Error parsing XML:', err);
            return;
        }

        const json = JSON.stringify(result, null, 2);
        fs.writeFile('./data/json/networkSchematic.json', json, (err) => {
            if (err) {
                console.error('Error writing JSON file:', err);
                return;
            }
            console.log('XML successfully converted to JSON.');
        });
    });
});