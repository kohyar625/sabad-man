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
