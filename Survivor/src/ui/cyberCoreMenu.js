// Écran Cœur Cybernétique (ouvert depuis les Talents) : quatre branches de nœuds achetés une fois avec de
// l'or, puis activés (au plus CYBER_CORE.activeSlots) avant une partie. Données dans data/cyberCore.js.

import { CORE_BRANCHES, CORE_NODES, CYBER_CORE } from "../data/cyberCore.js";
import { getStat } from "../services/achievements.js";
import {
  activeNodes,
  buyNode,
  isCoreUnlocked,
  isNodeActive,
  nodeState,
  toggleNode,
} from "../services/cyberCore.js";
import { playSfx } from "../services/sfx.js";
import { account } from "../services/storage.js";
import { $, el, setText } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { showScreen } from "./screens.js";

let onChange = () => {};

export function initCyberCoreMenu({ onBack, onChange: changed }) {
  onChange = changed;
  $("btnCyberCore").addEventListener("click", openCyberCore);
  $("btnCoreBack").addEventListener("click", onBack);
}

export function openCyberCore() {
  renderCore();
  showScreen("cyberCoreMenu");
}

function renderCore() {
  setText("coreGoldDisplay", account.gold);
  const unlocked = isCoreUnlocked();
  const { level, wave } = CYBER_CORE.unlock;
  $("cyberCoreMenu").classList.toggle("core-locked", !unlocked);
  $("coreStatus").textContent = unlocked
    ? `Nœuds actifs : ${activeNodes().length}/${CYBER_CORE.activeSlots} · hors défi du jour`
    : `Verrouillé : niveau de compte ${level} (toi : ${account.level}) ou vague ${wave - 1} battue (record : ${getStat("bestWave")}).`;
  $("coreTree").replaceChildren(...CORE_BRANCHES.map((b) => branchColumn(b, unlocked)));
}

function branchColumn(branch, unlocked) {
  const col = el("section", "core-branch");
  col.style.setProperty("--branch", branch.color);
  const head = el("h3", "core-branch-title");
  head.append(icon(branch.icon, branch.color), el("span", "", branch.name.toUpperCase()));
  col.append(head);
  const nodes = CORE_NODES.filter((n) => n.branch === branch.id).sort((a, b) => a.tier - b.tier);
  for (const n of nodes) col.append(nodeCard(n, unlocked));
  return col;
}

function nodeCard(node, unlocked) {
  const state = nodeState(node.id);
  const active = isNodeActive(node.id) && state === "owned";
  const card = el("div", `core-node ${state}${active ? " active" : ""}`);
  card.dataset.node = node.id;
  card.append(
    el("span", "core-tier", `PALIER ${node.tier}`),
    el("h4", "", node.name),
    el("p", "", node.desc),
  );

  const btn = el("button", "core-btn");
  if (state === "owned") {
    btn.textContent = active ? "ACTIF ✓" : "ACTIVER";
    btn.classList.toggle("secondary", !active);
    btn.disabled = !unlocked || (!active && activeNodes().length >= CYBER_CORE.activeSlots);
    btn.addEventListener("click", () => {
      if (!toggleNode(node.id)) return;
      playSfx("click");
      renderCore();
    });
  } else if (state === "buyable") {
    setLabel(btn, `DÉBLOQUER ${node.cost} `, "coin", { color: "#ffd700" });
    btn.disabled = !unlocked || account.gold < node.cost;
    btn.addEventListener("click", () => {
      if (!buyNode(node.id)) return;
      playSfx("levelUp");
      onChange();
      renderCore();
    });
  } else {
    setLabel(btn, "PALIER PRÉCÉDENT ", "lock");
    btn.disabled = true;
  }
  card.append(btn);
  return card;
}
