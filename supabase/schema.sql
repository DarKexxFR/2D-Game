-- Classement mondial de Survivor.
-- À coller une seule fois dans Supabase : SQL Editor → New query → Run.

create table if not exists public.scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 12),
  wave int not null check (wave between 1 and 1000),
  xp bigint not null check (xp between 0 and 100000000),
  lvl int not null check (lvl between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists scores_xp_idx on public.scores (xp desc);

-- Sécurité : tout le monde peut lire et ajouter un score,
-- personne ne peut modifier ni supprimer (la clé anon est publique).
alter table public.scores enable row level security;

drop policy if exists "Lecture publique" on public.scores;
create policy "Lecture publique" on public.scores
  for select to anon using (true);

drop policy if exists "Ajout public" on public.scores;
create policy "Ajout public" on public.scores
  for insert to anon with check (true);

revoke all on public.scores from anon;
grant select, insert on public.scores to anon;

-- Garde-fou anti-spam : 1 score maximum toutes les 10 secondes par pseudo.
create or replace function public.scores_rate_limit() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.scores
    where lower(name) = lower(new.name)
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Trop de scores envoyés, réessaie plus tard';
  end if;
  return new;
end $$;

drop trigger if exists scores_rate_limit on public.scores;
create trigger scores_rate_limit before insert on public.scores
  for each row execute function public.scores_rate_limit();

-- Vue : meilleur score de chaque joueur (un pseudo n'apparaît qu'une fois).
create or replace view public.leaderboard with (security_invoker = true) as
  select distinct on (lower(name)) name, wave, xp, lvl, created_at
  from public.scores
  order by lower(name), xp desc;

grant select on public.leaderboard to anon;
