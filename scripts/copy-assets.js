const fs = require('fs');
const path = require('path');

// Create directories if they don't exist
fs.mkdirSync(path.join(__dirname, '../dist/esm/fonts'), { recursive: true });
fs.mkdirSync(path.join(__dirname, '../dist/cjs/fonts'), { recursive: true });

// Copy CSS file
const cssSource = path.join(__dirname, '../lib/fonts/abc-diatype.css');
const cssDestESM = path.join(__dirname, '../dist/esm/fonts/abc-diatype.css');
const cssDestCJS = path.join(__dirname, '../dist/cjs/fonts/abc-diatype.css');

fs.copyFileSync(cssSource, cssDestESM);
fs.copyFileSync(cssSource, cssDestCJS);

// Copy WOFF2 file
const fontSource = path.join(__dirname, '../lib/fonts/ABCDiatypePlusVariable-Trial.woff2');
const fontDestESM = path.join(__dirname, '../dist/esm/fonts/ABCDiatypePlusVariable-Trial.woff2');
const fontDestCJS = path.join(__dirname, '../dist/cjs/fonts/ABCDiatypePlusVariable-Trial.woff2');

fs.copyFileSync(fontSource, fontDestESM);
fs.copyFileSync(fontSource, fontDestCJS);

console.log('Copied font assets to dist/esm/fonts/ and dist/cjs/fonts/');
