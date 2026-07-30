const fs = require('fs');
const raw = fs.readFileSync('sql/check_it_registry.sql', 'utf8');
const parts = raw.split('CREATE TABLE ');

// Only _migrations
for (const part of parts) {
  const m = part.match(/^`([^`]+)`/);
  if (!m || m[1] !== '_migrations') continue;
  
  const ddlMatch = part.match(/^[\s\S]*?ENGINE=\w+/);
  const ddl = ddlMatch ? ddlMatch[0] : '';
  
  // Show raw chars
  console.log('=== _migrations DDL char-by-char (first 200) ===');
  for (let i = 0; i < Math.min(200, ddl.length); i++) {
    const c = ddl[i];
    if (c === '\r') process.stdout.write('\\r');
    else if (c === '\n') process.stdout.write('\\n\n');
    else process.stdout.write(c);
  }
  console.log('\n');
  
  // Now test colLines regex
  const colRegex = /^\s*`[^`]+`\s+[^,]+/gm;
  let colMatch;
  console.log('=== colRegex matches ===');
  while ((colMatch = colRegex.exec(ddl)) !== null) {
    console.log(`  Match at ${colMatch.index}: [${colMatch[0]}]`);
  }
  
  // Test cm on each colLine
  const colLines = ddl.match(colRegex) || [];
  console.log(`\n=== cm regex on each colLine ===`);
  for (const line of colLines) {
    const cm = line.match(/^\s*`([^`]+)`\s+([^\s(]+)/);
    console.log(`  line: [${line}] -> cm: ${cm ? JSON.stringify([cm[1], cm[2]]) : 'NO MATCH'}`);
  }
  
  break;
}
