-- 661C Home Hub — core schema
-- Money is stored as numeric(14,2); exchange rates as numeric(18,8) meaning
-- "1 unit of currency = rate SGD". SGD is the base currency.

create type public.member_role as enum ('owner', 'member');
create type public.option_status as enum (
  'wishlist', 'shortlisted', 'pending_confirmation', 'approved', 'ordered', 'cancelled'
);
create type public.approval_status as enum ('active', 'superseded', 'revoked', 'cancelled');
create type public.payment_kind as enum ('deposit', 'progress', 'balance', 'full', 'refund', 'other');
create type public.sourcing_pref as enum ('china', 'singapore', 'compare', 'undecided');
create type public.price_basis as enum ('observed', 'estimate', 'quoted', 'confirmed');
create type public.tri_state as enum ('yes', 'no', 'unknown');
create type public.check_state as enum ('pending', 'confirmed', 'not_applicable', 'failed');
create type public.preference_vote as enum ('love', 'like', 'unsure', 'no');

-- ---------------------------------------------------------------------------
-- Household & membership
-- ---------------------------------------------------------------------------
create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 120),
  address text,
  base_currency char(3) not null default 'SGD' check (base_currency = 'SGD'),
  total_budget numeric(14,2) check (total_budget is null or total_budget >= 0),
  contingency numeric(14,2) not null default 0 check (contingency >= 0),
  trip_start date,
  trip_end date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.household_members (
  household_id uuid not null references public.households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.member_role not null default 'member',
  display_name text not null default '' check (length(display_name) <= 60),
  can_approve boolean not null default false,
  can_record_payments boolean not null default false,
  can_edit_budget boolean not null default false,
  can_export boolean not null default false,
  can_manage_items boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_idx on public.household_members(user_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  email text not null check (email = lower(email) and position('@' in email) > 1),
  display_name text not null default '',
  can_approve boolean not null default false,
  can_record_payments boolean not null default false,
  can_edit_budget boolean not null default false,
  can_export boolean not null default false,
  can_manage_items boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index household_invites_open_email_idx
  on public.household_invites(household_id, email) where accepted_at is null;

-- ---------------------------------------------------------------------------
-- Rooms, categories, suppliers
-- ---------------------------------------------------------------------------
create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  sort_order int not null default 0,
  budget numeric(14,2) check (budget is null or budget >= 0),
  source_sheet text,
  legacy_prefix text,
  is_whole_house boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.budget_categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(name) between 1 and 80),
  budget numeric(14,2) check (budget is null or budget >= 0),
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, name)
);

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  platform text not null default 'other',
  contact_name text,
  wechat text,
  phone text,
  email text,
  shop_url text,
  address text,
  city text,
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index suppliers_name_idx on public.suppliers(household_id, lower(name));

-- ---------------------------------------------------------------------------
-- Required items (purchasing needs) and product options (candidates)
-- ---------------------------------------------------------------------------
create table public.required_items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  room_id uuid not null references public.rooms(id) on delete restrict,
  budget_category_id uuid references public.budget_categories(id) on delete set null,
  legacy_id text,                       -- workbook ID, e.g. "03-005"
  name text not null check (length(name) between 1 and 200),
  specification text,                   -- workbook "Item / Specification" (verbatim)
  workbook_category text,               -- workbook "Category"
  priority_label text,                  -- workbook "Priority" (verbatim)
  sourcing public.sourcing_pref not null default 'undecided',
  source_decision_label text,           -- workbook "Source Decision" (verbatim)
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  unit text,
  estimate_unit numeric(14,2) check (estimate_unit is null or estimate_unit >= 0), -- SGD allowance per unit
  legacy_status text,
  purchase_by text,
  reference_url text,
  photo_link text,
  dimensions_finish text,
  notes text,
  needs_review boolean not null default false,
  review_note text,
  import_snapshot jsonb,                -- workbook values at last import (detects in-app edits)
  is_archived boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, legacy_id)
);
create index required_items_room_idx on public.required_items(room_id);
create index required_items_household_idx on public.required_items(household_id);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  required_item_id uuid not null references public.required_items(id) on delete cascade,
  supplier_id uuid references public.suppliers(id) on delete set null,
  supplier_name text,
  title text not null default 'Untitled option' check (length(title) between 1 and 300),
  url text check (url is null or url ~* '^https?://'),
  platform text not null default 'other',
  contact text,
  model_sku text,
  description text,
  dimensions text,
  material text,
  colour text,
  configuration text,
  price numeric(14,2) check (price is null or price >= 0),
  currency char(3) check (currency is null or currency ~ '^[A-Z]{3}$'),  -- null = not confirmed
  price_basis public.price_basis not null default 'observed',
  price_note text,
  quantity numeric(12,3) not null default 1 check (quantity > 0),
  other_charges numeric(14,2) check (other_charges is null or other_charges >= 0), -- same currency as price
  freight_allowance numeric(14,2) check (freight_allowance is null or freight_allowance >= 0),
  freight_currency char(3) check (freight_currency is null or freight_currency ~ '^[A-Z]{3}$'),
  status public.option_status not null default 'wishlist',
  -- warranty
  warranty_provided public.tri_state not null default 'unknown',
  warranty_duration text,
  warranty_start_basis text,
  warranty_provider text,
  warranty_coverage text,
  warranty_exclusions text,
  warranty_valid_sg public.tri_state not null default 'unknown',
  warranty_local_service public.tri_state not null default 'unknown',
  warranty_parts public.tri_state not null default 'unknown',
  warranty_verified boolean not null default false,  -- false = supplier claim only
  warranty_notes text,
  notes text,
  ai_suggestions jsonb,                 -- unverified extraction results, never auto-applied
  import_key text,                      -- set when created by the workbook import
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index product_options_import_key_idx on public.product_options(household_id, import_key);
create index product_options_item_idx on public.product_options(required_item_id);
create index product_options_household_status_idx on public.product_options(household_id, status);

create table public.option_images (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  option_id uuid not null references public.product_options(id) on delete cascade,
  storage_path text not null unique,
  thumb_path text,
  width int,
  height int,
  sort_order int not null default 0,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index option_images_option_idx on public.option_images(option_id, sort_order);

create table public.option_comments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  option_id uuid not null references public.product_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  body text not null check (length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index option_comments_option_idx on public.option_comments(option_id, created_at);

create table public.option_preferences (
  option_id uuid not null references public.product_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  household_id uuid not null references public.households(id) on delete cascade,
  vote public.preference_vote not null,
  updated_at timestamptz not null default now(),
  primary key (option_id, user_id)
);

create table public.option_checks (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  option_id uuid not null references public.product_options(id) on delete cascade,
  template_key text,
  title text not null check (length(title) between 1 and 300),
  detail text,
  critical boolean not null default false,
  state public.check_state not null default 'pending',
  evidence text,
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (option_id, template_key)
);
create index option_checks_option_idx on public.option_checks(option_id);

-- ---------------------------------------------------------------------------
-- Money
-- ---------------------------------------------------------------------------
create table public.exchange_rates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  currency char(3) not null check (currency ~ '^[A-Z]{3}$' and currency <> 'SGD'),
  rate_to_sgd numeric(18,8) not null check (rate_to_sgd > 0),
  as_of date not null,
  source text not null check (length(source) between 1 and 200),
  is_manual boolean not null default false,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index exchange_rates_lookup_idx on public.exchange_rates(household_id, currency, as_of desc, created_at desc);

create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  required_item_id uuid not null references public.required_items(id) on delete cascade,
  option_id uuid not null references public.product_options(id) on delete restrict,
  status public.approval_status not null default 'active',
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz not null default now(),
  -- cost basis snapshot (never recalculated)
  unit_price numeric(14,2) not null,
  currency char(3) not null,
  quantity numeric(12,3) not null,
  other_charges numeric(14,2) not null default 0,
  freight_allowance numeric(14,2) not null default 0,
  freight_currency char(3) not null default 'SGD',
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  freight_fx_rate numeric(18,8) not null check (freight_fx_rate > 0),
  fx_as_of date,
  fx_source text,
  goods_sgd numeric(14,2) not null,
  freight_sgd numeric(14,2) not null,
  cost_sgd numeric(14,2) not null check (cost_sgd >= 0),
  price_basis public.price_basis not null,
  unresolved_checks jsonb not null default '[]'::jsonb,
  approval_note text,
  ordered_at timestamptz,
  ordered_by uuid references auth.users(id) on delete set null,
  order_override_note text,
  ended_at timestamptz,
  ended_by uuid references auth.users(id) on delete set null,
  end_reason text,
  superseded_by uuid references public.approvals(id) on delete set null,
  is_imported boolean not null default false,
  needs_reconciliation boolean not null default false,
  created_at timestamptz not null default now(),
  check (cost_sgd = goods_sgd + freight_sgd),
  check ((status = 'active') = (ended_at is null))
);
-- Exactly one active approval per required item: the core double-count guard.
create unique index approvals_one_active_idx on public.approvals(required_item_id) where status = 'active';
create index approvals_household_idx on public.approvals(household_id, status);
create index approvals_option_idx on public.approvals(option_id);

create table public.shared_costs (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  name text not null check (length(name) between 1 and 160),
  amount numeric(14,2) not null check (amount >= 0),
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  fx_source text,
  amount_sgd numeric(14,2) not null,
  status text not null default 'forecast' check (status in ('forecast', 'committed', 'cancelled')),
  allocation text not null default 'by_value' check (allocation in ('by_value', 'equal')),
  applies_to text not null default 'china' check (applies_to in ('china', 'all')),
  notes text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_sgd = round(amount * fx_rate, 2))
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  option_id uuid references public.product_options(id) on delete cascade,
  kind text not null default 'other' check (kind in ('receipt', 'warranty', 'quote', 'drawing', 'other')),
  storage_path text not null unique,
  file_name text not null,
  mime_type text,
  size_bytes bigint,
  uploaded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now()
);
create index documents_option_idx on public.documents(option_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  required_item_id uuid references public.required_items(id) on delete restrict,
  approval_id uuid references public.approvals(id) on delete restrict,
  shared_cost_id uuid references public.shared_costs(id) on delete restrict,
  supplier_id uuid references public.suppliers(id) on delete set null,
  kind public.payment_kind not null,
  amount numeric(14,2) not null check (amount > 0),      -- always positive; refunds are subtracted by kind
  currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  fx_rate numeric(18,8) not null check (fx_rate > 0),
  fx_source text,
  amount_sgd numeric(14,2) not null,
  paid_on date not null,
  method text,
  reference text,
  receipt_document_id uuid references public.documents(id) on delete set null,
  notes text,
  is_imported boolean not null default false,
  import_key text,
  needs_reconciliation boolean not null default false,
  recorded_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (amount_sgd = round(amount * fx_rate, 2)),
  check (currency <> 'SGD' or fx_rate = 1)
);
create unique index payments_import_key_idx on public.payments(household_id, import_key);
create index payments_household_idx on public.payments(household_id, paid_on);
create index payments_approval_idx on public.payments(approval_id);
create index payments_item_idx on public.payments(required_item_id);

-- ---------------------------------------------------------------------------
-- Sourcing guide, trip locations, imports, audit
-- ---------------------------------------------------------------------------
create table public.sourcing_guidelines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  category text not null,
  preferred text,
  rationale text,
  important_check text,
  sort_order int not null default 0,
  source text not null default 'workbook',
  unique (household_id, category)
);

create table public.shopping_locations (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  key text not null,
  name_en text not null,
  name_zh text,
  city text,
  categories text[] not null default '{}',
  address text,
  address_verified boolean not null default false,
  verification_note text,
  notes text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, key),
  check (address is null or address_verified)   -- store addresses only once verified
);

create table public.location_items (
  location_id uuid not null references public.shopping_locations(id) on delete cascade,
  required_item_id uuid not null references public.required_items(id) on delete cascade,
  household_id uuid not null references public.households(id) on delete cascade,
  primary key (location_id, required_item_id)
);
create index location_items_item_idx on public.location_items(required_item_id);

create table public.import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  file_name text not null,
  imported_by uuid references auth.users(id) on delete set null default auth.uid(),
  summary jsonb not null default '{}'::jsonb,
  report jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  household_id uuid references public.households(id) on delete cascade,
  actor_id uuid,
  action text not null,
  entity text not null,
  entity_id text,
  changes jsonb,
  created_at timestamptz not null default now()
);
create index audit_log_household_idx on public.audit_log(household_id, created_at desc);
create index audit_log_entity_idx on public.audit_log(entity, entity_id);
