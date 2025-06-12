const fs = require('fs');
const path = require('path');

// Read package.json
const packageJson = require('../package.json');

// Generate version file
const versionContent = `// Auto-generated file - do not edit manually
export const VERSION = '${packageJson.version}';
`;

// Write to src directory
fs.writeFileSync(
  path.join(__dirname, '../lib/constants/version.ts'),
  versionContent
);

console.log(`Generated version file with version: ${packageJson.version}`);