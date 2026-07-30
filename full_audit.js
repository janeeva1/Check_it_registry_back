const fs = require('fs');
const mysql = require('mysql2/promise');
const path = require('path');

async function main() {
  // ===== PARSE SQL DUMP =====
  const raw = fs.readFileSync(path.join(__dirname, 'sql/check_it_registry.sql'), 'utf8');
  const parts = raw.split('CREATE TABLE ');
  const dumpTables = {};
  for (const part of parts) {
    const m = part.match(/^`([^`]+)`/);
    if (!m) continue;
    const tbl = m[1];
    const ddlMatch = part.match(/^[\s\S]*?ENGINE=\w+/);
    const ddl = ddlMatch ? ddlMatch[0] : '';
    dumpTables[tbl] = { ddl, columns: {} };
    const lines = ddl.split(/\r?\n/);
    for (const line of lines) {
      const colMatch = line.match(/^\s*`([^`]+)`\s+([^\s(]+)/);
      if (colMatch) {
        const name = colMatch[1];
        const type = colMatch[2].toLowerCase();
        const nullable = /DEFAULT NULL/.test(line) || (!/NOT NULL/.test(line) && name !== 'id');
        const defaultVal = line.match(/DEFAULT\s+(\S+?)(?:,|$)/);
        const autoInc = /AUTO_INCREMENT/i.test(line);
        dumpTables[tbl].columns[name] = {
          type, nullable, default: defaultVal ? defaultVal[1].replace(/^'|'$/g,'').replace(/,/g,'') : null, autoInc
        };
      }
    }
  }

  // ===== CONNECT TO LIVE DB =====
  const conn = await mysql.createConnection({
    host: 'c67239.sgvps.net',
    port: 3306,
    user: 'un1mtnf5uvkod',
    password: "k1`~%,8w&8oz",
    database: 'dbo13ju3uv0emv'
  });

  // Get all tables
  const [tables] = await conn.query(
    "SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = 'dbo13ju3uv0emv' AND TABLE_TYPE = 'BASE TABLE' ORDER BY TABLE_NAME"
  );
  const liveTableNames = tables.map(r => r.TABLE_NAME);

  // Get all columns
  const [cols] = await conn.query(
    "SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY, COLUMN_DEFAULT, EXTRA, CHARACTER_SET_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo13ju3uv0emv' AND TABLE_NAME NOT IN ('v_user_stats') ORDER BY TABLE_NAME, ORDINAL_POSITION"
  );
  const liveTables = {};
  for (const row of cols) {
    if (!liveTables[row.TABLE_NAME]) liveTables[row.TABLE_NAME] = { columns: {} };
    liveTables[row.TABLE_NAME].columns[row.COLUMN_NAME] = {
      type: row.COLUMN_TYPE.toLowerCase(),
      nullable: row.IS_NULLABLE === 'YES',
      key: row.COLUMN_KEY,
      default: row.COLUMN_DEFAULT
    };
  }

  // Get PRIMARY KEY info
  const [pks] = await conn.query(
    "SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_TYPE = 'PRIMARY KEY' AND TABLE_SCHEMA = 'dbo13ju3uv0emv'"
  );
  const pkSet = new Set(pks.map(r => r.TABLE_NAME));

  await conn.end();

  // ===== COMPARE =====
  const allDumpNames = Object.keys(dumpTables);
  const allLiveBase = liveTableNames;

  let issuesFound = 0;

  console.log('======================================================================');
  console.log('FULL SCHEMA AUDIT: Live DB vs SQL Dump');
  console.log('======================================================================\n');

  // Tables in dump but not in live DB
  const dumpOnly = allDumpNames.filter(t => !liveTables[t]);
  if (dumpOnly.length) {
    console.log(`[MISSING TABLES] In dump but NOT in live DB (${dumpOnly.length}):`);
    dumpOnly.forEach(t => console.log(`  - ${t}`));
    issuesFound += dumpOnly.length;
  } else {
    console.log('[OK] All dump tables exist in live DB');
  }
  console.log();

  // Tables in live DB but not in dump
  const liveOnly = allLiveBase.filter(t => !dumpTables[t]);
  if (liveOnly.length) {
    console.log(`[EXTRA TABLES] In live DB but NOT in dump (${liveOnly.length}):`);
    liveOnly.forEach(t => console.log(`  - ${t}`));
  } else {
    console.log('[OK] No extra tables in live DB');
  }
  console.log();

  // Compare columns for shared tables
  const shared = allDumpNames.filter(t => liveTables[t]);
  console.log(`Comparing columns for ${shared.length} shared tables...\n`);

  for (const tbl of shared) {
    const dumpCols = dumpTables[tbl].columns;
    const liveCols = liveTables[tbl].columns;
    const dumpNames = Object.keys(dumpCols);
    const liveNames = Object.keys(liveCols);

    // Missing columns
    for (const name of dumpNames) {
      if (!liveCols[name]) {
        const c = dumpCols[name];
        console.log(`  [MISSING COLUMN] ${tbl}.${name} (${c.type}${c.nullable ? '' : ' NOT NULL'})`);
        issuesFound++;
      }
    }

    // Extra columns
    for (const name of liveNames) {
      if (!dumpCols[name]) {
        console.log(`  [EXTRA COLUMN] ${tbl}.${name} (${liveCols[name].type})`);
      }
    }

    // Type/nullable/auto_increment mismatches
    for (const name of dumpNames) {
      const dc = dumpCols[name];
      const lc = liveCols[name];
      if (!lc) continue;

      const dBaseType = dc.type.replace(/\(.*\)/g, '').trim();
      const lBaseType = lc.type.replace(/\(.*\)/g, '').trim();
      if (dBaseType !== lBaseType &&
          !(dBaseType === 'varchar' && lBaseType === 'varchar') &&
          !(dBaseType === 'int' && (lBaseType === 'int' || lBaseType === 'int unsigned')) &&
          !(lBaseType === 'int' && (dBaseType === 'int' || dBaseType === 'int unsigned'))) {
        console.log(`  [TYPE MISMATCH] ${tbl}.${name}: dump="${dc.type}" vs live="${lc.type}"`);
        issuesFound++;
      }

      // Nullable mismatch
      if (dc.nullable !== lc.nullable) {
        console.log(`  [NULL MISMATCH] ${tbl}.${name}: dump=${dc.nullable} vs live=${lc.nullable}`);
        issuesFound++;
      }

      // PRIMARY KEY check
      if (name === 'id' && dc.nullable === false && pkSet.has(tbl) && lc.key !== 'PRI') {
        console.log(`  [PK ISSUE] ${tbl}.${name}: has PK constraint but column_key=${lc.key}`);
      }
    }
  }

  // PRIMARY KEY completeness
  console.log('\n--- PRIMARY KEY COVERAGE ---');
  const withPK = allLiveBase.filter(t => pkSet.has(t)).length;
  const withoutPK = allLiveBase.filter(t => !pkSet.has(t));
  console.log(`Tables with PK: ${withPK}/${allLiveBase.length}`);
  if (withoutPK.length) {
    console.log(`Tables WITHOUT PK (${withoutPK.length}):`);
    withoutPK.forEach(t => console.log(`  - ${t}`));
  }

  console.log(`\n======================================================================`);
  console.log(`Total issues found: ${issuesFound}`);
  console.log(`======================================================================`);
}

main().catch(err => { console.error(err); process.exit(1); });
