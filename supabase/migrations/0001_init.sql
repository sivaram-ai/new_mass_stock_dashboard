-- =============================================================================
-- New Mass Stock Dashboard — initial schema
-- Idempotent: safe to run more than once against the same project.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- 1. Custom roles
-- -----------------------------------------------------------------------------
create table if not exists custom_roles (
    id          uuid default gen_random_uuid() primary key,
    role_name   varchar(50) not null unique,
    description text,
    created_at  timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into custom_roles (role_name, description) values
    ('Admin',         'Full system access, manage roles, view all dashboards'),
    ('Manager',       'Can add items and adjust stock levels'),
    ('Kitchen Staff', 'Can only debit items consumed by the kitchen')
on conflict (role_name) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Profiles  (1:1 with auth.users)
--    NOTE: the original spec had `DROP TABLE IF EXISTS profiles` here. That is
--    destructive on re-run, so this migration creates it only if absent.
--    `full_name` is an addition — the global layout has to show a person's name.
-- -----------------------------------------------------------------------------
create table if not exists profiles (
    id         uuid references auth.users on delete cascade primary key,
    email      text not null,
    full_name  text,
    role_id    uuid references custom_roles(id) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

alter table profiles add column if not exists full_name text;
create index if not exists profiles_role_id_idx on profiles (role_id);

-- -----------------------------------------------------------------------------
-- 3. Categories
-- -----------------------------------------------------------------------------
create table if not exists categories (
    id         uuid default gen_random_uuid() primary key,
    name       varchar(100) not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- -----------------------------------------------------------------------------
-- 4. Items
-- -----------------------------------------------------------------------------
create table if not exists items (
    id            uuid default gen_random_uuid() primary key,
    name          varchar(255) not null,
    shortcut_code varchar(50) unique,
    category_id   uuid references categories(id) on delete set null,
    size          varchar(50),
    unit          varchar(50),                -- count | weight | lt | ...
    current_stock numeric default 0,
    alert_size    integer default 0,        -- low-stock threshold; 0/NULL = off
    is_important  boolean default false,
    display_order integer default 0,
    created_at    timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Added by migration 0002. Repeated here so a fresh run of this file alone
-- produces a complete schema; both statements are idempotent.
alter table items add column if not exists alert_size integer default 0;

create index if not exists items_category_id_idx   on items (category_id);
create index if not exists items_important_idx     on items (is_important, display_order);
create index if not exists items_display_order_idx on items (display_order);
create index if not exists items_alert_size_idx     on items (alert_size) where alert_size > 0;

-- -----------------------------------------------------------------------------
-- 5. Inventory history (audit log)
-- -----------------------------------------------------------------------------
create table if not exists inventory_history (
    id               uuid default gen_random_uuid() primary key,
    item_id          uuid references items(id) on delete cascade,
    user_id          uuid references auth.users(id) on delete set null,
    action_type      varchar(20) check (action_type in ('CREDIT', 'DEBIT', 'INITIAL')),
    quantity_changed numeric not null,
    new_total        numeric not null,
    notes            text,
    created_at       timestamp with time zone default timezone('utc'::text, now()) not null
);

create index if not exists inventory_history_item_id_idx    on inventory_history (item_id);
create index if not exists inventory_history_user_id_idx    on inventory_history (user_id);
create index if not exists inventory_history_created_at_idx on inventory_history (created_at desc);
create index if not exists inventory_history_action_idx     on inventory_history (action_type);

-- =============================================================================
-- Role helpers
-- SECURITY DEFINER so they can read `profiles` without tripping the RLS policy
-- that is itself defined in terms of them (would otherwise recurse infinitely).
-- =============================================================================
create or replace function public.current_role_name()
returns text
language sql
stable
security definer
set search_path = public
as $$
    select cr.role_name
    from profiles p
    join custom_roles cr on cr.id = p.role_id
    where p.id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_role_name() = 'Admin', false);
$$;

-- Admin and Manager may maintain the catalogue (categories + items).
create or replace function public.can_manage_items()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select coalesce(public.current_role_name() in ('Admin', 'Manager'), false);
$$;

-- =============================================================================
-- Row Level Security
-- Everything is readable by any signed-in staff member; writes are role-gated.
-- Nothing is readable by `anon`, so the publishable key alone gets you nothing.
-- =============================================================================
alter table custom_roles      enable row level security;
alter table profiles          enable row level security;
alter table categories        enable row level security;
alter table items             enable row level security;
alter table inventory_history enable row level security;

drop policy if exists custom_roles_select      on custom_roles;
drop policy if exists custom_roles_admin_write on custom_roles;
create policy custom_roles_select      on custom_roles for select to authenticated using (true);
create policy custom_roles_admin_write on custom_roles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

-- Every signed-in user can read profiles: the history log shows *who* moved
-- stock, and that lookup has to work for Managers and Kitchen Staff too.
drop policy if exists profiles_select      on profiles;
drop policy if exists profiles_admin_write on profiles;
create policy profiles_select      on profiles for select to authenticated using (true);
create policy profiles_admin_write on profiles for all    to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists categories_select on categories;
drop policy if exists categories_write  on categories;
create policy categories_select on categories for select to authenticated using (true);
create policy categories_write  on categories for all    to authenticated using (public.can_manage_items()) with check (public.can_manage_items());

-- Direct writes to `items` are Admin/Manager only. Kitchen Staff move stock
-- exclusively through adjust_stock(), which is SECURITY DEFINER and therefore
-- steps around this policy after doing its own role check.
drop policy if exists items_select on items;
drop policy if exists items_write  on items;
create policy items_select on items for select to authenticated using (true);
create policy items_write  on items for all    to authenticated using (public.can_manage_items()) with check (public.can_manage_items());

-- Read-only to clients; rows are written only by adjust_stock().
drop policy if exists inventory_history_select on inventory_history;
create policy inventory_history_select on inventory_history for select to authenticated using (true);

-- =============================================================================
-- adjust_stock — the ONLY sanctioned way to move stock.
--
-- Updates items.current_stock and appends to inventory_history in a single
-- transaction, so the running total and the audit trail can never drift apart.
-- The UPDATE takes a row lock, which serialises concurrent adjustments to the
-- same item; two people debiting at once cannot both read the same old total.
-- =============================================================================
create or replace function public.adjust_stock(
    p_item_id  uuid,
    p_action   text,
    p_quantity numeric,
    p_notes    text default null
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
    v_uid    uuid := auth.uid();
    v_role   text;
    v_delta  numeric;
    v_before numeric;
    v_new    numeric;
    v_name   text;
begin
    if v_uid is null then
        raise exception 'Not authenticated' using errcode = '28000';
    end if;

    v_role := public.current_role_name();
    if v_role is null then
        raise exception 'No role is assigned to this account';
    end if;

    if p_action not in ('CREDIT', 'DEBIT', 'INITIAL') then
        raise exception 'Invalid action "%": expected CREDIT, DEBIT or INITIAL', p_action;
    end if;

    if p_quantity is null or p_quantity <= 0 then
        raise exception 'Quantity must be greater than zero';
    end if;

    -- Kitchen Staff consume stock; they never add it.
    if v_role = 'Kitchen Staff' and p_action <> 'DEBIT' then
        raise exception 'Kitchen Staff can only debit stock';
    end if;

    -- Setting an opening balance overwrites history-derived totals, so it is
    -- restricted to the catalogue owners.
    if p_action = 'INITIAL' and v_role not in ('Admin', 'Manager') then
        raise exception 'Only an Admin or Manager can set an opening balance';
    end if;

    select current_stock, name into v_before, v_name
    from items
    where id = p_item_id
    for update;

    if not found then
        raise exception 'Item not found';
    end if;

    if p_action = 'INITIAL' then
        v_delta := p_quantity - coalesce(v_before, 0);
        v_new   := p_quantity;
    else
        v_delta := case when p_action = 'CREDIT' then p_quantity else -p_quantity end;
        v_new   := coalesce(v_before, 0) + v_delta;
    end if;

    if v_new < 0 then
        raise exception 'Insufficient stock for "%": % available, tried to remove %',
            v_name, coalesce(v_before, 0), p_quantity;
    end if;

    update items set current_stock = v_new where id = p_item_id;

    insert into inventory_history (item_id, user_id, action_type, quantity_changed, new_total, notes)
    values (p_item_id, v_uid, p_action, v_delta, v_new, nullif(trim(coalesce(p_notes, '')), ''));

    return v_new;
end;
$$;

-- Bulk variant: all items succeed or none do (single transaction). If one item
-- lacks stock the whole batch rolls back, which is what you want for a bulk
-- kitchen debit — a half-applied batch is worse than a rejected one.
create or replace function public.adjust_stock_bulk(
    p_item_ids uuid[],
    p_action   text,
    p_quantity numeric,
    p_notes    text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
    v_id      uuid;
    v_applied integer := 0;
begin
    if p_item_ids is null or array_length(p_item_ids, 1) is null then
        raise exception 'Select at least one item';
    end if;

    foreach v_id in array p_item_ids loop
        perform public.adjust_stock(v_id, p_action, p_quantity, p_notes);
        v_applied := v_applied + 1;
    end loop;

    return v_applied;
end;
$$;

revoke execute on function public.adjust_stock(uuid, text, numeric, text)        from public, anon;
revoke execute on function public.adjust_stock_bulk(uuid[], text, numeric, text) from public, anon;
grant  execute on function public.adjust_stock(uuid, text, numeric, text)        to authenticated;
grant  execute on function public.adjust_stock_bulk(uuid[], text, numeric, text) to authenticated;

-- =============================================================================
-- Flattened history for the master log.
-- inventory_history.user_id points at auth.users, which PostgREST cannot embed,
-- so the join to `profiles` happens here instead.
-- security_invoker keeps the caller's RLS in force rather than the view owner's.
-- =============================================================================
create or replace view public.inventory_history_view
with (security_invoker = on) as
select
    h.id,
    h.item_id,
    h.user_id,
    h.action_type,
    h.quantity_changed,
    h.new_total,
    h.notes,
    h.created_at,
    i.name          as item_name,
    i.shortcut_code as item_code,
    i.unit          as item_unit,
    c.name          as category_name,
    p.email         as user_email,
    coalesce(nullif(p.full_name, ''), split_part(p.email, '@', 1)) as user_name
from inventory_history h
left join items      i on i.id = h.item_id
left join categories c on c.id = i.category_id
left join profiles   p on p.id = h.user_id;

grant select on public.inventory_history_view to authenticated;
