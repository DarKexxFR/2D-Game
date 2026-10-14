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
-- Sauvegarde liée au compte (connexion Google ou code par e-mail, facultative).
-- Une ligne par joueur connecté. Pas d'accès direct à la table : uniquement
-- les fonctions ci-dessous, qui utilisent l'identité du joueur (auth.uid()).
-- =====================================================================

create table if not exists public.account_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.account_saves enable row level security;
revoke all on public.account_saves from anon, authenticated;

create or replace function public.save_account_progress(p_data jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  if octet_length(p_data::text) > 200000 then
    raise exception 'Sauvegarde trop volumineuse';
  end if;
  if exists (
    select 1 from account_saves where user_id = auth.uid() and updated_at > now() - interval '2 seconds'
  ) then
    raise exception 'Trop de sauvegardes, réessaie plus tard';
  end if;
  insert into account_saves (user_id, data, updated_at) values (auth.uid(), p_data, now())
  on conflict (user_id) do update set data = excluded.data, updated_at = now();
end $$;

create or replace function public.load_account_progress() returns jsonb
language sql security definer set search_path = public stable as $$
  select data from account_saves where user_id = auth.uid();
$$;

-- Droit à l'effacement : le joueur supprime lui-même sa sauvegarde en ligne.
create or replace function public.delete_account_progress() returns void
language sql security definer set search_path = public as $$
  delete from account_saves where user_id = auth.uid();
$$;

revoke all on function public.save_account_progress(jsonb) from public;
revoke all on function public.load_account_progress() from public;
revoke all on function public.delete_account_progress() from public;
grant execute on function public.save_account_progress(jsonb) to authenticated;
grant execute on function public.load_account_progress() to authenticated;
grant execute on function public.delete_account_progress() to authenticated;

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

-- =====================================================================
-- Classement ELO du duel en ligne (joueurs connectés seulement).
-- Chaque joueur déclare le résultat d'un duel (report_duel) ; le classement ne bouge que quand
-- les DEUX joueurs ont déclaré le même duel et sont d'accord (un gagnant, un perdant).
-- Un seul joueur ne peut donc pas s'inventer des victoires. Aucun accès direct aux tables.
-- =====================================================================

create table if not exists public.duel_ratings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 12),
  rating int not null default 1000,
  wins int not null default 0,
  losses int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists duel_ratings_rating_idx on public.duel_ratings (rating desc);

-- Déclarations : une par joueur et par duel (modifiable tant que le duel n'est pas compté)
create table if not exists public.duel_reports (
  match_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  won boolean not null,
  created_at timestamptz not null default now(),
  primary key (match_id, user_id)
);

-- Duels comptés (delta = points gagnés par le vainqueur et perdus par le perdant ; 0 = non classé)
create table if not exists public.duel_matches (
  match_id uuid primary key,
  winner uuid references auth.users (id) on delete set null,
  loser uuid references auth.users (id) on delete set null,
  delta int not null,
  created_at timestamptz not null default now()
);

alter table public.duel_ratings enable row level security;
alter table public.duel_reports enable row level security;
alter table public.duel_matches enable row level security;
revoke all on public.duel_ratings, public.duel_reports, public.duel_matches from anon, authenticated;

-- Déclare le résultat d'un duel pour le joueur connecté. Renvoie
-- { status: "pending" (en attente de l'adversaire) | "settled", rating, delta }.
create or replace function public.report_duel(p_match uuid, p_won boolean, p_name text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other duel_reports;
  done duel_matches;
  w duel_ratings;
  l duel_ratings;
  d int;
  farmed boolean;
begin
  if me is null then
    raise exception 'Non connecté';
  end if;
  if p_match is null or char_length(btrim(coalesce(p_name, ''))) not between 1 and 12 then
    raise exception 'Duel invalide';
  end if;
  perform pg_advisory_xact_lock(hashtext(p_match::text)); -- deux déclarations simultanées

  insert into duel_ratings (user_id, name) values (me, btrim(p_name))
  on conflict (user_id) do update set name = excluded.name;

  select * into done from duel_matches where match_id = p_match;
  if found then
    return jsonb_build_object(
      'status', 'settled',
      'rating', (select rating from duel_ratings where user_id = me),
      'delta', case when done.winner = me then done.delta when done.loser = me then -done.delta else 0 end
    );
  end if;

  if not exists (select 1 from duel_reports where match_id = p_match and user_id = me) then
    -- Un duel = deux joueurs ; garde-fou anti-spam : un nouveau duel toutes les 15 secondes
    if (select count(*) from duel_reports where match_id = p_match) >= 2 then
      raise exception 'Duel invalide';
    end if;
    if exists (select 1 from duel_reports where user_id = me and created_at > now() - interval '15 seconds') then
      raise exception 'Trop de duels déclarés, réessaie plus tard';
    end if;
  end if;
  insert into duel_reports (match_id, user_id, won) values (p_match, me, p_won)
  on conflict (match_id, user_id) do update set won = excluded.won;

  select * into other from duel_reports where match_id = p_match and user_id <> me;
  if not found or other.won = p_won then
    return jsonb_build_object('status', 'pending', 'rating', (select rating from duel_ratings where user_id = me));
  end if;

  -- Les deux joueurs sont d'accord : ELO classique (K = 32), plancher à 100
  select * into w from duel_ratings where user_id = case when p_won then me else other.user_id end for update;
  select * into l from duel_ratings where user_id = case when p_won then other.user_id else me end for update;
  d := round(32 * (1 - 1 / (1 + power(10, (l.rating - w.rating) / 400.0))));
  -- Anti-farm : au-delà de 5 duels comptés entre les deux mêmes joueurs en 24 h, duel non classé
  farmed := (
    select count(*) from duel_matches
    where created_at > now() - interval '24 hours' and delta > 0
      and ((winner = w.user_id and loser = l.user_id) or (winner = l.user_id and loser = w.user_id))
  ) >= 5;
  d := case when farmed then 0 else greatest(least(d, l.rating - 100), 0) end;
  update duel_ratings set rating = rating + d, wins = wins + (not farmed)::int, updated_at = now()
  where user_id = w.user_id;
  update duel_ratings set rating = rating - d, losses = losses + (not farmed)::int, updated_at = now()
  where user_id = l.user_id;
  insert into duel_matches (match_id, winner, loser, delta) values (p_match, w.user_id, l.user_id, d);
  delete from duel_reports where match_id = p_match;
  return jsonb_build_object(
    'status', 'settled',
    'rating', (select rating from duel_ratings where user_id = me),
    'delta', case when p_won then d else -d end
  );
end $$;

-- Classement : les meilleurs joueurs (au moins un duel compté), et la place du joueur connecté.
create or replace function public.get_duel_ranking(p_limit int default 50) returns jsonb
language sql security definer set search_path = public stable as $$
  select jsonb_build_object(
    'top', coalesce((
      select jsonb_agg(jsonb_build_object('name', name, 'rating', rating, 'wins', wins, 'losses', losses))
      from (
        select name, rating, wins, losses from duel_ratings
        where wins + losses > 0
        order by rating desc, wins desc
        limit least(greatest(p_limit, 1), 100)
      ) t
    ), '[]'::jsonb),
    'me', (
      select jsonb_build_object(
        'name', r.name, 'rating', r.rating, 'wins', r.wins, 'losses', r.losses,
        'rank', (select count(*) + 1 from duel_ratings o where o.wins + o.losses > 0 and o.rating > r.rating)
      )
      from duel_ratings r where r.user_id = auth.uid() and r.wins + r.losses > 0
    )
  );
$$;

revoke all on function public.report_duel(uuid, boolean, text) from public;
revoke all on function public.get_duel_ranking(int) from public;
grant execute on function public.report_duel(uuid, boolean, text) to authenticated;
grant execute on function public.get_duel_ranking(int) to anon, authenticated;

-- Droit à l'effacement (remplace la version plus haut) : sauvegarde du compte et données de duel.
create or replace function public.delete_account_progress() returns void
language sql security definer set search_path = public as $$
  delete from account_saves where user_id = auth.uid();
  delete from duel_reports where user_id = auth.uid();
  delete from duel_ratings where user_id = auth.uid();
$$;
