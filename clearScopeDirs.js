const fs = require('fs');

const path = 'C:/Users/username/AppData/Local/Temp';
const dir = fs.readdirSync(path);
const scopedDirs = dir.filter(path => path.includes('scoped'));
for (let scopedDir of scopedDirs)
    fs.rmSync(path + '/' + scopedDir, {recursive: true, force: true});