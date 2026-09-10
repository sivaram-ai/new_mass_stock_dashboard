-- =============================================================================
-- 0002 ROLLBACK — remove low stock alerts
--
-- Reverses 0002_add_alert_size.sql. Safe to run more than once.
--
-- WARNING: dropping the column discards every configured threshold. If you may
-- want them back, snapshot them first:
--
--   create table if not exists items_alert_size_backup as
--   select id, alert_size from items where alert_size is not null and alert_size > 0;
--
-- Application builds from 0002 onward read items.alert_size, so deploy the
-- previous build before running this.
-- =============================================================================

drop index if exists items_alert_size_idx;

alter table items
    drop constraint if exists items_alert_size_non_negative;

alter table items
    drop column if exists alert_size;
