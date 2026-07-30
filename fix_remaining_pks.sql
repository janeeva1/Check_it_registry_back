-- Fix remaining 5 tables without PRIMARY KEY

-- admin_dashboard_summary: no id column, add one
ALTER TABLE `admin_dashboard_summary` ADD COLUMN `id` int NOT NULL AUTO_INCREMENT FIRST, ADD PRIMARY KEY (`id`);

-- device_summary: nullable id, make NOT NULL then add PK
ALTER TABLE `device_summary` MODIFY COLUMN `id` varchar(36) NOT NULL;
ALTER TABLE `device_summary` ADD PRIMARY KEY (`id`);

-- report_summary
ALTER TABLE `report_summary` MODIFY COLUMN `id` varchar(36) NOT NULL;
ALTER TABLE `report_summary` ADD PRIMARY KEY (`id`);

-- v_device_summary
ALTER TABLE `v_device_summary` MODIFY COLUMN `id` varchar(36) NOT NULL;
ALTER TABLE `v_device_summary` ADD PRIMARY KEY (`id`);

-- v_security_events
ALTER TABLE `v_security_events` MODIFY COLUMN `id` varchar(36) NOT NULL;
ALTER TABLE `v_security_events` ADD PRIMARY KEY (`id`);
