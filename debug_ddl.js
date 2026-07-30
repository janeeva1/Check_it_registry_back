const fs = require('fs');
const raw = fs.readFileSync('sql/check_it_registry.sql', 'utf8');
const parts = raw.split('CREATE TABLE ');
for (const part of parts) {
  const m = part.match(/^`([^`]+)`/);
  if (m && m[1] === 'users') {
    const ddlMatch = part.match(/^[\s\S]*?ENGINE=\w+/);
    const ddl = ddlMatch ? ddlMatch[0] : '';
    
    // Show raw lines
    const lines = ddl.split('\n');
    console.log('=== users DDL (first 30 lines) ===');
    for (let i = 0; i < Math.min(30, lines.length); i++) {
      console.log(`L${i}: [${lines[i]}]`);
    }
    
    // Try matching columns
    const colRegex = /^\s*`([^`]+)`\s+/gm;
    let match;
    const cols = [];
    while ((match = colRegex.exec(ddl)) !== null) {
      cols.push(match[1]);
    }
    console.log(`\nColumns found by regex: ${cols.join(', ')}`);
    
    // Check if `id` is in DDL
    console.log(`Has 'id' in DDL: ${ddl.includes('`id`')}`);
    console.log(`Has PRIMARY KEY: ${/PRIMARY KEY/.test(ddl)}`);
    break;
  }
}
