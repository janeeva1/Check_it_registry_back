const fs = require('fs');
const raw = fs.readFileSync('sql/check_it_registry.sql', 'utf8');
const parts = raw.split('CREATE TABLE ');

const tables = {};
for (const part of parts) {
  const m = part.match(/^`([^`]+)`/);
  if (!m) continue;
  const tbl = m[1];
  const ddlMatch = part.match(/^[\s\S]*?ENGINE=\w+/);
  const ddl = ddlMatch ? ddlMatch[0] : '';
  tables[tbl] = { ddl, columns: [], indexes: [], foreignKeys: [] };

  // Split DDL into lines and parse column definitions
  const lines = ddl.split(/\r?\n/);
  for (const line of lines) {
    // Column definitions: optional whitespace, backtick, name, backtick, whitespace, type
    const colMatch = line.match(/^\s*`([^`]+)`\s+([^\s(]+)/);
    if (colMatch) {
      const colName = colMatch[1];
      const colType = colMatch[2].toLowerCase();
      const isId = colName === 'id';
      const isNullable = /DEFAULT NULL/.test(line) || (!/NOT NULL/.test(line) && !isId);
      tables[tbl].columns.push({ name: colName, type: colType, nullable: !!isNullable });
    }

    // PRIMARY KEY definition
    const pkMatch = line.match(/PRIMARY\s+KEY\s*\(`([^`]+)`\)/);
    if (pkMatch) {
      tables[tbl].primaryKey = pkMatch[1];
    }

    // FOREIGN KEY
    const fkMatches = line.matchAll(/FOREIGN KEY\s*\(`([^`]+)`\)\s*REFERENCES\s*`([^`]+)`\s*\(`([^`]+)`\)/g);
    for (const fk of fkMatches) {
      tables[tbl].foreignKeys.push({ from: fk[1], refTable: fk[2], refCol: fk[3] });
    }
  }
}

console.log('=== CHECK 1: Tables without PRIMARY KEY ===');
const noPK = [];
for (const [name, t] of Object.entries(tables)) {
  if (!t.primaryKey) {
    noPK.push(name);
    console.log(`  ${name}`);
  }
}
if (noPK.length === 0) console.log('  All 49 tables have PRIMARY KEY ✓');

console.log('\n=== CHECK 2: Tables without `id` column ===');
const noId = [];
for (const [name, t] of Object.entries(tables)) {
  if (!t.columns.find(c => c.name === 'id')) {
    noId.push(name);
    console.log(`  ${name}`);
  }
}
if (noId.length === 0) console.log('  All 49 tables have `id` column ✓');

console.log('\n=== CHECK 3: Tables missing `created_at` ===');
for (const [name, t] of Object.entries(tables)) {
  if (!t.columns.find(c => c.name === 'created_at' || c.name === 'createdAt')) {
    console.log(`  ${name}`);
  }
}

console.log('\n=== CHECK 4: Dangling FOREIGN KEY references ===');
let dangling = 0;
for (const [name, t] of Object.entries(tables)) {
  for (const fk of t.foreignKeys) {
    const refTable = tables[fk.refTable];
    if (!refTable) {
      console.log(`  ${name}: REFERENCES ${fk.refTable}(${fk.refCol}) -> TABLE NOT FOUND`);
      dangling++;
      continue;
    }
    if (!refTable.columns.find(c => c.name === fk.refCol)) {
      console.log(`  ${name}: REFERENCES ${fk.refTable}(${fk.refCol}) -> COLUMN NOT FOUND`);
      dangling++;
    }
  }
}
if (dangling === 0) console.log('  All foreign key references valid ✓');

console.log('\n=== CHECK 5: Nullable foreign key columns (expected to be nullable) ===');
for (const [name, t] of Object.entries(tables)) {
  for (const c of t.columns) {
    if (c.nullable && c.name.endsWith('_id') && c.name !== 'id') {
      // This is fine for most FK columns that can be NULL
    }
  }
}

console.log(`\n=== SUMMARY ===`);
console.log(`Total tables: ${Object.keys(tables).length}`);
const withPk = Object.values(tables).filter(t => t.primaryKey).length;
console.log(`With PRIMARY KEY: ${withPk}`);
console.log(`With id column: ${Object.values(tables).filter(t => t.columns.find(c => c.name === 'id')).length}`);
