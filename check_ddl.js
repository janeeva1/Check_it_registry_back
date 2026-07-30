const fs = require('fs');
const raw = fs.readFileSync('sql/check_it_registry.sql', 'utf8');
const parts = raw.split('CREATE TABLE ');
const suspects = ['admin_activity_log', 'device_check_logs', 'delivery_confirmations', 'device_access_logs', 'suspicious_activity_alerts', 'system_settings'];
for (const part of parts) {
  const m = part.match(/^`([^`]+)`/);
  if (m && suspects.includes(m[1])) {
    const ddlMatch = part.match(/^[\s\S]*?ENGINE=\w+/);
    const ddl = ddlMatch ? ddlMatch[0] : part.substring(0, 1500);
    console.log(`\n=== ${m[1]} ===`);
    console.log(ddl);
    console.log(`Has PRIMARY KEY in DDL: ${/PRIMARY\s+KEY/i.test(ddl)}`);
  }
}
