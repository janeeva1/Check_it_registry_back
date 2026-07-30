-- =====================================================
-- SCHEMA FIXES: Align live DB with reference SQL dump
-- =====================================================

-- 1. MISSING TABLES (needed by backend code)
-- email_verification_tokens: used by EmailVerificationService.js
CREATE TABLE IF NOT EXISTS `email_verification_tokens` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `token` varchar(64) NOT NULL,
  `type` enum('email_verification','password_reset') DEFAULT 'email_verification',
  `used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_token` (`token`),
  KEY `idx_expires_at` (`expires_at`),
  CONSTRAINT `email_verif_fk_user` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 2. MISSING COLUMNS
-- device_access_logs: add missing columns
ALTER TABLE `device_access_logs`
  ADD COLUMN IF NOT EXISTS `action` varchar(64) NOT NULL AFTER `access_type`,
  ADD COLUMN IF NOT EXISTS `location_latitude` double DEFAULT NULL AFTER `details`,
  ADD COLUMN IF NOT EXISTS `location_longitude` double DEFAULT NULL AFTER `location_latitude`,
  ADD COLUMN IF NOT EXISTS `metadata` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`metadata`)) AFTER `location_longitude`;

-- notifications: add missing read_at column
ALTER TABLE `notifications`
  ADD COLUMN IF NOT EXISTS `read_at` timestamp NULL DEFAULT NULL AFTER `status`;

-- 3. CREATE device_brands AND device_models (reference tables from dump)
-- These are used by admin-system.js
CREATE TABLE IF NOT EXISTS `device_brands` (
  `id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `category_id` varchar(36) DEFAULT NULL,
  `logo_url` text DEFAULT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `device_models` (
  `id` varchar(36) NOT NULL,
  `brand_id` varchar(36) NOT NULL,
  `name` varchar(100) NOT NULL,
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `brand_id` (`brand_id`),
  CONSTRAINT `device_models_ibfk_1` FOREIGN KEY (`brand_id`) REFERENCES `device_brands` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 4. Make columns NOT NULL where they should be (safe ones only)
-- These columns have no NULLs in existing data so it's safe to alter

-- delivery_confirmations.created_at, updated_at
ALTER TABLE `delivery_confirmations`
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp();

-- escrow_transactions.created_at, updated_at
ALTER TABLE `escrow_transactions`
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp();

-- seller_bank_accounts.created_at, updated_at
ALTER TABLE `seller_bank_accounts`
  MODIFY COLUMN `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  MODIFY COLUMN `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp();

-- device_access_logs: make ip_address and access_type NOT NULL
ALTER TABLE `device_access_logs`
  MODIFY COLUMN `ip_address` varchar(64) NOT NULL,
  MODIFY COLUMN `access_type` enum('view','edit','delete','public_check','report','transfer') NOT NULL,
  MODIFY COLUMN `result` enum('success','denied','error') NOT NULL;
