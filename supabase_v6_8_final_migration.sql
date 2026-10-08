-- Sabad Man v6.6: persistent shared notifications
create table if not exists public.notifications (
    id uuid primary key default gen_random_uuid(),
    title text not null default 'اعلان',
    content text not null default '',
    kind text not null default 'general',
    reference_id text,
    read_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

drop policy if exists "authenticated users can read notifications" on public.notifications;
drop policy if exists "authenticated users can insert notifications" on public.notifications;
drop policy if exists "authenticated users can update notifications" on public.notifications;
drop policy if exists "authenticated users can delete notifications" on public.notifications;

create policy "authenticated users can read notifications"
on public.notifications for select to authenticated using (true);

create policy "authenticated users can insert notifications"
on public.notifications for insert to authenticated with check (true);

create policy "authenticated users can update notifications"
on public.notifications for update to authenticated using (true) with check (true);

create policy "authenticated users can delete notifications"
on public.notifications for delete to authenticated using (true);

create unique index if not exists notifications_kind_reference_uidx
on public.notifications(kind, reference_id)
where reference_id is not null;

notify pgrst, 'reload schema';


-- ============================================================
-- Sabad Man v6.8 Final: persistent product ordering
-- ============================================================
alter table public.products
  add column if not exists sort_order integer;

-- Initialize missing/duplicate ordering per category.
with ranked as (
  select id,
         row_number() over (
           partition by category_id
           order by coalesce(sort_order, 2147483647), created_at nulls last, id
         ) - 1 as rn
  from public.products
)
update public.products p
set sort_order = ranked.rn
from ranked
where p.id = ranked.id;

create index if not exists products_category_sort_idx
  on public.products(category_id, sort_order);

create or replace function public.set_product_sort_order()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.sort_order is null then
      select coalesce(max(sort_order), -1) + 1
        into new.sort_order
      from public.products
      where category_id is not distinct from new.category_id;
    end if;
  elsif tg_op = 'UPDATE' and new.category_id is distinct from old.category_id then
    select coalesce(max(sort_order), -1) + 1
      into new.sort_order
    from public.products
    where category_id is not distinct from new.category_id
      and id <> new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_products_sort_order on public.products;
create trigger trg_products_sort_order
before insert or update of category_id on public.products
for each row execute function public.set_product_sort_order();

create or replace function public.move_product(
  p_product_id uuid,
  p_direction integer
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_category uuid;
  v_order integer;
  v_other_id uuid;
  v_other_order integer;
begin
  if auth.uid() is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  if p_direction not in (-1,1) then
    raise exception 'جهت جابه‌جایی نامعتبر است';
  end if;

  select category_id, sort_order
    into v_category, v_order
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'محصول پیدا نشد';
  end if;

  if v_order is null then
    select coalesce(max(sort_order), -1) + 1
      into v_order
    from public.products
    where category_id is not distinct from v_category
      and id <> p_product_id;
    update public.products set sort_order=v_order where id=p_product_id;
  end if;

  if p_direction < 0 then
    select id, sort_order into v_other_id, v_other_order
    from public.products
    where category_id is not distinct from v_category
      and id <> p_product_id
      and sort_order < v_order
    order by sort_order desc
    limit 1;
  else
    select id, sort_order into v_other_id, v_other_order
    from public.products
    where category_id is not distinct from v_category
      and id <> p_product_id
      and sort_order > v_order
    order by sort_order asc
    limit 1;
  end if;

  if v_other_id is null then
    return json_build_object('success',true,'moved',false);
  end if;

  update public.products set sort_order = v_other_order, updated_at=now()
  where id=p_product_id;

  update public.products set sort_order = v_order, updated_at=now()
  where id=v_other_id;

  return json_build_object(
    'success',true,'moved',true,
    'product_id',p_product_id,
    'other_product_id',v_other_id
  );
end;
$$;

revoke execute on function public.move_product(uuid, integer) from public;
grant execute on function public.move_product(uuid, integer) to authenticated;
