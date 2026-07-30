const mysql = require('mysql2/promise');

async function run() {
  const conn = await mysql.createConnection({
    host: 'c67239.sgvps.net', port: 3306,
    user: 'un1mtnf5uvkod',
    password: "k1`~%,8w&8oz",
    database: 'dbo13ju3uv0emv',
    multipleStatements: true
  });

  async function colExists(table, col) {
    const [rows] = await conn.query(
      "SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'dbo13ju3uv0emv' AND TABLE_NAME = ? AND COLUMN_NAME = ?",
      [table, col]
    );
    return rows.length > 0;
  }
  // 1. Create missing email_verification_tokens table
  console.log('1. Creating email_verification_tokens...');
  await conn.query(`CREATE TABLE IF NOT EXISTS \`email_verification_tokens\` (
    \`id\` varchar(36) NOT NULL,
    \`user_id\` varchar(36) NOT NULL,
    \`token\` varchar(64) NOT NULL,
    \`type\` enum('email_verification','password_reset') DEFAULT 'email_verification',
    \`used_at\` timestamp NULL DEFAULT NULL,
    \`expires_at\` timestamp NOT NULL,
    \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
    PRIMARY KEY (\`id\`),
    KEY \`idx_user_id\` (\`user_id\`),
    KEY \`idx_token\` (\`token\`),
    KEY \`idx_expires_at\` (\`expires_at\`),
    CONSTRAINT \`email_verif_fk_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('   OK');

  // 2. Create device_brands and device_models
  console.log('2. Creating device_brands...');
  await conn.query(`CREATE TABLE IF NOT EXISTS \`device_brands\` (
    \`id\` varchar(36) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`category_id\` varchar(36) DEFAULT NULL,
    \`logo_url\` text DEFAULT NULL,
    \`active\` tinyint(1) DEFAULT 1,
    \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
    \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (\`id\`),
    UNIQUE KEY \`name\` (\`name\`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('   OK');

  console.log('3. Creating device_models...');
  await conn.query(`CREATE TABLE IF NOT EXISTS \`device_models\` (
    \`id\` varchar(36) NOT NULL,
    \`brand_id\` varchar(36) NOT NULL,
    \`name\` varchar(100) NOT NULL,
    \`active\` tinyint(1) DEFAULT 1,
    \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
    \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (\`id\`),
    KEY \`brand_id\` (\`brand_id\`),
    CONSTRAINT \`device_models_ibfk_1\` FOREIGN KEY (\`brand_id\`) REFERENCES \`device_brands\` (\`id\`) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
  console.log('   OK');

  // 3. Add missing columns to device_access_logs
  console.log('4. Adding missing columns to device_access_logs...');
  if (!(await colExists('device_access_logs', 'action'))) {
    await conn.query("ALTER TABLE `device_access_logs` ADD COLUMN `action` varchar(64) NOT NULL AFTER `access_type`");
    console.log('   Added action');
  }
  if (!(await colExists('device_access_logs', 'location_latitude'))) {
    await conn.query("ALTER TABLE `device_access_logs` ADD COLUMN `location_latitude` double DEFAULT NULL AFTER `details`");
    console.log('   Added location_latitude');
  }
  if (!(await colExists('device_access_logs', 'location_longitude'))) {
    await conn.query("ALTER TABLE `device_access_logs` ADD COLUMN `location_longitude` double DEFAULT NULL AFTER `location_latitude`");
    console.log('   Added location_longitude');
  }
  if (!(await colExists('device_access_logs', 'metadata'))) {
    await conn.query("ALTER TABLE `device_access_logs` ADD COLUMN `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL AFTER `location_longitude`");
    console.log('   Added metadata');
  }
  console.log('   OK');

  // 4. Add read_at to notifications
  console.log('5. Adding read_at to notifications...');
  if (!(await colExists('notifications', 'read_at'))) {
    await conn.query("ALTER TABLE `notifications` ADD COLUMN `read_at` timestamp NULL DEFAULT NULL AFTER `status`");
    console.log('   Added read_at');
  }
  console.log('   OK');

  // 5. Fix NOT NULL constraints (safe since no NULL data exists)
  console.log('6. Fixing NOT NULL constraints...');
  await conn.query("ALTER TABLE `delivery_confirmations` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp()");
  await conn.query("ALTER TABLE `delivery_confirmations` MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()");
  console.log('   delivery_confirmations: created_at, updated_at -> NOT NULL');
  await conn.query("ALTER TABLE `escrow_transactions` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp()");
  await conn.query("ALTER TABLE `escrow_transactions` MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()");
  console.log('   escrow_transactions: created_at, updated_at -> NOT NULL');
  await conn.query("ALTER TABLE `seller_bank_accounts` MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp()");
  await conn.query("ALTER TABLE `seller_bank_accounts` MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()");
  console.log('   seller_bank_accounts: created_at, updated_at -> NOT NULL');
  await conn.query("ALTER TABLE `device_access_logs` MODIFY COLUMN `ip_address` varchar(64) NOT NULL");
  await conn.query("ALTER TABLE `device_access_logs` MODIFY COLUMN `access_type` enum('view','edit','delete','public_check','report','transfer') NOT NULL");
  await conn.query("ALTER TABLE `device_access_logs` MODIFY COLUMN `result` enum('success','denied','error') NOT NULL");
  console.log('   device_access_logs: ip_address, access_type, result -> NOT NULL');
  console.log('   OK');

  console.log('\nAll fixes applied successfully!');
  await conn.end();
}

run().catch(err => { console.error('ERROR:', err.message); process.exit(1); });
