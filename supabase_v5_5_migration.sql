begin;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.categories(code,name,sort_order) values
('tea','Tea',1),
('coffee','Coffee',2),
('cold_drink','Cold Drinks',3),
('juice_milk','Juice & Milk',4),
('chocolate_snacks','Chocolate & Snacks',5),
('biscuits_cake','Biscuits & Cake',6),
('cig','Cig',7),
('ice_cream','Ice Cream',8),
('water','Mineral Water',9),
('ready_food','Ready Food',10),
('gum','Gum',11),
('other','Other',12)
on conflict (code) do update set name=excluded.name,sort_order=excluded.sort_order,updated_at=now();

alter table public.products add column if not exists category_id uuid references public.categories(id);

-- One-time best-effort migration of existing products from the old Persian name-based categories.
update public.products p set category_id=c.id
from public.categories c
where p.category_id is null and (
 (c.code='tea' and p.name ~* 'چای') or
 (c.code='coffee' and p.name ~* 'قهوه|اسپرسو') or
 (c.code='cold_drink' and p.name ~* 'آب|نوشابه|دلستر|نوشیدنی|آبمیوه') or
 (c.code='chocolate_snacks' and p.name ~* 'شکلات|چیپس') or
 (c.code='biscuits_cake' and p.name ~* 'بیسکویت|کیک') or
 (c.code='gum' and p.name ~* 'آدامس') or
 (c.code='cig' and p.name ~* 'سیگار|توتون')
);

update public.products p set category_id=(select id from public.categories where code='other') where category_id is null;

create index if not exists products_category_id_idx on public.products(category_id);
create index if not exists categories_sort_order_idx on public.categories(sort_order);

alter table public.categories enable row level security;

grant select,insert,update,delete on public.categories to authenticated;

drop policy if exists "authenticated can read categories" on public.categories;
drop policy if exists "authenticated can insert categories" on public.categories;
drop policy if exists "authenticated can update categories" on public.categories;
drop policy if exists "authenticated can delete categories" on public.categories;

create policy "authenticated can read categories" on public.categories for select to authenticated using (true);
create policy "authenticated can insert categories" on public.categories for insert to authenticated with check (true);
create policy "authenticated can update categories" on public.categories for update to authenticated using (true) with check (true);
create policy "authenticated can delete categories" on public.categories for delete to authenticated using (true);

grant select,insert,update,delete on public.products to authenticated;

create or replace function public.set_updated_at_categories()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at before update on public.categories for each row execute function public.set_updated_at_categories();

do $$ begin
 if not exists(select 1 from pg_publication_rel pr join pg_class c on c.oid=pr.prrelid join pg_namespace n on n.oid=c.relnamespace join pg_publication p on p.oid=pr.prpubid where p.pubname='supabase_realtime' and n.nspname='public' and c.relname='categories') then
   alter publication supabase_realtime add table public.categories;
 end if;
end $$;

notify pgrst,'reload schema';
commit;
