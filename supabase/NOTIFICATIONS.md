# Notifications (Web Push) : mise en place

Le jeu est une application installable (PWA) : icône sur l'écran d'accueil, plein écran, jouable hors
connexion. **Aucune boutique d'applications** : tout passe par le navigateur, gratuitement. Les
notifications utilisent le Web Push standard (Chrome, Edge, Firefox, Android, et iPhone / iPad depuis
iOS 16.4 une fois le jeu installé sur l'écran d'accueil).

Tant que la clé publique n'est pas dans `config.js`, les notifications restent invisibles dans le jeu.
L'installation, elle, marche déjà sans rien configurer.

## Comment ça marche

```
Jeu (navigateur)                         Supabase
────────────────                         ────────
calcule ses rappels à l'heure locale ──► push_subscribe : abonnement + rappels (table push_reminders)
(série le lendemain 19 h, quêtes le                │
lundi 10 h, retour après 3 et 10 jours)            ▼
                                         pg_cron, toutes les 5 min ──► fonction Edge « send-push »
demande d'ami / acceptée ──────────────► déclencheur SQL                 │ push_claim : lot de 500 rappels
                                                                         │ envoi chiffré (clés VAPID)
service worker (sw.js) ◄── notification ◄── service du navigateur ◄──────┘ push_report : bilan
```

- Le **jeu** décide quand prévenir et envoie la liste à chaque changement (une visite repousse les
  rappels de retour : ils ne partent qu'après une vraie absence). Le **serveur** ne fait qu'expédier.
- Les **textes** sont dans `supabase/functions/send-push/index.ts` : modifiables sans mettre le jeu à jour.
- Plafond : 2 notifications par appareil et par jour (hors réponses d'amis). Les rappels en retard de
  plus d'un jour sont abandonnés, les abonnements expirés supprimés automatiquement.

## Mise en place (une seule fois)

### 1. Base de données

SQL Editor → coller tout `supabase/schema.sql` → **Run** (comme d'habitude, il peut être relancé sans risque).

### 2. Clés VAPID

Sur ton ordinateur, dans le dossier du dépôt :

```bash
node scripts/vapid-keys.mjs
```

(ou `npx web-push generate-vapid-keys`). Tu obtiens une clé **publique** et une clé **privée**.

- La clé publique va dans `Survivor/src/config.js`, `PUSH.vapidPublicKey` (tu peux me l'envoyer, elle
  est faite pour être publique : je l'ajoute).
- La clé privée ne va **jamais** dans le dépôt ni dans un message : uniquement à l'étape 3.

### 3. Secrets de la fonction

Supabase → **Edge Functions** → **Secrets** → ajouter :

| Nom                 | Valeur                                                            |
| ------------------- | ----------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`  | la clé publique                                                   |
| `VAPID_PRIVATE_KEY` | la clé privée                                                     |
| `VAPID_SUBJECT`     | `mailto:ton-adresse` (contact donné aux services de notification) |
| `PUSH_CRON_SECRET`  | une longue phrase au hasard (protège l'appel de la fonction)      |

### 4. Déployer la fonction

Au choix :

- **Depuis le site** : Edge Functions → **Deploy a new function** → **Via Editor** → nom `send-push`,
  coller le contenu de `supabase/functions/send-push/index.ts` → **Deploy**. Puis dans les réglages de la
  fonction, **désactiver « Verify JWT »** (l'appel est protégé par `PUSH_CRON_SECRET`).
- **En ligne de commande** :
  ```bash
  npx supabase login
  npx supabase functions deploy send-push --project-ref eibzkrgobawkgjwheyfl --no-verify-jwt
  ```

### 5. Planifier l'envoi toutes les 5 minutes

Database → **Extensions** : activer `pg_cron` et `pg_net`. Puis dans le SQL Editor (remplacer
`TON_SECRET` par la valeur de `PUSH_CRON_SECRET`) :

```sql
select vault.create_secret('TON_SECRET', 'push_cron_secret');

select cron.schedule('envoi-notifications', '*/5 * * * *', $$
  select net.http_post(
    url := 'https://eibzkrgobawkgjwheyfl.supabase.co/functions/v1/send-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 55000
  );
$$);
```

### 6. Vérifier

1. Ouvrir le jeu, Options → **Notifications** → ACTIVÉES (accepter la demande du navigateur).
2. Table Editor → `push_subscriptions` : une ligne apparaît, et ses rappels dans `push_reminders`.
3. Pour recevoir un rappel tout de suite :
   ```sql
   update push_reminders set send_at = now() where kind = 'quests';
   ```
   La notification arrive au passage suivant (5 minutes au plus). Edge Functions → `send-push` → **Logs**
   montre chaque passage (`{"sent":1,"gone":0,"retry":0,...}`).

## Montée en charge

- Chaque passage prend les rappels par lots de 500 et envoie 50 notifications à la fois, pendant 40 s
  au plus ; le reste part au passage suivant. Plusieurs passages en même temps ne prennent jamais le
  même rappel (`for update skip locked`). Mesuré : 50 000 rappels réservés en 2 s par 4 envois parallèles.
- Un rappel pris mais jamais rendu (envoi interrompu) est repris au bout de 10 minutes.
- Coût : un passage toutes les 5 minutes = environ 8 600 appels de fonction par mois, très loin de la
  limite gratuite de Supabase. Les notifications elles-mêmes sont gratuites (services des navigateurs).

## Ajouter un nouveau type de rappel

1. `PUSH.topics` dans `config.js` (thème réglable) et `buildReminders` dans `services/notifications.js` ;
2. le type dans la contrainte `kind` de `push_reminders` et la liste de `push_subscribe` (`schema.sql`) ;
3. son texte dans `messageFor` (`supabase/functions/send-push/index.ts`), puis redéployer la fonction.
