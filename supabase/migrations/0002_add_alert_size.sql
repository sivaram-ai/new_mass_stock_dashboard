-- =============================================================================
-- 0002 — Low stock alerts
--
-- Adds items.alert_size: the stock level at or below which an item should be
-- flagged as running low. Forward migration only; see
-- 0002_add_alert_size_rollback.sql to undo.
--
-- Backward compatible and idempotent:
--   * ALTER TABLE ... ADD COLUMN IF NOT EXISTS — no table is recreated and no
--     existing row is rewritten.
--   * DEFAULT 0 means every pre-existing item starts with alerts switched off,
--     so behaviour is unchanged until an admin sets a threshold.
--   * Nothing else references the column, so older application builds keep
--     working against a migrated database.
-- =============================================================================

alter table items
    add column if not exists alert_size integer default 0;

comment on column items.alert_size is
    'Low-stock threshold. When > 0 and current_stock <= alert_size the item is '
    'highlighted as running low. NULL or 0 disables the alert for this item.';

-- A negative threshold has no meaning and would never match; reject it at the
-- database rather than relying on every caller to validate.
do $$
begin
    if not exists (
        select 1 from pg_constraint where conname = 'items_alert_size_non_negative'
    ) then
        alter table items
            add constraint items_alert_size_non_negative
            check (alert_size is null or alert_size >= 0);
    end if;
end $$;

-- Partial index: only rows with alerts configured are ever of interest, and in
-- a typical catalogue that is a small minority, so this stays far smaller than
-- a full index while still serving "which items have alerts set up?".
create index if not exists items_alert_size_idx
    on items (alert_size)
    where alert_size > 0;
