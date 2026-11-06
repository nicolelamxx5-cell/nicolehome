-- 661C Home Hub — workflow functions (transactional state changes)

-- ---------------------------------------------------------------------------
-- Household creation: this is a private two-person app, so only the very first
-- account can create a household. Everyone else joins by invitation.
-- ---------------------------------------------------------------------------
create or replace function public.create_household(p_name text, p_display_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare hh uuid;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if exists (select 1 from public.households) then
    raise exception 'This Home Hub already has a household. Ask the owner to invite you.';
  end if;
  insert into public.households(name) values (coalesce(nullif(btrim(p_name), ''), '661C Home'))
    returning id into hh;
  insert into public.household_members(
    household_id, user_id, role, display_name,
    can_approve, can_record_payments, can_edit_budget, can_export, can_manage_items
  ) values (hh, auth.uid(), 'owner', coalesce(nullif(btrim(p_display_name), ''), 'Owner'),
    true, true, true, true, true);
  return hh;
end;
$$;

-- Join any household that invited this (verified) email address.
create or replace function public.claim_invites()
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_email text;
  inv record;
  joined uuid;
begin
  select lower(email) into v_email from auth.users
   where id = auth.uid() and email_confirmed_at is not null;
  if v_email is null then
    return null;
  end if;
  for inv in
    select * from public.household_invites where email = v_email and accepted_at is null
  loop
    insert into public.household_members(
      household_id, user_id, role, display_name,
      can_approve, can_record_payments, can_edit_budget, can_export, can_manage_items
    ) values (
      inv.household_id, auth.uid(), 'member', inv.display_name,
      inv.can_approve, inv.can_record_payments, inv.can_edit_budget, inv.can_export, inv.can_manage_items
    ) on conflict (household_id, user_id) do nothing;
    update public.household_invites set accepted_at = now() where id = inv.id;
    joined := inv.household_id;
  end loop;
  return joined;
end;
$$;

-- ---------------------------------------------------------------------------
-- Exchange rates
-- ---------------------------------------------------------------------------
create or replace function public.latest_rate(p_household uuid, p_currency text)
returns table (rate numeric, as_of date, source text)
language sql stable security definer set search_path = public as $$
  select 1::numeric, current_date, 'Base currency'::text where p_currency = 'SGD'
  union all
  (select r.rate_to_sgd, r.as_of, r.source
     from public.exchange_rates r
    where r.household_id = p_household and r.currency = p_currency and p_currency <> 'SGD'
    order by r.as_of desc, r.created_at desc
    limit 1);
$$;

-- ---------------------------------------------------------------------------
-- Approve an option. Supersedes any existing active approval for the same
-- required item in the same transaction, so commitments never double count.
-- ---------------------------------------------------------------------------
create or replace function public.approve_option(p_option_id uuid, p_note text default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.product_options%rowtype;
  goods_rate record;
  freight_rate record;
  prev public.approvals%rowtype;
  new_id uuid := gen_random_uuid();
  v_goods numeric(14,2);
  v_freight numeric(14,2);
  v_unresolved jsonb;
begin
  select * into o from public.product_options where id = p_option_id for update;
  if not found then
    raise exception 'Option not found';
  end if;
  if not public.has_perm(o.household_id, 'approve') then
    raise exception 'You do not have permission to approve purchases';
  end if;
  if o.status = 'cancelled' then
    raise exception 'This option was cancelled. Move it back to the shortlist first.';
  end if;
  if o.price is null then
    raise exception 'Enter a price before approving';
  end if;
  if o.currency is null then
    raise exception 'Confirm the price currency before approving';
  end if;
  if coalesce(o.freight_allowance, 0) > 0 and o.freight_currency is null then
    raise exception 'Confirm the freight allowance currency before approving';
  end if;

  select * into goods_rate from public.latest_rate(o.household_id, o.currency);
  if goods_rate.rate is null then
    raise exception 'Add an exchange rate for % before approving', o.currency;
  end if;
  select * into freight_rate from public.latest_rate(o.household_id, coalesce(o.freight_currency, 'SGD'));
  if freight_rate.rate is null then
    raise exception 'Add an exchange rate for % before approving', o.freight_currency;
  end if;

  v_goods := round((o.price * o.quantity + coalesce(o.other_charges, 0)) * goods_rate.rate, 2);
  v_freight := round(coalesce(o.freight_allowance, 0) * freight_rate.rate, 2);

  select coalesce(jsonb_agg(jsonb_build_object('title', c.title, 'state', c.state, 'critical', c.critical)), '[]'::jsonb)
    into v_unresolved
    from public.option_checks c
   where c.option_id = o.id and c.state in ('pending', 'failed');

  perform set_config('app.approval_workflow', 'on', true);

  select * into prev from public.approvals
   where required_item_id = o.required_item_id and status = 'active' for update;
  if found then
    if prev.option_id = o.id then
      raise exception 'This option is already the approved choice';
    end if;
    if prev.ordered_at is not null then
      raise exception 'The current choice has already been ordered. Cancel that order before switching.';
    end if;
    update public.approvals
       set status = 'superseded', ended_at = now(), ended_by = auth.uid(),
           end_reason = 'Replaced by another option', superseded_by = null
     where id = prev.id;
    update public.product_options set status = 'shortlisted' where id = prev.option_id;
  end if;

  insert into public.approvals(
    id, household_id, required_item_id, option_id, status, approved_by,
    unit_price, currency, quantity, other_charges, freight_allowance, freight_currency,
    fx_rate, freight_fx_rate, fx_as_of, fx_source, goods_sgd, freight_sgd, cost_sgd,
    price_basis, unresolved_checks, approval_note
  ) values (
    new_id, o.household_id, o.required_item_id, o.id, 'active', auth.uid(),
    o.price, o.currency, o.quantity, coalesce(o.other_charges, 0), coalesce(o.freight_allowance, 0),
    coalesce(o.freight_currency, 'SGD'),
    goods_rate.rate, freight_rate.rate, goods_rate.as_of, goods_rate.source,
    v_goods, v_freight, v_goods + v_freight, o.price_basis, v_unresolved, p_note
  );

  if prev.id is not null then
    update public.approvals set superseded_by = new_id where id = prev.id;
  end if;

  update public.product_options set status = 'approved' where id = o.id;
  perform set_config('app.approval_workflow', 'off', true);
  return new_id;
end;
$$;

-- Withdraw an approval that has not been ordered (nothing was bought).
create or replace function public.revoke_approval(p_approval_id uuid, p_reason text default null)
returns void language plpgsql security definer set search_path = public as $$
declare a public.approvals%rowtype;
begin
  select * into a from public.approvals where id = p_approval_id for update;
  if not found then raise exception 'Approval not found'; end if;
  if not public.has_perm(a.household_id, 'approve') then
    raise exception 'You do not have permission to change approvals';
  end if;
  if a.status <> 'active' then raise exception 'This approval is no longer active'; end if;
  if a.ordered_at is not null then
    raise exception 'Already ordered — use Cancel order instead';
  end if;
  perform set_config('app.approval_workflow', 'on', true);
  update public.approvals set status = 'revoked', ended_at = now(), ended_by = auth.uid(),
         end_reason = coalesce(nullif(btrim(p_reason), ''), 'Approval withdrawn')
   where id = a.id;
  update public.product_options set status = 'shortlisted' where id = a.option_id;
  perform set_config('app.approval_workflow', 'off', true);
end;
$$;

-- Mark as ordered. Unresolved critical checks require a documented override.
create or replace function public.mark_ordered(p_approval_id uuid, p_override_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare
  a public.approvals%rowtype;
  blocking int;
begin
  select * into a from public.approvals where id = p_approval_id for update;
  if not found then raise exception 'Approval not found'; end if;
  if not public.has_perm(a.household_id, 'approve') then
    raise exception 'You do not have permission to mark orders';
  end if;
  if a.status <> 'active' then raise exception 'This approval is no longer active'; end if;
  if a.ordered_at is not null then raise exception 'Already marked as ordered'; end if;

  select count(*) into blocking from public.option_checks
   where option_id = a.option_id and (state = 'failed' or (critical and state = 'pending'));
  if blocking > 0 and nullif(btrim(coalesce(p_override_note, '')), '') is null then
    raise exception '% critical check(s) are unresolved. Resolve them or record an override reason.', blocking;
  end if;

  perform set_config('app.approval_workflow', 'on', true);
  update public.approvals set ordered_at = now(), ordered_by = auth.uid(),
         order_override_note = nullif(btrim(coalesce(p_override_note, '')), '')
   where id = a.id;
  update public.product_options set status = 'ordered' where id = a.option_id;
  perform set_config('app.approval_workflow', 'off', true);
end;
$$;

-- Cancel an approved or ordered purchase. Payments stay on record (refunds are
-- recorded as refund payments), so money already paid is never lost from view.
create or replace function public.cancel_approval(p_approval_id uuid, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
declare a public.approvals%rowtype;
begin
  select * into a from public.approvals where id = p_approval_id for update;
  if not found then raise exception 'Approval not found'; end if;
  if not public.has_perm(a.household_id, 'approve') then
    raise exception 'You do not have permission to cancel orders';
  end if;
  if a.status <> 'active' then raise exception 'This approval is no longer active'; end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'Give a reason for cancelling';
  end if;
  perform set_config('app.approval_workflow', 'on', true);
  update public.approvals set status = 'cancelled', ended_at = now(), ended_by = auth.uid(), end_reason = p_reason
   where id = a.id;
  update public.product_options set status = 'cancelled' where id = a.option_id;
  perform set_config('app.approval_workflow', 'off', true);
end;
$$;

-- Imported workbook rows that already carried an "ordered" price: record them
-- as an approval flagged for reconciliation. Owner only.
create or replace function public.record_imported_commitment(p_option_id uuid, p_cost_sgd numeric, p_note text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  o public.product_options%rowtype;
  new_id uuid := gen_random_uuid();
begin
  select * into o from public.product_options where id = p_option_id for update;
  if not found then raise exception 'Option not found'; end if;
  if not public.is_owner(o.household_id) then raise exception 'Owner only'; end if;
  if exists (select 1 from public.approvals where required_item_id = o.required_item_id and status = 'active') then
    return null;  -- never create a second active commitment
  end if;
  perform set_config('app.approval_workflow', 'on', true);
  insert into public.approvals(
    id, household_id, required_item_id, option_id, status, approved_by,
    unit_price, currency, quantity, fx_rate, freight_fx_rate, fx_source,
    goods_sgd, freight_sgd, cost_sgd, price_basis, approval_note, is_imported, needs_reconciliation, ordered_at
  ) values (
    new_id, o.household_id, o.required_item_id, o.id, 'active', auth.uid(),
    coalesce(o.price, 0), 'SGD', o.quantity, 1, 1, 'Workbook import',
    p_cost_sgd, 0, p_cost_sgd, 'quoted', p_note, true, true, now()
  );
  update public.product_options set status = 'ordered' where id = o.id;
  perform set_config('app.approval_workflow', 'off', true);
  return new_id;
end;
$$;

revoke execute on function public.create_household(text, text) from public, anon;
grant execute on function public.create_household(text, text) to authenticated;
revoke execute on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;
revoke execute on function public.approve_option(uuid, text) from public, anon;
grant execute on function public.approve_option(uuid, text) to authenticated;
revoke execute on function public.revoke_approval(uuid, text) from public, anon;
grant execute on function public.revoke_approval(uuid, text) to authenticated;
revoke execute on function public.mark_ordered(uuid, text) from public, anon;
grant execute on function public.mark_ordered(uuid, text) to authenticated;
revoke execute on function public.cancel_approval(uuid, text) from public, anon;
grant execute on function public.cancel_approval(uuid, text) to authenticated;
revoke execute on function public.record_imported_commitment(uuid, numeric, text) from public, anon;
grant execute on function public.record_imported_commitment(uuid, numeric, text) to authenticated;
