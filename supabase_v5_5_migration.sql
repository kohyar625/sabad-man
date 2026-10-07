begin;

alter table public.products
  add column if not exists sort_order integer;

create index if not exists products_category_sort_order_idx
  on public.products(category_id, sort_order);

-- Initialize a stable order inside every category.
with ranked as (
  select id,
         row_number() over (
           partition by category_id
           order by
             case when sort_order is null then 1 else 0 end,
             sort_order,
             created_at,
             id
         )::integer as rn
  from public.products
)
update public.products p
set sort_order=r.rn
from ranked r
where p.id=r.id
  and (p.sort_order is distinct from r.rn);

grant select,insert,update,delete on public.products to authenticated;

notify pgrst,'reload schema';
commit;
