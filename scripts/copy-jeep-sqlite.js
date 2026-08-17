const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const jeepSource = path.join(
  projectRoot,
  'node_modules',
  'jeep-sqlite',
  'dist',
  'jeep-sqlite'
);
const jeepTarget = path.join(projectRoot, 'src', 'assets', 'jeep-sqlite');
const wasmSource = path.join(
  projectRoot,
  'node_modules',
  'sql.js',
  'dist',
  'sql-wasm.wasm'
);
const wasmTarget = path.join(projectRoot, 'src', 'assets', 'sql-wasm.wasm');

if (!fs.existsSync(jeepSource)) {
  throw new Error(`jeep-sqlite assets not found: ${jeepSource}`);
}

fs.mkdirSync(path.dirname(jeepTarget), { recursive: true });
fs.cpSync(jeepSource, jeepTarget, { recursive: true, force: true });
fs.copyFileSync(wasmSource, wasmTarget);

console.log('Copied jeep-sqlite web assets.');
