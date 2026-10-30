// Envoi des notifications de Last Pulse (fonction Edge Supabase, Deno).
//
// Appelée toutes les 5 minutes par pg_cron (voir supabase/NOTIFICATIONS.md) :
//  1. push_claim  : prend un lot de rappels arrivés à échéance (jamais le même rappel deux fois,
//                   même si plusieurs envois tournent en même temps) ;
//  2. envoi       : chaque notification est chiffrée et signée (Web Push, clés VAPID), en parallèle ;
//  3. push_report : rappels envoyés retirés, abonnements expirés supprimés, échecs réessayés.
// On recommence tant qu'il reste des rappels et qu'il reste du temps : un lot de 500 part en
// quelques secondes, de quoi suivre des dizaines de milliers de joueurs sans rien changer.
//
// Les textes sont écrits ICI (pas dans le jeu) : on peut les changer sans mettre le jeu à jour.
// Secrets attendus (Edge Functions → Secrets) : VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, PUSH_CRON_SECRET,
// et facultatif VAPID_SUBJECT. SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont fournis par Supabase.

import webpush from "npm:web-push@3.6.7";

export const BATCH = 500; // rappels pris à la fois
export const CONCURRENCY = 50; // envois simultanés
export const TIME_BUDGET_MS = 40_000; // au-delà, la suite part au prochain passage

export type Reminder = {
  subscription_id: string;
  kind: string;
  data: Record<string, unknown>;
  endpoint: string;
  p256dh: string;
  auth: string;
};
export type Message = { title: string; body: string; tag: string; url: string; ttl: number };
export type Status = "sent" | "gone" | "retry";

const HOUR = 3600;
const num = (v: unknown, fallback: number) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const name = (v: unknown) => String(v ?? "Un pilote").slice(0, 12);
const text = (v: unknown, max: number) => String(v ?? "").slice(0, max);

/** Texte de chaque type de rappel (null = type inconnu, le rappel est simplement retiré). */
export function messageFor(kind: string, data: Record<string, unknown> = {}): Message | null {
  switch (kind) {
    case "streak":
      return {
        title: "🔥 Ne perds pas ta série !",
        body: `Jour ${num(data.day, 2)} : connecte-toi avant minuit pour récupérer ${num(data.gold, 100)} or.`,
        tag: "streak",
        url: "./",
        ttl: 5 * HOUR,
      };
    case "quests":
      return {
        title: "📜 Nouvelles quêtes de la semaine",
        body: "Trois nouvelles quêtes et leur or t'attendent.",
        tag: "quests",
        url: "./#modal=quetes",
        ttl: 24 * HOUR,
      };
    case "friends":
      return data.event === "accepted"
        ? {
            title: `🤝 ${name(data.name)} a accepté ta demande d'ami`,
            body: "Défiez-vous en duel classé !",
            tag: "friends",
            url: "./#modal=amis",
            ttl: 12 * HOUR,
          }
        : {
            title: `👋 ${name(data.name)} veut devenir ton ami`,
            body: "Accepte sa demande pour pouvoir vous défier en duel.",
            tag: "friends",
            url: "./#modal=amis",
            ttl: 12 * HOUR,
          };
    case "comeback1":
      return {
        title: "⚡ La nuée revient…",
        body: `Ton vaisseau t'attend. Ton record : vague ${num(data.best, 1)}. Tu peux faire mieux !`,
        tag: "comeback",
        url: "./",
        ttl: 24 * HOUR,
      };
    case "comeback2":
      return {
        title: "Tu nous manques, pilote",
        body: "Nouvelles quêtes, défi du jour et bonus de connexion t'attendent.",
        tag: "comeback",
        url: "./",
        ttl: 24 * HOUR,
      };
    case "announce": {
      // Écrite par le propriétaire (push_announce dans schema.sql) : titre et texte libres
      const title = text(data.title, 60);
      const body = text(data.body, 200);
      if (!title || !body) return null;
      const url = typeof data.url === "string" && data.url.startsWith("./") ? data.url : "./";
      return { title, body, tag: "announce", url, ttl: 24 * HOUR };
    }
    default:
      return null;
  }
}

/** Réponse du service de notification → suite à donner. */
export function statusFor(error: unknown): Status {
  const code = Number((error as { statusCode?: number })?.statusCode);
  // 404 / 410 : abonnement expiré ou révoqué ; 400 / 401 / 403 : abonnement invalide ou créé avec
  // d'autres clés VAPID. Dans tous ces cas, réessayer ne servirait à rien.
  if ([400, 401, 403, 404, 410].includes(code)) return "gone";
  return "retry"; // 429, 5xx, réseau : nouvel essai plus tard
}

export type Deps = {
  claim: (limit: number) => Promise<Reminder[]>;
  report: (results: { id: string; kind: string; status: Status }[]) => Promise<void>;
  send: (reminder: Reminder, message: Message) => Promise<void>;
  now?: () => number;
};

/** Boucle d'envoi (sans dépendance : testée seule). */
export async function run(deps: Deps) {
  const now = deps.now ?? Date.now;
  const start = now();
  const totals = { sent: 0, gone: 0, retry: 0, batches: 0 };
  while (now() - start < TIME_BUDGET_MS) {
    const batch = await deps.claim(BATCH);
    if (!batch.length) break;
    totals.batches++;
    const results: { id: string; kind: string; status: Status }[] = [];
    let next = 0;
    const worker = async () => {
      while (next < batch.length) {
        const r = batch[next++];
        const message = messageFor(r.kind, r.data);
        let status: Status = "sent";
        if (message) {
          try {
            await deps.send(r, message);
          } catch (err) {
            status = statusFor(err);
          }
        }
        results.push({ id: r.subscription_id, kind: r.kind, status });
        totals[status]++;
      }
    };
    await Promise.all(Array.from({ length: Math.min(CONCURRENCY, batch.length) }, worker));
    await deps.report(results);
    if (batch.length < BATCH) break;
  }
  return totals;
}

/** Comparaison en temps constant (le secret ne se devine pas au chronomètre). */
export function sameSecret(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// --- Branchement Supabase (seulement quand Deno exécute ce fichier) ---

declare const Deno: {
  env: { get(key: string): string | undefined };
  serve(handler: (req: Request) => Response | Promise<Response>): unknown;
};

if (import.meta.main) {
  const env = (key: string) => Deno.env.get(key) ?? "";
  const url = env("SUPABASE_URL").replace(/\/$/, "");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const headers: Record<string, string> = { apikey: key, "Content-Type": "application/json" };
  if (key.startsWith("eyJ")) headers.Authorization = `Bearer ${key}`;

  const rpc = async (fn: string, args: object) => {
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers,
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`${fn} : ${res.status} ${await res.text()}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  };

  webpush.setVapidDetails(
    env("VAPID_SUBJECT") || "https://last-pulse.com",
    env("VAPID_PUBLIC_KEY"),
    env("VAPID_PRIVATE_KEY"),
  );

  Deno.serve(async (req) => {
    if (!sameSecret(req.headers.get("x-cron-secret") ?? "", env("PUSH_CRON_SECRET"))) {
      return new Response("Accès refusé", { status: 401 });
    }
    try {
      const totals = await run({
        claim: (limit) => rpc("push_claim", { p_limit: limit }),
        report: (results) => rpc("push_report", { p_results: results }),
        send: (r, m) =>
          webpush.sendNotification(
            { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
            JSON.stringify({ title: m.title, body: m.body, tag: m.tag, url: m.url }),
            { TTL: m.ttl, urgency: "normal", topic: m.tag },
          ),
      });
      return Response.json(totals);
    } catch (err) {
      console.error(err);
      return new Response(String(err), { status: 500 });
    }
  });
}
