-- Player profiles + business-card storage.
alter table public.players add column if not exists player_grade text;
alter table public.players add column if not exists specialties text[] not null default '{}';
alter table public.players add column if not exists servers text[] not null default '{}';
alter table public.players add column if not exists card_url text;

alter table public.players drop constraint if exists players_player_grade_check;
alter table public.players add constraint players_player_grade_check
  check (player_grade is null or player_grade in ('SR','S','A','B','娛樂女陪'));

-- Customers need read access to active player cards for the preview/filter page.
drop policy if exists "authenticated read active players" on public.players;
create policy "authenticated read active players"
on public.players for select to authenticated
using (active = true or public.current_role() in ('staff','admin'));

-- Public bucket for player business-card images.
insert into storage.buckets (id,name,public)
values ('player-cards','player-cards',true)
on conflict (id) do update set public=true;

drop policy if exists "admin upload player cards" on storage.objects;
create policy "admin upload player cards"
on storage.objects for insert to authenticated
with check (bucket_id='player-cards' and public.current_role()='admin');

drop policy if exists "admin update player cards" on storage.objects;
create policy "admin update player cards"
on storage.objects for update to authenticated
using (bucket_id='player-cards' and public.current_role()='admin')
with check (bucket_id='player-cards' and public.current_role()='admin');

drop policy if exists "admin delete player cards" on storage.objects;
create policy "admin delete player cards"
on storage.objects for delete to authenticated
using (bucket_id='player-cards' and public.current_role()='admin');
