// Client minimal de Supabase Realtime (diffusion « broadcast » seulement, sans bibliothèque) :
// une WebSocket, un canal par salle de duel. Protocole Phoenix, messages JSON
// { topic, event, payload, ref, join_ref }.

import { NET, ONLINE } from "../config.js";

function socketUrl() {
  const base = ONLINE.supabaseUrl.replace(/\/$/, "").replace(/^http/, "ws");
  return `${base}/realtime/v1/websocket?apikey=${encodeURIComponent(ONLINE.supabaseAnonKey)}&vsn=1.0.0`;
}

/**
 * Rejoint le canal `name`. `onMessage(event, payload)` reçoit les diffusions des autres clients.
 * Renvoie une promesse { send(event, payload), close() } résolue une fois le canal rejoint.
 */
export function joinChannel(name, onMessage, onClose = () => {}) {
  return new Promise((resolve, reject) => {
    const topic = `realtime:${name}`;
    const ws = new WebSocket(socketUrl());
    let ref = 0;
    const joinRef = "1";
    let joined = false;
    let heartbeat = null;
    const push = (msg) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ ...msg, ref: String(++ref) }));
    };
    const channel = {
      send(event, payload) {
        push({
          topic,
          event: "broadcast",
          payload: { type: "broadcast", event, payload },
          join_ref: joinRef,
        });
      },
      close() {
        clearInterval(heartbeat);
        ws.onclose = null;
        push({ topic, event: "phx_leave", payload: {}, join_ref: joinRef });
        ws.close();
      },
    };
    const timer = setTimeout(() => {
      if (!joined) {
        ws.close();
        reject(new Error("timeout"));
      }
    }, NET.joinTimeoutMs);

    ws.onopen = () => {
      push({
        topic,
        event: "phx_join",
        payload: {
          config: { broadcast: { self: false, ack: false }, presence: { key: "" }, private: false },
        },
        join_ref: joinRef,
      });
      heartbeat = setInterval(
        () => push({ topic: "phoenix", event: "heartbeat", payload: {} }),
        NET.heartbeatMs,
      );
    };
    ws.onmessage = (e) => {
      let msg;
      try {
        msg = JSON.parse(e.data);
      } catch {
        return;
      }
      if (msg.topic !== topic) return;
      if (msg.event === "phx_reply" && !joined) {
        if (msg.payload?.status !== "ok") {
          clearTimeout(timer);
          ws.close();
          reject(new Error("refused"));
          return;
        }
        joined = true;
        clearTimeout(timer);
        resolve(channel);
      } else if (msg.event === "broadcast") {
        onMessage(msg.payload?.event, msg.payload?.payload);
      }
    };
    ws.onerror = () => {
      if (!joined) {
        clearTimeout(timer);
        reject(new Error("network"));
      }
    };
    ws.onclose = () => {
      clearInterval(heartbeat);
      if (joined) onClose();
    };
  });
}
