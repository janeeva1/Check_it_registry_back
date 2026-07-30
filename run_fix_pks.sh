-- Run all PK fixes in sequence
-- First check for duplicate IDs before adding constraints

SELECT TABLE_NAME, COUNT(*) AS duplicates
FROM (
  SELECT 'api_keys' AS TABLE_NAME, id FROM api_keys WHERE id IS NOT NULL UNION ALL
  SELECT 'audit_logs', id FROM audit_logs WHERE id IS NOT NULL UNION ALL
  SELECT 'data_exports', id FROM data_exports WHERE id IS NOT NULL UNION ALL
  SELECT 'device_categories', id FROM device_categories WHERE id IS NOT NULL UNION ALL
  SELECT 'device_check_logs', id FROM device_check_logs WHERE id IS NOT NULL UNION ALL
  SELECT 'device_checks', id FROM device_checks WHERE id IS NOT NULL UNION ALL
  SELECT 'device_transfers', id FROM device_transfers WHERE id IS NOT NULL UNION ALL
  SELECT 'device_verification_history', id FROM device_verification_history WHERE id IS NOT NULL UNION ALL
  SELECT 'device_verifications', id FROM device_verifications WHERE id IS NOT NULL UNION ALL
  SELECT 'devices', id FROM devices WHERE id IS NOT NULL UNION ALL
  SELECT 'imei_checks', id FROM imei_checks WHERE id IS NOT NULL UNION ALL
  SELECT 'kyc_batches', id FROM kyc_batches WHERE id IS NOT NULL UNION ALL
  SELECT 'kyc_verifications', id FROM kyc_verifications WHERE id IS NOT NULL UNION ALL
  SELECT 'landing_content', id FROM landing_content WHERE id IS NOT NULL UNION ALL
  SELECT 'law_enforcement_agencies', id FROM law_enforcement_agencies WHERE id IS NOT NULL UNION ALL
  SELECT 'marketplace_listings', id FROM marketplace_listings WHERE id IS NOT NULL UNION ALL
  SELECT 'marketplace_messages', id FROM marketplace_messages WHERE id IS NOT NULL UNION ALL
  SELECT 'migrations', id FROM migrations WHERE id IS NOT NULL UNION ALL
  SELECT 'notification_queue', id FROM notification_queue WHERE id IS NOT NULL UNION ALL
  SELECT 'notification_settings', id FROM notification_settings WHERE id IS NOT NULL UNION ALL
  SELECT 'notifications', id FROM notifications WHERE id IS NOT NULL UNION ALL
  SELECT 'otps', id FROM otps WHERE id IS NOT NULL UNION ALL
  SELECT 'ownership_transfers', id FROM ownership_transfers WHERE id IS NOT NULL UNION ALL
  SELECT 'payment_methods', id FROM payment_methods WHERE id IS NOT NULL UNION ALL
  SELECT 'push_subscriptions', id FROM push_subscriptions WHERE id IS NOT NULL UNION ALL
  SELECT 'recovery_agents', id FROM recovery_agents WHERE id IS NOT NULL UNION ALL
  SELECT 'recovery_services', id FROM recovery_services WHERE id IS NOT NULL UNION ALL
  SELECT 'reports', id FROM reports WHERE id IS NOT NULL UNION ALL
  SELECT 'suspicious_activity_alerts', id FROM suspicious_activity_alerts WHERE id IS NOT NULL UNION ALL
  SELECT 'system_alerts', id FROM system_alerts WHERE id IS NOT NULL UNION ALL
  SELECT 'system_notifications', id FROM system_notifications WHERE id IS NOT NULL UNION ALL
  SELECT 'system_settings', id FROM system_settings WHERE id IS NOT NULL UNION ALL
  SELECT 'transactions', id FROM transactions WHERE id IS NOT NULL UNION ALL
  SELECT 'user_preferences', id FROM user_preferences WHERE id IS NOT NULL UNION ALL
  SELECT 'user_sessions', id FROM user_sessions WHERE id IS NOT NULL UNION ALL
  SELECT 'user_suspensions', id FROM user_suspensions WHERE id IS NOT NULL
) AS all_ids
GROUP BY TABLE_NAME, id
HAVING COUNT(*) > 1;
