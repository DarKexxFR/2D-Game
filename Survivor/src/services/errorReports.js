// Envoi des rapports d'erreurs (services/diagnostics.js) vers Supabase : RPC `report_error`, table
// `error_reports` (voir supabase/schema.sql), lus par le propriétaire dans stats.html. Même consentement que
// les statistiques anonymes (Options) et même identifiant d'appareil tiré au hasard : ni pseudo ni compte.
//
// Un rapport qui ne part pas (hors ligne, onglet fermé) reste sur l'appareil et repart à l'ouverture suivante ;
// un rapport refusé par le serveur (limite atteinte, trop gros) n'est pas réessayé.

import { DIAGNOSTICS } from "../config.js";
import { analyticsIdentity } from "./analytics.js";
import { markSent, onReport, unsentReports } from "./diagnostics.js";
import { request } from "./supabase.js";

let ready = false;
/** @type {Set<string>} rapports en cours d'envoi */
const inFlight = new Set();
/** @type {Promise<unknown>} */
let queue = Promise.resolve();

/** Branche l'envoi. Les rapports déjà en attente partent après un court délai (la session d'abord). */
export function initErrorReports() {
  onReport((report) => ready && send(report));
  setTimeout(() => {
    ready = true;
    for (const report of unsentReports()) send(report);
  }, DIAGNOSTICS.sendDelayMs);
}

/** @param {import("./diagnostics.js").ErrorReport} report */
function send(report) {
  const who = analyticsIdentity();
  if (!who || inFlight.has(report.id)) return;
  inFlight.add(report.id);
  const body = JSON.stringify({
    p_id: report.id,
    p_device: who.device,
    p_session: who.session,
    p_kind: report.kind,
    p_fingerprint: report.fingerprint,
    p_message: report.message,
    p_stack: report.stack,
    p_build: report.build,
    p_occurred_at: new Date(report.at).toISOString(),
    p_count: report.count,
    p_context: report.context,
    p_journal: report.journal,
    p_device_info: report.device,
  });
  // L'un après l'autre, sans jamais gêner le jeu
  queue = queue
    .then(() => request("rpc/report_error", { method: "POST", body, keepalive: body.length < 60_000 }))
    .then(
      () => markSent(report),
      (err) => {
        // Refus du serveur (4xx) : inutile de réessayer ; réseau ou serveur en panne : à la prochaine ouverture
        if (/Supabase 4\d\d/.test(String(err?.message))) markSent(report);
      },
    )
    .finally(() => inFlight.delete(report.id));
}
