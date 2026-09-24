-- ============================================================
-- سبد من — Migration نسخه ۴
-- هسته اتمیک فروش و لغو + آماده‌سازی Realtime
-- ============================================================

begin;

-- ============================================================
-- 1) ایندکس‌های لازم
-- ============================================================

create index if not exists sales_product_action_idx
on public.sales(product_id, action);

create index if not exists sales_created_product_idx
on public.sales(created_at, product_id);


-- ============================================================
-- 2) تابع اتمیک ثبت فروش
-- ============================================================

create or replace function public.sale_product(
  p_product_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_sale_id uuid;
  v_price numeric;
  v_cost numeric;
  v_profit numeric;
begin

  if auth.uid() is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  -- قفل کردن محصول برای جلوگیری از فروش همزمان اشتباه
  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'محصول پیدا نشد';
  end if;

  if coalesce(v_product.quantity, 0) <= 0 then
    raise exception 'موجودی «%» تمام شده است', v_product.name;
  end if;

  v_price := coalesce(v_product.unit_price, 0);
  v_cost := coalesce(v_product.purchase_price, 0);
  v_profit := v_price - v_cost;

  -- ثبت فروش
  insert into public.sales (
    product_id,
    product_name,
    unit_price,
    purchase_price,
    quantity,
    total_amount,
    profit_amount,
    action
  )
  values (
    v_product.id,
    v_product.name,
    v_price,
    v_cost,
    1,
    v_price,
    v_profit,
    'sale'
  )
  returning id into v_sale_id;

  -- کاهش موجودی
  update public.products
  set
    quantity = coalesce(quantity, 0) - 1,
    updated_at = now()
  where id = v_product.id;

  return json_build_object(
    'success', true,
    'action', 'sale',
    'sale_id', v_sale_id,
    'product_id', v_product.id,
    'product_name', v_product.name,
    'quantity', 1,
    'remaining_quantity', coalesce(v_product.quantity, 0) - 1,
    'total_amount', v_price,
    'profit_amount', v_profit
  );

end;
$$;-- ============================================================
-- 3) تابع اتمیک لغو فروش
-- ============================================================

create or replace function public.cancel_product(
  p_product_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_product public.products%rowtype;
  v_sale_id uuid;
  v_net_quantity numeric;
  v_price numeric;
  v_cost numeric;
  v_profit numeric;
begin

  if auth.uid() is null then
    raise exception 'کاربر وارد نشده است';
  end if;

  -- قفل محصول
  select *
  into v_product
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'محصول پیدا نشد';
  end if;

  -- محاسبه فروش خالص محصول
  select coalesce(
    sum(
      case
        when action = 'sale' then quantity
        when action = 'cancel' then -quantity
        else 0
      end
    ),
    0
  )
  into v_net_quantity
  from public.sales
  where product_id = p_product_id;

  -- جلوگیری از لغو بیشتر از فروش ثبت‌شده
  if v_net_quantity <= 0 then
    raise exception 'برای «%» فروش قابل لغو وجود ندارد', v_product.name;
  end if;

  v_price := coalesce(v_product.unit_price, 0);
  v_cost := coalesce(v_product.purchase_price, 0);
  v_profit := v_price - v_cost;

  -- ثبت لغو
  insert into public.sales (
    product_id,
    product_name,
    unit_price,
    purchase_price,
    quantity,
    total_amount,
    profit_amount,
    action
  )
  values (
    v_product.id,
    v_product.name,
    v_price,
    v_cost,
    1,
    v_price,
    v_profit,
    'cancel'
  )
  returning id into v_sale_id;

  -- برگشت موجودی
  update public.products
  set
    quantity = coalesce(quantity, 0) + 1,
    updated_at = now()
  where id = v_product.id;

  return json_build_object(
    'success', true,
    'action', 'cancel',
    'sale_id', v_sale_id,
    'product_id', v_product.id,
    'product_name', v_product.name,
    'quantity', 1,
    'new_quantity', coalesce(v_product.quantity, 0) + 1,
    'total_amount', v_price,
    'profit_amount', v_profit
  );

end;
$$;


-- ============================================================
-- 4) مجوز اجرای RPCها
-- ============================================================

revoke all on function public.sale_product(uuid) from public;
revoke all on function public.cancel_product(uuid) from public;

grant execute on function public.sale_product(uuid) to authenticated;
grant execute on function public.cancel_product(uuid) to authenticated;


-- ============================================================
-- 5) آماده‌سازی Realtime
-- ============================================================

do $$
begin

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c
      on c.oid = pr.prrelid
    join pg_namespace n
      on n.oid = c.relnamespace
    join pg_publication p
      on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'sales'
  ) then

    alter publication supabase_realtime
    add table public.sales;

  end if;

  if not exists (
    select 1
    from pg_publication_rel pr
    join pg_class c
      on c.oid = pr.prrelid
    join pg_namespace n
      on n.oid = c.relnamespace
    join pg_publication p
      on p.oid = pr.prpubid
    where p.pubname = 'supabase_realtime'
      and n.nspname = 'public'
      and c.relname = 'products'
  ) then

    alter publication supabase_realtime
    add table public.products;

  end if;

end;
$$;-- ============================================================
-- 6) اعلام تغییر Schema به PostgREST
-- ============================================================

notify pgrst, 'reload schema';


-- ============================================================
-- 7) پایان Migration نسخه ۴
-- ============================================================

commit;

-- ============================================================
-- پایان فایل supabase_v4_migration.sql
-- ============================================================
