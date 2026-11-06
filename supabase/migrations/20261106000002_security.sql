-- 661C Home Hub — permission helpers, integrity triggers, audit, RLS, storage

-- ---------------------------------------------------------------------------
-- Permission helpers (security definer so they can read membership under RLS)
-- ---------------------------------------------------------------------------
create or replace function public.is_member(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_owner(hh uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

-- perm: approve | payments | budget | export | manage
create or replace function public.has_perm(hh uuid, perm text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.household_members m
    where m.household_id = hh and m.user_id = auth.uid()
      and (
        m.role = 'owner'
        or (perm = 'approve' and m.can_approve)
        or (perm = 'payments' and m.can_record_payments)
        or (perm = 'budget' and m.can_edit_budget)
        or (perm = 'export' and m.can_export)
        or (perm = 'manage' and m.can_manage_items)
      )
  );
$$;

create or replace function public.try_uuid(t text)
returns uuid language plpgsql immutable as $$
begin
  return t::uuid;
exception when others then
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'households','household_members','rooms','budget_categories','suppliers',
    'required_items','product_options','option_checks','shared_costs','payments',
    'shopping_locations'
  ] loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function public.touch_updated_at()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Household consistency: children inherit household_id from their parent.
-- Runs as definer so the parent is found; RLS then checks membership of the
-- resulting household on insert, so rows can never cross households.
-- ---------------------------------------------------------------------------
create or replace function public.inherit_household()
returns trigger language plpgsql security definer set search_path = public as $$
declare parent_hh uuid;
begin
  if tg_table_name = 'required_items' then
    select household_id into parent_hh from public.rooms where id = new.room_id;
  elsif tg_table_name = 'product_options' then
    select household_id into parent_hh from public.required_items where id = new.required_item_id;
  elsif tg_table_name in ('option_images','option_comments','option_preferences','option_checks') then
    select household_id into parent_hh from public.product_options where id = new.option_id;
  elsif tg_table_name = 'documents' then
    if new.option_id is null then
      return new;
    end if;
    select household_id into parent_hh from public.product_options where id = new.option_id;
  elsif tg_table_name = 'location_items' then
    select household_id into parent_hh from public.shopping_locations where id = new.location_id;
    if not exists (select 1 from public.required_items where id = new.required_item_id and household_id = parent_hh) then
      raise exception 'Item and location belong to different households';
    end if;
  end if;
  if parent_hh is null then
    raise exception 'Parent record not found for %', tg_table_name;
  end if;
  new.household_id := parent_hh;
  return new;
end;
$$;

create trigger required_items_hh before insert or update of room_id on public.required_items
  for each row execute function public.inherit_household();
create trigger product_options_hh before insert or update of required_item_id on public.product_options
  for each row execute function public.inherit_household();
create trigger option_images_hh before insert on public.option_images
  for each row execute function public.inherit_household();
create trigger option_comments_hh before insert on public.option_comments
  for each row execute function public.inherit_household();
create trigger option_preferences_hh before insert or update on public.option_preferences
  for each row execute function public.inherit_household();
create trigger option_checks_hh before insert on public.option_checks
  for each row execute function public.inherit_household();
create trigger documents_hh before insert on public.documents
  for each row execute function public.inherit_household();
create trigger location_items_hh before insert on public.location_items
  for each row execute function public.inherit_household();

-- Payments: tie to approval / item / supplier in the same household.
create or replace function public.payments_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
declare a record;
begin
  if new.approval_id is not null then
    select household_id, required_item_id into a from public.approvals where id = new.approval_id;
    if a.household_id is distinct from new.household_id then
      raise exception 'Approval belongs to a different household';
    end if;
    new.required_item_id := a.required_item_id;
  end if;
  if new.required_item_id is not null and not exists (
    select 1 from public.required_items where id = new.required_item_id and household_id = new.household_id
  ) then
    raise exception 'Item belongs to a different household';
  end if;
  if new.shared_cost_id is not null and not exists (
    select 1 from public.shared_costs where id = new.shared_cost_id and household_id = new.household_id
  ) then
    raise exception 'Shared cost belongs to a different household';
  end if;
  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers where id = new.supplier_id and household_id = new.household_id
  ) then
    raise exception 'Supplier belongs to a different household';
  end if;
  -- A payment with no commitment behind it is allowed but flagged for reconciliation.
  if new.approval_id is null and new.shared_cost_id is null then
    new.needs_reconciliation := true;
  end if;
  return new;
end;
$$;
create trigger payments_integrity before insert or update on public.payments
  for each row execute function public.payments_integrity();

create or replace function public.option_supplier_integrity()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.supplier_id is not null and not exists (
    select 1 from public.suppliers where id = new.supplier_id and household_id = new.household_id
  ) then
    raise exception 'Supplier belongs to a different household';
  end if;
  return new;
end;
$$;
create trigger product_options_supplier after insert or update of supplier_id on public.product_options
  for each row execute function public.option_supplier_integrity();

-- ---------------------------------------------------------------------------
-- Option status guard: 'approved' and 'ordered' are reachable only through the
-- approval functions below, which set a transaction-local flag.
-- ---------------------------------------------------------------------------
create or replace function public.guard_option_status()
returns trigger language plpgsql as $$
declare via_workflow boolean := coalesce(current_setting('app.approval_workflow', true), '') = 'on';
begin
  if tg_op = 'INSERT' then
    if new.status in ('approved', 'ordered') and not via_workflow then
      raise exception 'New options cannot start as approved or ordered';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status and not via_workflow then
    if new.status in ('approved', 'ordered') or old.status in ('approved', 'ordered') then
      raise exception 'Approval and ordering changes must use the approval workflow';
    end if;
  end if;
  return new;
end;
$$;
create trigger product_options_status_guard before insert or update of status on public.product_options
  for each row execute function public.guard_option_status();

-- Budget fields require the budget permission (or owner).
create or replace function public.guard_budget_fields()
returns trigger language plpgsql as $$
declare changed boolean := false;
begin
  if auth.uid() is null then
    return new;  -- service role / migrations
  end if;
  if tg_table_name = 'households' then
    changed := new.total_budget is distinct from old.total_budget
            or new.contingency is distinct from old.contingency;
  elsif tg_table_name = 'rooms' then
    changed := (tg_op = 'INSERT' and new.budget is not null)
            or (tg_op = 'UPDATE' and new.budget is distinct from old.budget);
  elsif tg_table_name = 'budget_categories' then
    changed := (tg_op = 'INSERT' and new.budget is not null)
            or (tg_op = 'UPDATE' and new.budget is distinct from old.budget);
  elsif tg_table_name = 'required_items' then
    changed := (tg_op = 'INSERT' and new.estimate_unit is not null)
            or (tg_op = 'UPDATE' and new.estimate_unit is distinct from old.estimate_unit);
  end if;
  -- households is keyed by id; every other table carries household_id
  if changed and not public.has_perm(coalesce(public.try_uuid(to_jsonb(new) ->> 'household_id'), (to_jsonb(new) ->> 'id')::uuid), 'budget') then
    raise exception 'You do not have permission to change budgets or allowances';
  end if;
  return new;
end;
$$;
create trigger households_budget_guard before update on public.households
  for each row execute function public.guard_budget_fields();
create trigger rooms_budget_guard before insert or update on public.rooms
  for each row execute function public.guard_budget_fields();
create trigger budget_categories_guard before insert or update on public.budget_categories
  for each row execute function public.guard_budget_fields();
create trigger required_items_budget_guard before insert or update on public.required_items
  for each row execute function public.guard_budget_fields();

-- Members cannot change their own role; the last owner cannot be demoted.
create or replace function public.guard_members()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role then
    if old.user_id = auth.uid() then
      raise exception 'You cannot change your own role';
    end if;
    if old.role = 'owner' and not exists (
      select 1 from public.household_members
      where household_id = old.household_id and role = 'owner' and user_id <> old.user_id
    ) then
      raise exception 'A household needs at least one owner';
    end if;
  end if;
  if new.user_id is distinct from old.user_id or new.household_id is distinct from old.household_id then
    raise exception 'Membership identity cannot change';
  end if;
  -- Only an owner can change roles or permissions (members may only rename themselves).
  if auth.uid() is not null and not public.is_owner(old.household_id) and (
       new.role is distinct from old.role
    or new.can_approve is distinct from old.can_approve
    or new.can_record_payments is distinct from old.can_record_payments
    or new.can_edit_budget is distinct from old.can_edit_budget
    or new.can_export is distinct from old.can_export
    or new.can_manage_items is distinct from old.can_manage_items
  ) then
    raise exception 'Only the owner can change permissions';
  end if;
  return new;
end;
$$;
create trigger household_members_guard before update on public.household_members
  for each row execute function public.guard_members();

-- ---------------------------------------------------------------------------
-- Audit log (who, what, when). Written by trigger only.
-- ---------------------------------------------------------------------------
create or replace function public.audit_row()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rec jsonb;
  old_rec jsonb;
  diff jsonb := '{}'::jsonb;
  k text;
  hh uuid;
  eid text;
begin
  if tg_op = 'DELETE' then
    rec := to_jsonb(old);
  else
    rec := to_jsonb(new);
  end if;
  if tg_op = 'UPDATE' then
    old_rec := to_jsonb(old);
    for k in select jsonb_object_keys(rec) loop
      if k not in ('updated_at') and (rec -> k) is distinct from (old_rec -> k) then
        diff := diff || jsonb_build_object(k, jsonb_build_array(old_rec -> k, rec -> k));
      end if;
    end loop;
    if diff = '{}'::jsonb then
      return new;
    end if;
  elsif tg_op = 'INSERT' then
    diff := rec - 'created_at' - 'updated_at';
  else
    diff := rec;
  end if;
  hh := case when tg_table_name = 'households' then (rec ->> 'id')::uuid
             else public.try_uuid(rec ->> 'household_id') end;
  eid := coalesce(rec ->> 'id', rec ->> 'option_id');
  insert into public.audit_log(household_id, actor_id, action, entity, entity_id, changes)
  values (hh, auth.uid(), lower(tg_op), tg_table_name, eid, diff);
  return coalesce(new, old);
end;
$$;

do $$
declare t text;
begin
  foreach t in array array[
    'households','household_members','household_invites','rooms','budget_categories',
    'suppliers','required_items','product_options','option_images','option_comments',
    'option_preferences','option_checks','exchange_rates','approvals','shared_costs',
    'documents','payments','shopping_locations','location_items','import_batches'
  ] loop
    execute format('create trigger %I_audit after insert or update or delete on public.%I for each row execute function public.audit_row()', t, t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.rooms enable row level security;
alter table public.budget_categories enable row level security;
alter table public.suppliers enable row level security;
alter table public.required_items enable row level security;
alter table public.product_options enable row level security;
alter table public.option_images enable row level security;
alter table public.option_comments enable row level security;
alter table public.option_preferences enable row level security;
alter table public.option_checks enable row level security;
alter table public.exchange_rates enable row level security;
alter table public.approvals enable row level security;
alter table public.shared_costs enable row level security;
alter table public.documents enable row level security;
alter table public.payments enable row level security;
alter table public.sourcing_guidelines enable row level security;
alter table public.shopping_locations enable row level security;
alter table public.location_items enable row level security;
alter table public.import_batches enable row level security;
alter table public.audit_log enable row level security;

-- households
create policy households_select on public.households for select using (public.is_member(id));
create policy households_update on public.households for update
  using (public.is_owner(id) or public.has_perm(id, 'budget'))
  with check (public.is_owner(id) or public.has_perm(id, 'budget'));

-- members: everyone in the household can see members; only the owner edits permissions
create policy members_select on public.household_members for select using (public.is_member(household_id));
create policy members_update_owner on public.household_members for update
  using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy members_update_self_name on public.household_members for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy members_delete_owner on public.household_members for delete
  using (public.is_owner(household_id) and user_id <> auth.uid());

-- invites: owner only
create policy invites_owner_all on public.household_invites for all
  using (public.is_owner(household_id)) with check (public.is_owner(household_id));

-- Generic shared-workspace tables: members read and write; deletes need 'manage'.
do $$
declare t text;
begin
  foreach t in array array['rooms','suppliers','required_items','product_options','option_images','option_checks','documents','location_items'] loop
    execute format('create policy %I_select on public.%I for select using (public.is_member(household_id))', t, t);
    execute format('create policy %I_insert on public.%I for insert with check (public.is_member(household_id))', t, t);
    execute format('create policy %I_update on public.%I for update using (public.is_member(household_id)) with check (public.is_member(household_id))', t, t);
  end loop;
end $$;

create policy rooms_delete on public.rooms for delete using (public.has_perm(household_id, 'manage'));
create policy suppliers_delete on public.suppliers for delete using (public.has_perm(household_id, 'manage'));
create policy required_items_delete on public.required_items for delete using (public.has_perm(household_id, 'manage'));
create policy product_options_delete on public.product_options for delete
  using (public.has_perm(household_id, 'manage') or created_by = auth.uid());
create policy option_images_delete on public.option_images for delete
  using (public.has_perm(household_id, 'manage') or uploaded_by = auth.uid());
create policy option_checks_delete on public.option_checks for delete using (public.has_perm(household_id, 'manage'));
create policy documents_delete on public.documents for delete
  using (public.has_perm(household_id, 'manage') or uploaded_by = auth.uid());
create policy location_items_delete on public.location_items for delete using (public.is_member(household_id));

-- budget categories: read for members, write with budget permission
create policy budget_categories_select on public.budget_categories for select using (public.is_member(household_id));
create policy budget_categories_write on public.budget_categories for all
  using (public.has_perm(household_id, 'budget')) with check (public.has_perm(household_id, 'budget'));

-- comments & preferences: everyone reads; you only write your own
create policy comments_select on public.option_comments for select using (public.is_member(household_id));
create policy comments_insert on public.option_comments for insert
  with check (public.is_member(household_id) and user_id = auth.uid());
create policy comments_update_own on public.option_comments for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy comments_delete_own on public.option_comments for delete using (user_id = auth.uid());

create policy prefs_select on public.option_preferences for select using (public.is_member(household_id));
create policy prefs_insert on public.option_preferences for insert
  with check (public.is_member(household_id) and user_id = auth.uid());
create policy prefs_update_own on public.option_preferences for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy prefs_delete_own on public.option_preferences for delete using (user_id = auth.uid());

-- exchange rates: members read; payments or budget permission writes
create policy fx_select on public.exchange_rates for select using (public.is_member(household_id));
create policy fx_insert on public.exchange_rates for insert
  with check (public.has_perm(household_id, 'payments') or public.has_perm(household_id, 'budget'));
create policy fx_delete on public.exchange_rates for delete using (public.is_owner(household_id));

-- approvals: read-only through the API; written by the workflow functions
create policy approvals_select on public.approvals for select using (public.is_member(household_id));

-- payments & shared costs: payments permission
create policy payments_select on public.payments for select using (public.is_member(household_id));
create policy payments_insert on public.payments for insert with check (public.has_perm(household_id, 'payments'));
create policy payments_update on public.payments for update
  using (public.has_perm(household_id, 'payments')) with check (public.has_perm(household_id, 'payments'));
create policy payments_delete on public.payments for delete using (public.has_perm(household_id, 'payments'));

create policy shared_costs_select on public.shared_costs for select using (public.is_member(household_id));
create policy shared_costs_write on public.shared_costs for all
  using (public.has_perm(household_id, 'payments')) with check (public.has_perm(household_id, 'payments'));

-- reference data
create policy guidelines_select on public.sourcing_guidelines for select using (public.is_member(household_id));
create policy guidelines_write on public.sourcing_guidelines for all
  using (public.is_owner(household_id)) with check (public.is_owner(household_id));
create policy locations_select on public.shopping_locations for select using (public.is_member(household_id));
create policy locations_write on public.shopping_locations for all
  using (public.is_member(household_id)) with check (public.is_member(household_id));

create policy imports_select on public.import_batches for select using (public.is_member(household_id));
create policy imports_insert on public.import_batches for insert with check (public.is_owner(household_id));

create policy audit_select on public.audit_log for select using (public.is_member(household_id));

-- ---------------------------------------------------------------------------
-- Private storage bucket. Object names start with "<household_id>/".
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'household-files', 'household-files', false, 26214400,
  array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','application/pdf']
)
on conflict (id) do update set public = false;

create policy household_files_select on storage.objects for select to authenticated
  using (bucket_id = 'household-files' and public.is_member(public.try_uuid((storage.foldername(name))[1])));
create policy household_files_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'household-files' and public.is_member(public.try_uuid((storage.foldername(name))[1])));
create policy household_files_update on storage.objects for update to authenticated
  using (bucket_id = 'household-files' and public.is_member(public.try_uuid((storage.foldername(name))[1])))
  with check (bucket_id = 'household-files' and public.is_member(public.try_uuid((storage.foldername(name))[1])));
create policy household_files_delete on storage.objects for delete to authenticated
  using (bucket_id = 'household-files' and public.is_member(public.try_uuid((storage.foldername(name))[1])));
