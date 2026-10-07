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

-- =====================================================================
-- Sauvegarde en ligne : la progression est rangée sous un code secret
-- (XXXX-XXXX-XXXX). La table n'est PAS lisible directement : on passe
-- uniquement par les deux fonctions ci-dessous, qui exigent le code.
-- =====================================================================

create table if not exists public.cloud_saves (
  code text primary key check (code ~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$'),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.cloud_saves enable row level security;
revoke all on public.cloud_saves from anon;

create or replace function public.save_progress(p_code text, p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_code !~ '^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$' then
    raise exception 'Code invalide';
  end if;
  if octet_length(p_data::text) > 200000 then
    raise exception 'Sauvegarde trop volumineuse';
  end if;
  if exists (
    select 1 from cloud_saves where code = p_code and updated_at > now() - interval '2 seconds'
  ) then
    raise exception 'Trop de sauvegardes, réessaie plus tard';
  end if;
  insert into cloud_saves (code, data, updated_at) values (p_code, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now();
end $$;

create or replace function public.load_progress(p_code text) returns jsonb
language sql security definer set search_path = public stable as $$
  select data from cloud_saves where code = p_code;
$$;

revoke all on function public.save_progress(text, jsonb) from public;
revoke all on function public.load_progress(text) from public;
grant execute on function public.save_progress(text, jsonb) to anon;
grant execute on function public.load_progress(text) to anon;

-- =====================================================================
-- Défi quotidien : classement séparé, un jour (UTC) = un classement.
-- =====================================================================

create table if not exists public.daily_scores (
  id bigint generated always as identity primary key,
  day date not null,
  name text not null check (char_length(btrim(name)) between 1 and 12),
  wave int not null check (wave between 1 and 1000),
  xp bigint not null check (xp between 0 and 100000000),
  lvl int not null check (lvl between 1 and 1000),
  created_at timestamptz not null default now(),
  -- On ne peut envoyer un score que pour aujourd'hui (ou hier, autour de minuit)
  check (day between (now() at time zone 'utc')::date - 1 and (now() at time zone 'utc')::date)
);

create index if not exists daily_scores_day_xp_idx on public.daily_scores (day, xp desc);

alter table public.daily_scores enable row level security;

drop policy if exists "Lecture publique" on public.daily_scores;
create policy "Lecture publique" on public.daily_scores for select to anon using (true);

drop policy if exists "Ajout public" on public.daily_scores;
create policy "Ajout public" on public.daily_scores for insert to anon with check (true);

revoke all on public.daily_scores from anon;
grant select, insert on public.daily_scores to anon;

create or replace function public.daily_scores_rate_limit() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.daily_scores
    where lower(name) = lower(new.name)
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Trop de scores envoyés, réessaie plus tard';
  end if;
  return new;
end $$;

drop trigger if exists daily_scores_rate_limit on public.daily_scores;
create trigger daily_scores_rate_limit before insert on public.daily_scores
  for each row execute function public.daily_scores_rate_limit();

-- Meilleur score de chaque joueur pour chaque jour
create or replace view public.daily_leaderboard with (security_invoker = true) as
  select distinct on (day, lower(name)) day, name, wave, xp, lvl, created_at
  from public.daily_scores
  order by day, lower(name), xp desc;

grant select on public.daily_leaderboard to anon;
