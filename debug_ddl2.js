const fs = require('fs');
const raw = fs.readFileSync('sql/check_it_registry.sql', 'utf8');
const parts = raw.split('CREATE TABLE ');

// Check _migrations
for (const part of parts) {
  const m = part.match(/^`([^`]+)`/);
  if (m && m[1] === '_migrations') {
    const ddlMatch = part.match(/^[\s\S]*?ENGINE=\w+/);
    const ddl = ddlMatch ? ddlMatch[0] : '';
    const lines = ddl.split('\n');
    console.log('=== _migrations DDL ===');
    for (let i = 0; i < Math.min(20, lines.length); i++) {
      console.log(`L${i}: [${lines[i]}]`);
    }
    // Test regex
    const colRegex = /^\s*`[^`]+`\s+[^,]+/gm;
    const matches = ddl.match(colRegex);
    console.log(`\nMatched ${matches ? matches.length : 0} column lines`);
    
    // Try simpler approach
    const allBacktick = ddl.match(/`([^`]+)`/g);
    console.log(`All backtick names: ${allBacktick ? allBacktick.join(', ') : 'none'}`);
    break;
  }
}
