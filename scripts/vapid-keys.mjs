// Génère une paire de clés VAPID pour les notifications (voir supabase/NOTIFICATIONS.md).
// Usage : node scripts/vapid-keys.mjs
//  - la clé PUBLIQUE va dans Survivor/src/config.js (PUSH.vapidPublicKey) : elle est faite pour être publique ;
//  - la clé PRIVÉE va UNIQUEMENT dans les secrets Supabase (VAPID_PRIVATE_KEY). Ne jamais la committer
//    ni la coller dans un message.
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pub = publicKey.export({ format: "jwk" });
const priv = privateKey.export({ format: "jwk" });
// Clé publique au format attendu par les navigateurs : point non compressé (0x04 + x + y), base64 « URL »
const raw = Buffer.concat([
  Buffer.from([4]),
  Buffer.from(pub.x, "base64url"),
  Buffer.from(pub.y, "base64url"),
]);

console.log("Clé publique  (config.js + secret VAPID_PUBLIC_KEY) :");
console.log(raw.toString("base64url"));
console.log("\nClé privée    (secret VAPID_PRIVATE_KEY uniquement) :");
console.log(priv.d);
