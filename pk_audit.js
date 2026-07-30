const fs = require('fs');
const raw = fs.readFileSync('sql/check_it_registry.sql', 'utf8');
const parts = raw.split('CREATE TABLE ');
const results = [];
for (const part of parts) {
  const m = part.match(/^`([^`]+)`/);
  if (m) {
    const tbl = m[1];
    const hasPK = /PRIMARY\s+KEY/i.test(part) ? 1 : 0;
    results.push({ table: tbl, pk: hasPK });
  }
}
const missing = results.filter(r => !r.pk);
console.log('=== TABLES WITHOUT PRIMARY KEY ===');
missing.forEach(r => console.log(`  ${r.table}`));
console.log(`\nTotal without PK: ${missing.length}`);
console.log(`Total tables: ${results.length}`);
console.log('\n=== ALL TABLES ===');
results.forEach(r => console.log(`  ${r.pk ? 'PK' : '  '} ${r.table}`));
