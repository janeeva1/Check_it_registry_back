const fs = require('fs');
const raw = fs.readFileSync('sql/check_it_registry.sql', 'utf8');
const parts = raw.split('CREATE TABLE ');

// Replicate the exact logic from schema_audit.js
const tables = {};
for (const part of parts) {
  const m = part.match(/^`([^`]+)`/);
  if (!m) continue;
  const tbl = m[1];
  const ddlMatch = part.match(/^[\s\S]*?ENGINE=\w+/);
  const ddl = ddlMatch ? ddlMatch[0] : '';
  tables[tbl] = { ddl, columns: [] };

  const colLines = ddl.match(/^\s*`[^`]+`\s+[^,]+/gm) || [];
  for (const line of colLines) {
    const cm = line.match(/^\s*`([^`]+)`\s+([^\s(]+)/);
    if (cm) {
      tables[tbl].columns.push(cm[1]);
    }
  }
}

// Check specific tables
for (const name of ['_migrations', 'users', 'device_check_logs']) {
  const t = tables[name];
  if (t) {
    console.log(`=== ${name} columns ===`);
    console.log(t.columns.join(', '));
    console.log(`Has 'id': ${t.columns.includes('id')}`);
    console.log(`Has 'created_at': ${t.columns.includes('created_at')}`);
  }
}

// Check overall counts
let missingId = 0;
for (const [name, t] of Object.entries(tables)) {
  if (!t.columns.includes('id')) {
    missingId++;
  }
}
console.log(`\nTables missing 'id': ${missingId} out of ${Object.keys(tables).length}`);
