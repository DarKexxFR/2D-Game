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
-- Mode Cauchemar : classement mondial à part (mêmes règles que « scores »).
-- =====================================================================

create table if not exists public.nightmare_scores (
  id bigint generated always as identity primary key,
  name text not null check (char_length(btrim(name)) between 1 and 12),
  wave int not null check (wave between 1 and 1000),
  xp bigint not null check (xp between 0 and 100000000),
  lvl int not null check (lvl between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists nightmare_scores_xp_idx on public.nightmare_scores (xp desc);

alter table public.nightmare_scores enable row level security;

drop policy if exists "Lecture publique" on public.nightmare_scores;
create policy "Lecture publique" on public.nightmare_scores for select to anon using (true);

drop policy if exists "Ajout public" on public.nightmare_scores;
create policy "Ajout public" on public.nightmare_scores for insert to anon with check (true);

revoke all on public.nightmare_scores from anon;
grant select, insert on public.nightmare_scores to anon;

create or replace function public.nightmare_scores_rate_limit() returns trigger
language plpgsql as $$
begin
  if exists (
    select 1 from public.nightmare_scores
    where lower(name) = lower(new.name)
      and created_at > now() - interval '10 seconds'
  ) then
    raise exception 'Trop de scores envoyés, réessaie plus tard';
  end if;
  return new;
end $$;

drop trigger if exists nightmare_scores_rate_limit on public.nightmare_scores;
create trigger nightmare_scores_rate_limit before insert on public.nightmare_scores
  for each row execute function public.nightmare_scores_rate_limit();

create or replace view public.nightmare_leaderboard with (security_invoker = true) as
  select distinct on (lower(name)) name, wave, xp, lvl, created_at
  from public.nightmare_scores
  order by lower(name), xp desc;

grant select on public.nightmare_leaderboard to anon;

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

-- =====================================================================
-- Amis : profil public (pseudo, code ami, présence), demandes d'ami à accepter.
-- Les défis passent par Supabase Realtime (canal « amis-<id> » de l'ami, voir services/friends.js) ;
-- le duel lancé est le duel en ligne habituel, classé ELO comme les autres (report_duel).
-- Toutes les lectures et écritures passent par les fonctions ci-dessous (joueurs connectés seulement).
create table if not exists public.player_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 12),
  friend_code text not null unique,
  status text not null default 'menu' check (status in ('menu', 'jeu', 'duel')),
  last_seen timestamptz not null default now()
);
create index if not exists player_profiles_name_idx on public.player_profiles (lower(name));

-- Une ligne par paire : demande en attente (accepted = false) ou amitié (accepted = true)
create table if not exists public.friendships (
  requester uuid not null references auth.users (id) on delete cascade,
  addressee uuid not null references auth.users (id) on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (requester, addressee),
  check (requester <> addressee)
);
create index if not exists friendships_addressee_idx on public.friendships (addressee);

alter table public.player_profiles enable row level security;
alter table public.friendships enable row level security;
revoke all on public.player_profiles, public.friendships from anon, authenticated;

-- Profil (créé au besoin) + présence, puis amis, demandes reçues et envoyées. Appelé régulièrement
-- par le jeu : un ami est « en ligne » s'il s'est manifesté depuis moins de 75 secondes.
create or replace function public.friends_sync(p_name text, p_status text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  n text := left(coalesce(nullif(btrim(p_name), ''), 'Pilote'), 12);
  st text := case when p_status in ('menu', 'jeu', 'duel') then p_status else 'menu' end;
  fresh interval := interval '75 seconds';
begin
  if me is null then
    raise exception 'Non connecté';
  end if;
  update player_profiles set name = n, status = st, last_seen = now() where user_id = me;
  if not found then
    loop
      begin
        insert into player_profiles (user_id, name, friend_code, status)
        values (me, n, (
          select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '')
          from generate_series(1, 6)
        ), st)
        on conflict (user_id) do nothing;
        exit;
      exception when unique_violation then
        -- code ami déjà pris : on en tire un autre
      end;
    end loop;
  end if;
  return jsonb_build_object(
    'code', (select friend_code from player_profiles where user_id = me),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.user_id, 'name', p.name, 'online', p.last_seen > now() - fresh,
          'status', p.status, 'rating', r.rating
        ) order by p.last_seen > now() - fresh desc, lower(p.name))
      from friendships f
      join player_profiles p on p.user_id = case when f.requester = me then f.addressee else f.requester end
      left join duel_ratings r on r.user_id = p.user_id
      where f.accepted and me in (f.requester, f.addressee)
    ), '[]'::jsonb),
    'incoming', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.user_id, 'name', p.name) order by f.created_at)
      from friendships f join player_profiles p on p.user_id = f.requester
      where f.addressee = me and not f.accepted
    ), '[]'::jsonb),
    'outgoing', coalesce((
      select jsonb_agg(jsonb_build_object('id', p.user_id, 'name', p.name) order by f.created_at)
      from friendships f join player_profiles p on p.user_id = f.addressee
      where f.requester = me and not f.accepted
    ), '[]'::jsonb)
  );
end;
$$;

-- Demande d'ami par code ami ou par pseudo (si un seul joueur le porte). Si l'autre joueur nous a
-- déjà demandé, l'amitié est acceptée directement. Erreurs « ami:<raison> », lues par le jeu.
create or replace function public.friend_request(p_query text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  q text := btrim(coalesce(p_query, ''));
  target uuid;
  target_name text;
  matches int;
begin
  if me is null then
    raise exception 'Non connecté';
  end if;
  if not exists (select 1 from player_profiles where user_id = me) then
    raise exception 'ami:introuvable';
  end if;
  select user_id, name into target, target_name from player_profiles
  where friend_code = upper(regexp_replace(q, '^#', ''));
  if target is null then
    select count(*) into matches from player_profiles where lower(name) = lower(q) and user_id <> me;
    if matches > 1 then
      raise exception 'ami:ambigu';
    end if;
    select user_id, name into target, target_name from player_profiles
    where lower(name) = lower(q) and user_id <> me;
  end if;
  if target is null then
    raise exception 'ami:introuvable';
  end if;
  if target = me then
    raise exception 'ami:soi';
  end if;
  if exists (select 1 from friendships where requester = target and addressee = me and not accepted) then
    update friendships set accepted = true where requester = target and addressee = me;
    return jsonb_build_object('status', 'accepted', 'id', target, 'name', target_name);
  end if;
  if exists (
    select 1 from friendships
    where (requester = me and addressee = target) or (requester = target and addressee = me)
  ) then
    raise exception 'ami:deja';
  end if;
  -- Anti-spam : 100 amis et demandes au plus, 30 demandes en attente, une demande toutes les 3 secondes
  if (select count(*) from friendships where me in (requester, addressee)) >= 100
     or (select count(*) from friendships where requester = me and not accepted) >= 30
     or exists (select 1 from friendships where requester = me and created_at > now() - interval '3 seconds') then
    raise exception 'ami:trop';
  end if;
  insert into friendships (requester, addressee) values (me, target);
  return jsonb_build_object('status', 'sent', 'id', target, 'name', target_name);
end;
$$;

-- Réponse à une demande reçue (accepter ou refuser)
create or replace function public.friend_respond(p_id uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'Non connecté';
  end if;
  if p_accept then
    update friendships set accepted = true where requester = p_id and addressee = auth.uid() and not accepted;
  else
    delete from friendships where requester = p_id and addressee = auth.uid() and not accepted;
  end if;
end;
$$;

-- Retire un ami, ou annule une demande envoyée
create or replace function public.friend_remove(p_id uuid) returns void
language sql security definer set search_path = public as $$
  delete from friendships
  where (requester = auth.uid() and addressee = p_id) or (requester = p_id and addressee = auth.uid());
$$;

revoke all on function public.friends_sync(text, text) from public;
revoke all on function public.friend_request(text) from public;
revoke all on function public.friend_respond(uuid, boolean) from public;
revoke all on function public.friend_remove(uuid) from public;
grant execute on function public.friends_sync(text, text) to authenticated;
grant execute on function public.friend_request(text) to authenticated;
grant execute on function public.friend_respond(uuid, boolean) to authenticated;
grant execute on function public.friend_remove(uuid) to authenticated;

-- Droit à l'effacement (remplace les versions plus haut) : sauvegarde, duel et amis.
create or replace function public.delete_account_progress() returns void
language sql security definer set search_path = public as $$
  delete from account_saves where user_id = auth.uid();
  delete from duel_reports where user_id = auth.uid();
  delete from duel_ratings where user_id = auth.uid();
  delete from friendships where auth.uid() in (requester, addressee);
  delete from player_profiles where user_id = auth.uid();
$$;

-- =====================================================================
-- Notifications (Web Push) : abonnements des appareils et rappels à envoyer.
-- Le jeu calcule lui-même ses rappels (heure locale du joueur) et les envoie avec push_subscribe ;
-- la fonction Edge « send-push » (supabase/functions/send-push) passe régulièrement, prend les
-- rappels arrivés à échéance (push_claim) et rend compte de l'envoi (push_report).
-- Mise en place complète (clés, fonction, planification) : supabase/NOTIFICATIONS.md.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null unique check (char_length(endpoint) <= 1024),
  p256dh text not null check (char_length(p256dh) <= 128),
  auth text not null check (char_length(auth) <= 64),
  user_id uuid references auth.users (id) on delete set null, -- joueur connecté (demandes d'ami)
  topics text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  failures int not null default 0, -- échecs d'envoi d'affilée (abonnement supprimé à 5)
  sent_day date,
  sent_count int not null default 0 -- notifications envoyées le jour sent_day (plafond quotidien)
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id)
  where user_id is not null;

-- Un rappel par type et par appareil : la liste envoyée par le jeu remplace la précédente.
create table if not exists public.push_reminders (
  subscription_id uuid not null references public.push_subscriptions (id) on delete cascade,
  kind text not null check (kind in ('streak', 'quests', 'friends', 'comeback1', 'comeback2')),
  send_at timestamptz not null,
  data jsonb not null default '{}',
  claimed_at timestamptz, -- pris par un envoi en cours
  primary key (subscription_id, kind)
);
create index if not exists push_reminders_due_idx on public.push_reminders (send_at);

alter table public.push_subscriptions enable row level security;
alter table public.push_reminders enable row level security;
revoke all on public.push_subscriptions, public.push_reminders from anon, authenticated;

-- Seuls les services de notification des navigateurs sont acceptés (Chrome / Android, Firefox,
-- Safari / iPhone, Edge / Windows) : la fonction d'envoi ne contacte jamais une autre adresse.
create or replace function public.push_endpoint_ok(p text) returns boolean
language sql immutable as $$
  select p ~ '^https://(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9.-]+\.push\.apple\.com|[a-z0-9.-]+\.notify\.windows\.com)/'
$$;

-- Abonnement de l'appareil + rappels voulus. Appelé par le jeu à chaque changement (et au plus
-- toutes les 12 h sans changement). Un joueur connecté relie l'appareil à son compte.
create or replace function public.push_subscribe(
  p_endpoint text, p_p256dh text, p_auth text, p_topics text[], p_reminders jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  sub uuid;
  r jsonb;
  k text;
  v_at timestamptz;
  v_topics text[];
begin
  if not push_endpoint_ok(coalesce(p_endpoint, '')) then
    raise exception 'Adresse de notification refusée';
  end if;
  if coalesce(p_p256dh, '') !~ '^[A-Za-z0-9_-]{80,100}$' or coalesce(p_auth, '') !~ '^[A-Za-z0-9_-]{16,32}$' then
    raise exception 'Clés de notification invalides';
  end if;
  if jsonb_typeof(p_reminders) is distinct from 'array' or jsonb_array_length(p_reminders) > 10 then
    raise exception 'Rappels invalides';
  end if;
  -- Garde-fou contre une rafale d'abonnements inventés
  if not exists (select 1 from push_subscriptions where endpoint = p_endpoint)
     and (select count(*) from push_subscriptions where created_at > now() - interval '1 minute') >= 300 then
    raise exception 'Trop de demandes, réessaie plus tard';
  end if;
  v_topics := array(
    select distinct t from unnest(coalesce(p_topics, '{}')) t
    where t in ('streak', 'quests', 'friends', 'comeback')
  );

  insert into push_subscriptions (endpoint, p256dh, auth, user_id, topics)
  values (p_endpoint, p_p256dh, p_auth, auth.uid(), v_topics)
  on conflict (endpoint) do update
    set p256dh = excluded.p256dh, auth = excluded.auth, user_id = excluded.user_id,
        topics = excluded.topics, last_seen = now(), failures = 0
  returning id into sub;

  -- La liste du jeu remplace l'ancienne (les demandes d'ami viennent du serveur : gardées si voulues)
  delete from push_reminders
  where subscription_id = sub
    and claimed_at is null
    and (kind <> 'friends' or not ('friends' = any(v_topics)));
  for r in select * from jsonb_array_elements(p_reminders) loop
    k := r->>'kind';
    if k not in ('streak', 'quests', 'comeback1', 'comeback2') then continue; end if;
    begin
      v_at := (r->>'at')::timestamptz;
    exception when others then continue;
    end;
    if v_at <= now() or v_at > now() + interval '35 days' then continue; end if;
    -- Seuls des nombres sont gardés (jour de série, or, record de vague) : le texte est écrit par le serveur
    insert into push_reminders (subscription_id, kind, send_at, data)
    values (sub, k, v_at, (
      select coalesce(jsonb_object_agg(key, (value #>> '{}')::int), '{}')
      from jsonb_each(case when jsonb_typeof(r->'data') = 'object' then r->'data' else '{}' end)
      where key in ('day', 'gold', 'best') and (value #>> '{}') ~ '^[0-9]{1,6}$'
    ))
    on conflict (subscription_id, kind) do update
      set send_at = excluded.send_at, data = excluded.data, claimed_at = null;
  end loop;
end;
$$;

-- Désabonnement (notifications coupées dans les Options).
create or replace function public.push_unsubscribe(p_endpoint text) returns void
language sql security definer set search_path = public as $$
  delete from push_subscriptions where endpoint = p_endpoint;
$$;

-- Envoi (fonction Edge, clé de service) : prend au plus p_limit rappels arrivés à échéance.
-- « skip locked » : plusieurs envois en même temps ne prennent jamais le même rappel.
-- Un rappel pris mais jamais rendu (envoi interrompu) redevient disponible au bout de 10 minutes.
create or replace function public.push_claim(p_limit int default 500)
returns table (subscription_id uuid, kind text, data jsonb, endpoint text, p256dh text, auth text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  -- Rappels trop en retard (envois arrêtés longtemps) : abandonnés plutôt qu'envoyés à contretemps
  delete from push_reminders r where r.send_at < now() - interval '1 day';
  -- Plafond : 2 notifications par appareil et par jour, hors réponses d'amis
  delete from push_reminders r
  using push_subscriptions s
  where s.id = r.subscription_id and r.send_at <= now() and r.kind <> 'friends' and r.claimed_at is null
    and s.sent_day = current_date and s.sent_count >= 2;

  return query
  with due as (
    select r.subscription_id, r.kind
    from push_reminders r
    where r.send_at <= now() and (r.claimed_at is null or r.claimed_at < now() - interval '10 minutes')
    order by r.send_at
    limit least(greatest(coalesce(p_limit, 500), 1), 1000)
    for update skip locked
  ), claimed as (
    update push_reminders r set claimed_at = now()
    from due
    where r.subscription_id = due.subscription_id and r.kind = due.kind
    returning r.subscription_id, r.kind, r.data
  )
  select c.subscription_id, c.kind, c.data, s.endpoint, s.p256dh, s.auth
  from claimed c join push_subscriptions s on s.id = c.subscription_id;
end;
$$;

-- Compte rendu de l'envoi : [{ "id": abonnement, "kind": type, "status": "sent" | "gone" | "retry" }].
-- gone = abonnement expiré ou révoqué (supprimé) ; retry = nouvel essai dans 15 minutes.
create or replace function public.push_report(p_results jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  -- Envoyés : retirés (sauf s'ils ont été reprogrammés entre-temps par le jeu : claimed_at remis à null)
  delete from push_reminders r
  using jsonb_to_recordset(coalesce(p_results, '[]')) as x(id uuid, kind text, status text)
  where x.status = 'sent' and r.subscription_id = x.id and r.kind = x.kind and r.claimed_at is not null;
  update push_subscriptions s
  set failures = 0,
      sent_count = case when s.sent_day = current_date then s.sent_count + n.count else n.count end,
      sent_day = current_date
  from (
    select x.id, count(*)::int as count
    from jsonb_to_recordset(coalesce(p_results, '[]')) as x(id uuid, kind text, status text)
    where x.status = 'sent' group by x.id
  ) n
  where s.id = n.id;

  delete from push_subscriptions s
  using jsonb_to_recordset(coalesce(p_results, '[]')) as x(id uuid, kind text, status text)
  where x.status = 'gone' and s.id = x.id;

  update push_reminders r set claimed_at = null, send_at = now() + interval '15 minutes'
  from jsonb_to_recordset(coalesce(p_results, '[]')) as x(id uuid, kind text, status text)
  where x.status = 'retry' and r.subscription_id = x.id and r.kind = x.kind;
  update push_subscriptions s set failures = s.failures + 1
  from (
    select distinct x.id
    from jsonb_to_recordset(coalesce(p_results, '[]')) as x(id uuid, kind text, status text)
    where x.status = 'retry'
  ) n
  where s.id = n.id;
  delete from push_subscriptions where failures >= 5;
end;
$$;

-- Demandes d'ami : prévient le joueur visé (demande reçue) ou le demandeur (demande acceptée).
-- Une erreur ici ne doit jamais empêcher l'amitié elle-même.
create or replace function public.push_friend_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  actor uuid;
  ev text;
begin
  if tg_op = 'INSERT' and not new.accepted then
    target := new.addressee; actor := new.requester; ev := 'request';
  elsif tg_op = 'UPDATE' and new.accepted and not old.accepted then
    target := new.requester; actor := new.addressee; ev := 'accepted';
  else
    return new;
  end if;
  begin
    insert into push_reminders (subscription_id, kind, send_at, data)
    select s.id, 'friends', now(), jsonb_build_object(
      'event', ev,
      'name', coalesce((select p.name from player_profiles p where p.user_id = actor), 'Un pilote')
    )
    from push_subscriptions s
    where s.user_id = target and 'friends' = any(s.topics)
    on conflict (subscription_id, kind) do update
      set send_at = excluded.send_at, data = excluded.data, claimed_at = null;
  exception when others then
    null;
  end;
  return new;
end;
$$;

drop trigger if exists friendships_push on public.friendships;
create trigger friendships_push
  after insert or update of accepted on public.friendships
  for each row execute function public.push_friend_event();

revoke all on function public.push_endpoint_ok(text) from public;
revoke all on function public.push_subscribe(text, text, text, text[], jsonb) from public;
revoke all on function public.push_unsubscribe(text) from public;
revoke all on function public.push_claim(int) from public;
revoke all on function public.push_report(jsonb) from public;
revoke all on function public.push_friend_event() from public;
grant execute on function public.push_subscribe(text, text, text, text[], jsonb) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;
grant execute on function public.push_claim(int) to service_role;
grant execute on function public.push_report(jsonb) to service_role;

-- Droit à l'effacement (remplace les versions plus haut) : sauvegarde, duel, amis, et les appareils
-- abonnés aux notifications ne sont plus reliés au compte.
create or replace function public.delete_account_progress() returns void
language sql security definer set search_path = public as $$
  delete from account_saves where user_id = auth.uid();
  delete from duel_reports where user_id = auth.uid();
  delete from duel_ratings where user_id = auth.uid();
  delete from friendships where auth.uid() in (requester, addressee);
  delete from player_profiles where user_id = auth.uid();
  update push_subscriptions set user_id = null where user_id = auth.uid();
$$;

-- =====================================================================
-- Endless Pulse et saison mensuelle (classements)
-- « pulse » = pulsations franchies après la victoire sur le Cœur du Pulse (0 sinon).
-- Saison = mois UTC en cours : son classement repart à zéro le 1er à 0 h UTC.
-- =====================================================================

alter table public.scores add column if not exists pulse int not null default 0;
alter table public.nightmare_scores add column if not exists pulse int not null default 0;

-- Une pulsation suit forcément la vague 30 : pulsation N => vague 30 + N au moins
do $$ begin
  alter table public.scores add constraint scores_pulse_check check (pulse between 0 and 1000 and (pulse = 0 or wave >= 30 + pulse));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.nightmare_scores add constraint nightmare_scores_pulse_check check (pulse between 0 and 1000 and (pulse = 0 or wave >= 30 + pulse));
exception when duplicate_object then null; end $$;

create index if not exists scores_created_idx on public.scores (created_at);
create index if not exists scores_pulse_idx on public.scores (pulse desc) where pulse > 0;
create index if not exists nightmare_scores_pulse_idx on public.nightmare_scores (pulse desc) where pulse > 0;

-- Saison : meilleur score de chaque joueur depuis le 1er du mois (UTC)
create or replace view public.season_leaderboard with (security_invoker = true) as
  select distinct on (lower(name)) name, wave, xp, lvl, created_at
  from public.scores
  where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
  order by lower(name), xp desc;

grant select on public.season_leaderboard to anon;

-- Endless Pulse : meilleure partie de chaque joueur (Normal et Cauchemar), par pulsations puis XP
create or replace view public.endless_leaderboard with (security_invoker = true) as
  select distinct on (lower(name)) name, pulse, wave, xp, lvl, nightmare, created_at
  from (
    select name, pulse, wave, xp, lvl, false as nightmare, created_at from public.scores where pulse > 0
    union all
    select name, pulse, wave, xp, lvl, true as nightmare, created_at from public.nightmare_scores where pulse > 0
  ) s
  order by lower(name), pulse desc, xp desc;

grant select on public.endless_leaderboard to anon;

-- =====================================================================
-- Statistiques de fréquentation anonymes (voir supabase/STATISTIQUES.md)
-- Un identifiant tiré au hasard par appareil (`device`), une ligne par ouverture du jeu (session) et une
-- par partie. Aucun pseudo, aucun compte, aucune adresse IP. Le jeu écrit seulement par track_session /
-- track_run ; personne ne lit les tables, sauf admin_stats() réservée aux comptes de analytics_admins.
-- =====================================================================

create table if not exists public.analytics_devices (
  device uuid primary key,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now()
);

create table if not exists public.analytics_sessions (
  id uuid primary key,
  device uuid not null references public.analytics_devices (device) on delete cascade,
  started_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  active_seconds int not null default 0, -- onglet visible et joueur présent
  play_seconds int not null default 0, -- en partie, hors pause
  runs int not null default 0,
  mobile boolean not null default false,
  installed boolean not null default false, -- lancé depuis l'icône (application installée)
  logged_in boolean not null default false, -- compte connecté (oui / non seulement)
  lang text not null default '',
  host text not null default '' -- last-pulse.com, ancienne adresse, localhost (exclu des statistiques)
);

create index if not exists analytics_sessions_started_idx on public.analytics_sessions (started_at);
create index if not exists analytics_sessions_device_idx on public.analytics_sessions (device, started_at);
create index if not exists analytics_sessions_seen_idx on public.analytics_sessions (last_seen);

create table if not exists public.analytics_runs (
  id bigint generated always as identity primary key,
  session uuid not null references public.analytics_sessions (id) on delete cascade,
  created_at timestamptz not null default now(),
  mode text not null, -- normal, daily, rush, duel, duel-local
  difficulty text not null default 'normal',
  wave int not null default 0,
  pulse int not null default 0,
  level int not null default 0,
  kills int not null default 0,
  seconds int not null default 0,
  hero text not null default '',
  weapon text not null default '',
  killer text not null default '', -- « abandon », nom de l'ennemi, vide pour une victoire
  victory boolean not null default false
);

create index if not exists analytics_runs_created_idx on public.analytics_runs (created_at);
create index if not exists analytics_runs_session_idx on public.analytics_runs (session);

-- Comptes autorisés à lire les statistiques (à remplir à la main, voir STATISTIQUES.md)
create table if not exists public.analytics_admins (
  user_id uuid primary key references auth.users (id) on delete cascade
);

alter table public.analytics_devices enable row level security;
alter table public.analytics_sessions enable row level security;
alter table public.analytics_runs enable row level security;
alter table public.analytics_admins enable row level security;
revoke all on public.analytics_devices, public.analytics_sessions, public.analytics_runs,
  public.analytics_admins from anon, authenticated;

-- Ouverture du jeu, puis compteurs cumulés envoyés chaque minute. Les compteurs ne font que monter, jamais
-- plus vite que le temps réel ; 30 sessions par appareil et par heure au plus.
create or replace function public.track_session(
  p_session uuid, p_device uuid, p_active int, p_play int, p_runs int,
  p_mobile boolean, p_installed boolean, p_logged boolean, p_lang text, p_host text
) returns void
language plpgsql security definer set search_path = public as $$
declare
  s analytics_sessions;
  elapsed int;
begin
  if p_session is null or p_device is null then return; end if;
  select * into s from analytics_sessions where id = p_session;
  if not found then
    if (select count(*) from analytics_sessions
        where device = p_device and started_at > now() - interval '1 hour') >= 30 then
      return;
    end if;
    insert into analytics_devices (device) values (p_device)
      on conflict (device) do update set last_seen = now();
    insert into analytics_sessions (id, device, active_seconds, play_seconds, runs, mobile, installed, logged_in, lang, host)
    values (
      p_session, p_device,
      least(greatest(coalesce(p_active, 0), 0), 120),
      least(greatest(coalesce(p_play, 0), 0), 120),
      0,
      coalesce(p_mobile, false), coalesce(p_installed, false), coalesce(p_logged, false),
      left(coalesce(p_lang, ''), 10), left(coalesce(p_host, ''), 60)
    )
    on conflict (id) do nothing;
    return;
  end if;
  -- Une autre session ne peut pas être modifiée ; au plus un envoi toutes les 3 secondes
  if s.device <> p_device or s.last_seen > now() - interval '3 seconds' then return; end if;
  elapsed := extract(epoch from now() - s.started_at)::int + 60;
  update analytics_sessions set
    last_seen = now(),
    active_seconds = greatest(active_seconds, least(coalesce(p_active, 0), elapsed)),
    play_seconds = greatest(play_seconds, least(coalesce(p_play, 0), elapsed)),
    installed = installed or coalesce(p_installed, false),
    logged_in = logged_in or coalesce(p_logged, false)
  where id = p_session;
  update analytics_devices set last_seen = now() where device = p_device;
end $$;

-- Fin d'une partie (ou abandon) : une ligne par partie, valeurs bornées, au plus une toutes les 5 secondes.
create or replace function public.track_run(
  p_session uuid, p_device uuid, p_mode text, p_difficulty text, p_wave int, p_pulse int, p_level int,
  p_kills int, p_seconds int, p_hero text, p_weapon text, p_killer text, p_victory boolean
) returns void
language plpgsql security definer set search_path = public as $$
declare
  s analytics_sessions;
begin
  select * into s from analytics_sessions where id = p_session and device = p_device;
  if not found or p_mode not in ('normal', 'daily', 'rush', 'duel', 'duel-local') then return; end if;
  if exists (select 1 from analytics_runs where session = p_session and created_at > now() - interval '5 seconds') then
    return;
  end if;
  insert into analytics_runs (session, mode, difficulty, wave, pulse, level, kills, seconds, hero, weapon, killer, victory)
  values (
    p_session, p_mode,
    case when p_difficulty in ('easy', 'normal', 'nightmare') then p_difficulty else 'normal' end,
    least(greatest(coalesce(p_wave, 0), 0), 1000),
    least(greatest(coalesce(p_pulse, 0), 0), 1000),
    least(greatest(coalesce(p_level, 0), 0), 1000),
    least(greatest(coalesce(p_kills, 0), 0), 10000000),
    least(greatest(coalesce(p_seconds, 0), 0), extract(epoch from now() - s.started_at)::int + 60),
    left(coalesce(p_hero, ''), 30), left(coalesce(p_weapon, ''), 30), left(coalesce(p_killer, ''), 40),
    coalesce(p_victory, false)
  );
  update analytics_sessions set runs = runs + 1, last_seen = now() where id = p_session;
end $$;

-- Tableau de bord (page stats.html) : réservé aux comptes de analytics_admins. Jours comptés dans le fuseau
-- `p_tz` ; les sessions de localhost (développement) sont exclues.
create or replace function public.admin_stats(p_days int default 30, p_tz text default 'Europe/Paris')
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
  v_today date := (now() at time zone p_tz)::date;
  v_from date := v_today - (v_days - 1);
  v_start timestamptz := v_from::timestamp at time zone p_tz;
  result jsonb;
begin
  if not exists (select 1 from analytics_admins where user_id = auth.uid()) then
    raise exception 'Statistiques réservées aux administrateurs' using errcode = '42501';
  end if;

  create temporary table if not exists _s on commit drop as
    select s.*, (s.started_at at time zone p_tz)::date as day
    from analytics_sessions s
    where s.host not in ('localhost', '127.0.0.1', '[::1]') and s.started_at >= v_start - interval '31 days';
  create temporary table if not exists _r on commit drop as
    select r.*, (r.created_at at time zone p_tz)::date as day
    from analytics_runs r join _s on _s.id = r.session
    where r.created_at >= v_start;
  create temporary table if not exists _d on commit drop as
    select d.device, (d.first_seen at time zone p_tz)::date as first_day
    from analytics_devices d where exists (select 1 from _s where _s.device = d.device);

  select jsonb_build_object(
    'generated_at', now(),
    'days', v_days,
    'timezone', p_tz,
    'online_now', (select count(distinct device) from _s where last_seen > now() - interval '2 minutes'),
    'players_today', (select count(distinct device) from _s where day = v_today),
    'players_7d', (select count(distinct device) from _s where day > v_today - 7),
    'players_30d', (select count(distinct device) from _s where day > v_today - 30),
    'players_period', (select count(distinct device) from _s where day >= v_from),
    'players_total', (select count(*) from analytics_devices d where exists (
                        select 1 from analytics_sessions s
                        where s.device = d.device and s.host not in ('localhost', '127.0.0.1', '[::1]'))),
    'new_today', (select count(*) from _d where first_day = v_today),
    'new_period', (select count(*) from _d where first_day >= v_from),
    'sessions_period', (select count(*) from _s where day >= v_from),
    'avg_session_minutes', (select round(avg(active_seconds) / 60.0, 1) from _s where day >= v_from),
    'median_session_minutes', (select round((percentile_cont(0.5) within group (order by active_seconds) / 60.0)::numeric, 1)
                               from _s where day >= v_from),
    'play_hours_period', (select round(sum(play_seconds) / 3600.0, 1) from _s where day >= v_from),
    'avg_daily_minutes_per_player', (
      select round(avg(m), 1) from (
        select sum(active_seconds) / 60.0 as m from _s where day >= v_from group by device, day
      ) x),
    'share_mobile', (select round(avg(case when mobile then 1 else 0 end) * 100) from _s where day >= v_from),
    'share_installed', (select round(avg(case when installed then 1 else 0 end) * 100) from _s where day >= v_from),
    'share_logged', (select round(avg(case when logged_in then 1 else 0 end) * 100) from _s where day >= v_from),
    'runs_period', (select count(*) from _r),
    'victories_period', (select count(*) from _r where victory),
    'best_pulse_period', (select coalesce(max(pulse), 0) from _r),
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', g.day,
        'players', (select count(distinct device) from _s where _s.day = g.day),
        'new_players', (select count(*) from _d where first_day = g.day),
        'sessions', (select count(*) from _s where _s.day = g.day),
        'active_minutes', (select coalesce(round(sum(active_seconds) / 60.0), 0) from _s where _s.day = g.day),
        'play_minutes', (select coalesce(round(sum(play_seconds) / 60.0), 0) from _s where _s.day = g.day),
        'runs', (select count(*) from _r where _r.day = g.day)
      ) order by g.day), '[]'::jsonb)
      from (select generate_series(v_from, v_today, interval '1 day')::date as day) g
    ),
    -- Rétention : part des nouveaux joueurs revenus N jours après leur premier jour (cohortes assez anciennes)
    'retention', (
      select jsonb_object_agg(k, pct) from (
        select 'd' || n as k, (
          select round(100.0 * count(*) filter (where exists (
                   select 1 from _s where _s.device = _d.device and _s.day = _d.first_day + n))
                 / nullif(count(*), 0), 1)
          from _d where first_day >= v_from - 30 and first_day <= v_today - n
        ) as pct
        from unnest(array[1, 7, 30]) as n
      ) x
    ),
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'sessions', c) order by h), '[]'::jsonb) from (
        select extract(hour from started_at at time zone p_tz)::int as h, count(*) as c
        from _s where day >= v_from group by 1
      ) x
    ),
    'session_lengths', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'sessions', c) order by ord), '[]'::jsonb) from (
        select case
                 when active_seconds < 60 then 1 when active_seconds < 300 then 2 when active_seconds < 900 then 3
                 when active_seconds < 1800 then 4 when active_seconds < 3600 then 5 else 6 end as ord,
               case
                 when active_seconds < 60 then '< 1 min' when active_seconds < 300 then '1-5 min'
                 when active_seconds < 900 then '5-15 min' when active_seconds < 1800 then '15-30 min'
                 when active_seconds < 3600 then '30-60 min' else '> 1 h' end as label,
               count(*) as c
        from _s where day >= v_from group by 1, 2
      ) x
    ),
    'modes', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'mode', mode, 'runs', c, 'avg_wave', w, 'avg_minutes', m) order by c desc), '[]'::jsonb) from (
        select mode, count(*) as c, round(avg(wave), 1) as w, round(avg(seconds) / 60.0, 1) as m
        from _r group by mode
      ) x
    ),
    'difficulties', (
      select coalesce(jsonb_agg(jsonb_build_object('difficulty', difficulty, 'runs', c) order by c desc), '[]'::jsonb)
      from (select difficulty, count(*) as c from _r where mode = 'normal' group by difficulty) x
    ),
    'waves', (
      select coalesce(jsonb_agg(jsonb_build_object('label', label, 'runs', c) order by lo), '[]'::jsonb) from (
        select (least(wave, 31) - 1) / 5 * 5 + 1 as lo,
               case when wave > 30 then 'Endless' else ((wave - 1) / 5 * 5 + 1) || '-' || ((wave - 1) / 5 * 5 + 5) end as label,
               count(*) as c
        from _r where mode = 'normal' and wave > 0 group by 1, 2
      ) x
    ),
    'killers', (
      select coalesce(jsonb_agg(jsonb_build_object('name', killer, 'runs', c) order by c desc), '[]'::jsonb) from (
        select killer, count(*) as c from _r where killer <> '' and killer <> 'abandon' group by killer
        order by c desc limit 10
      ) x
    ),
    'abandons', (select count(*) from _r where killer = 'abandon'),
    'heroes', (
      select coalesce(jsonb_agg(jsonb_build_object('name', hero, 'runs', c) order by c desc), '[]'::jsonb) from (
        select hero, count(*) as c from _r where hero <> '' group by hero order by c desc limit 10
      ) x
    ),
    'weapons', (
      select coalesce(jsonb_agg(jsonb_build_object('name', weapon, 'runs', c) order by c desc), '[]'::jsonb) from (
        select weapon, count(*) as c from _r where weapon <> '' group by weapon order by c desc limit 10
      ) x
    )
  ) into result;
  drop table if exists _s, _r, _d;
  return result;
end $$;

-- =====================================================================
-- Rapports d'erreurs (journal de diagnostic du jeu, voir supabase/STATISTIQUES.md)
-- Envoyés par services/errorReports.js si le joueur accepte les statistiques anonymes : même identifiant
-- d'appareil tiré au hasard, ni pseudo, ni compte, ni adresse IP. Une erreur = une empreinte (même message au
-- même endroit du code) regroupant ses rapports ; seuls les 20 derniers rapports détaillés de chaque erreur
-- sont gardés. Lecture par admin_errors / admin_error_reports, réservées aux comptes de analytics_admins.
-- =====================================================================

create table if not exists public.error_groups (
  fingerprint text primary key,
  kind text not null, -- error, rejection, load (fichier non chargé), freeze (boucle du jeu arrêtée)
  message text not null,
  first_seen timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  occurrences int not null default 0, -- fois où l'erreur s'est produite (plusieurs par session possibles)
  reports int not null default 0, -- rapports reçus (au plus un par session de jeu)
  devices int not null default 0, -- appareils touchés
  first_build text not null default '',
  last_build text not null default '',
  resolved_at timestamptz, -- marquée corrigée dans stats.html
  regressed_at timestamptz -- revenue après avoir été marquée corrigée
);

create table if not exists public.error_devices (
  fingerprint text not null references public.error_groups (fingerprint) on delete cascade,
  device uuid not null,
  primary key (fingerprint, device)
);

create table if not exists public.error_reports (
  id uuid primary key, -- tiré par le jeu : un rapport renvoyé deux fois n'est compté qu'une fois
  fingerprint text not null references public.error_groups (fingerprint) on delete cascade,
  device uuid not null,
  session uuid,
  created_at timestamptz not null default now(),
  occurred_at timestamptz not null default now(),
  kind text not null,
  message text not null,
  stack text not null default '',
  build text not null default '',
  count int not null default 1,
  context jsonb not null default '{}'::jsonb, -- état du jeu (écran, mode, vague, boss, vie...)
  journal jsonb not null default '[]'::jsonb, -- dernières lignes du journal [horodatage ms, catégorie, texte]
  device_info jsonb not null default '{}'::jsonb -- navigateur, système, taille d'écran (sans identifiant)
);

create index if not exists error_reports_group_idx on public.error_reports (fingerprint, created_at desc);
create index if not exists error_reports_device_idx on public.error_reports (device, created_at);
create index if not exists error_reports_created_idx on public.error_reports (created_at);
create index if not exists error_groups_seen_idx on public.error_groups (last_seen);

alter table public.error_groups enable row level security;
alter table public.error_devices enable row level security;
alter table public.error_reports enable row level security;
revoke all on public.error_groups, public.error_devices, public.error_reports from anon, authenticated;

-- Un rapport d'erreur. Valeurs bornées ; au plus 20 rapports par appareil et par heure, 1000 en tout par heure.
create or replace function public.report_error(
  p_id uuid, p_device uuid, p_session uuid, p_kind text, p_fingerprint text, p_message text, p_stack text,
  p_build text, p_occurred_at timestamptz, p_count int, p_context jsonb, p_journal jsonb, p_device_info jsonb
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_at timestamptz := least(now(), greatest(coalesce(p_occurred_at, now()), now() - interval '30 days'));
  v_count int := least(greatest(coalesce(p_count, 1), 1), 100000);
  v_message text := left(coalesce(nullif(p_message, ''), '?'), 300);
  v_build text := left(coalesce(p_build, ''), 40);
begin
  if p_id is null or p_device is null or coalesce(p_fingerprint, '') !~ '^[0-9a-f]{8}$'
     or p_kind not in ('error', 'rejection', 'load', 'freeze') then
    return;
  end if;
  if exists (select 1 from error_reports where id = p_id) then return; end if;
  if (select count(*) from error_reports where device = p_device and created_at > now() - interval '1 hour') >= 20
     or (select count(*) from error_reports where created_at > now() - interval '1 hour') >= 1000 then
    return;
  end if;
  -- Morceaux trop gros ou mal formés : remplacés par une valeur vide plutôt que refusés
  if p_context is null or jsonb_typeof(p_context) <> 'object' or octet_length(p_context::text) > 4000 then
    p_context := '{}'::jsonb;
  end if;
  if p_journal is null or jsonb_typeof(p_journal) <> 'array' or octet_length(p_journal::text) > 20000 then
    p_journal := '[]'::jsonb;
  end if;
  if p_device_info is null or jsonb_typeof(p_device_info) <> 'object' or octet_length(p_device_info::text) > 1000 then
    p_device_info := '{}'::jsonb;
  end if;

  insert into error_groups as g (fingerprint, kind, message, first_seen, last_seen, occurrences, reports, first_build, last_build)
  values (p_fingerprint, p_kind, v_message, v_at, v_at, v_count, 1, v_build, v_build)
  on conflict (fingerprint) do update set
    last_seen = greatest(g.last_seen, v_at),
    message = excluded.message,
    last_build = case when v_at >= g.last_seen then excluded.last_build else g.last_build end,
    occurrences = g.occurrences + v_count,
    reports = g.reports + 1,
    -- Marquée corrigée, mais revue depuis : elle revient dans la liste
    regressed_at = case when g.resolved_at is not null and v_at > g.resolved_at then now() else g.regressed_at end,
    resolved_at = case when g.resolved_at is not null and v_at > g.resolved_at then null else g.resolved_at end;

  insert into error_devices (fingerprint, device) values (p_fingerprint, p_device) on conflict do nothing;
  if found then
    update error_groups set devices = devices + 1 where fingerprint = p_fingerprint;
  end if;

  insert into error_reports (id, fingerprint, device, session, occurred_at, kind, message, stack, build, count, context, journal, device_info)
  values (p_id, p_fingerprint, p_device, p_session, v_at, p_kind, v_message, left(coalesce(p_stack, ''), 4000),
          v_build, v_count, p_context, p_journal, p_device_info);

  -- Les 20 derniers rapports détaillés par erreur suffisent
  delete from error_reports where fingerprint = p_fingerprint and id in (
    select id from error_reports where fingerprint = p_fingerprint order by created_at desc offset 20);
end $$;

-- Liste des erreurs vues sur la période (page stats.html), les plus récentes d'abord
create or replace function public.admin_errors(p_days int default 30)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_days int := least(greatest(coalesce(p_days, 30), 1), 365);
begin
  if not exists (select 1 from analytics_admins where user_id = auth.uid()) then
    raise exception 'Statistiques réservées aux administrateurs' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'generated_at', now(),
    'days', v_days,
    'groups', (
      select coalesce(jsonb_agg(to_jsonb(g) order by g.resolved_at is not null, g.last_seen desc), '[]'::jsonb)
      from (
        select fingerprint, kind, message, first_seen, last_seen, occurrences, reports, devices,
               first_build, last_build, resolved_at, regressed_at
        from error_groups where last_seen >= now() - make_interval(days => v_days)
        order by last_seen desc limit 200
      ) g
    )
  );
end $$;

-- Derniers rapports détaillés d'une erreur (pile d'appels, état du jeu, journal, appareil)
create or replace function public.admin_error_reports(p_fingerprint text)
returns jsonb
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from analytics_admins where user_id = auth.uid()) then
    raise exception 'Statistiques réservées aux administrateurs' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_agg(to_jsonb(r) order by r.created_at desc), '[]'::jsonb)
    from (
      select id, created_at, occurred_at, kind, message, stack, build, count, context, journal, device_info
      from error_reports where fingerprint = p_fingerprint order by created_at desc limit 10
    ) r
  );
end $$;

-- Erreur marquée corrigée (ou rouverte) depuis stats.html
create or replace function public.admin_error_resolve(p_fingerprint text, p_resolved boolean)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from analytics_admins where user_id = auth.uid()) then
    raise exception 'Statistiques réservées aux administrateurs' using errcode = '42501';
  end if;
  update error_groups set
    resolved_at = case when p_resolved then now() else null end,
    regressed_at = case when p_resolved then null else regressed_at end
  where fingerprint = p_fingerprint;
end $$;

-- Nettoyage : statistiques de plus de 13 mois, rapports d'erreurs détaillés de plus de 90 jours, erreurs plus
-- vues depuis 13 mois (à planifier avec pg_cron, voir STATISTIQUES.md)
create or replace function public.analytics_purge() returns void
language sql security definer set search_path = public as $$
  delete from analytics_sessions where started_at < now() - interval '400 days';
  delete from analytics_devices d where last_seen < now() - interval '400 days'
    and not exists (select 1 from analytics_sessions s where s.device = d.device);
  delete from error_reports where created_at < now() - interval '90 days';
  delete from error_groups where last_seen < now() - interval '400 days';
$$;

revoke all on function public.track_session(uuid, uuid, int, int, int, boolean, boolean, boolean, text, text) from public;
revoke all on function public.track_run(uuid, uuid, text, text, int, int, int, int, int, text, text, text, boolean) from public;
revoke all on function public.admin_stats(int, text) from public;
revoke all on function public.analytics_purge() from public;
revoke all on function public.report_error(uuid, uuid, uuid, text, text, text, text, text, timestamptz, int, jsonb, jsonb, jsonb) from public;
revoke all on function public.admin_errors(int) from public;
revoke all on function public.admin_error_reports(text) from public;
revoke all on function public.admin_error_resolve(text, boolean) from public;
grant execute on function public.track_session(uuid, uuid, int, int, int, boolean, boolean, boolean, text, text) to anon, authenticated;
grant execute on function public.track_run(uuid, uuid, text, text, int, int, int, int, int, text, text, text, boolean) to anon, authenticated;
grant execute on function public.admin_stats(int, text) to authenticated;
grant execute on function public.report_error(uuid, uuid, uuid, text, text, text, text, text, timestamptz, int, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.admin_errors(int) to authenticated;
grant execute on function public.admin_error_resolve(text, boolean) to authenticated;
grant execute on function public.admin_error_reports(text) to authenticated;
