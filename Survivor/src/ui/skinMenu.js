// Écran Skins : personnalisation du vaisseau (forme, couleurs du vaisseau, des tirs et de la traînée)
// avec un aperçu animé. Une option payante s'essaie d'abord dans l'aperçu, puis s'achète.

import { HEROES, WEAPONS } from "../data/items.js";
import { RAINBOW, SKIN_COLORS, SKIN_HULLS, SKIN_PARTS, SKIN_TRAILS } from "../data/skins.js";
import { drawShip } from "../render/entities.js";
import { drawSprite, getSprite } from "../render/sprites.js";
import { drawTrail } from "../render/trail.js";
import { getEquipped } from "../services/inventory.js";
import { playSfx } from "../services/sfx.js";
import {
  buySkin,
  currentSkin,
  ownsSkin,
  resolveColor,
  setSkinPart,
  shipLook,
  skinOffer,
} from "../services/skins.js";
import { account } from "../services/storage.js";
import { ageTrail, pushTrailPoint } from "../systems/trail.js";
import { $, el, setText } from "./dom.js";
import { icon, setLabel } from "./icons.js";
import { currentScreen, showScreen } from "./screens.js";

let onChange = () => {};
/** Option payante en cours d'essai : { key, value } (pas encore achetée). */
let trial = null;

export function initSkinMenu({ onBack, onChange: changed }) {
  onChange = changed;
  $("btnSkins").addEventListener("click", openSkins);
  $("btnSkinsBack").addEventListener("click", () => {
    trial = null;
    onBack();
  });
  $("btnSkinBuy").addEventListener("click", buyTrial);
}

export function openSkins() {
  trial = null;
  render();
  showScreen("skinMenu");
  startPreview();
}

/** Réglages montrés dans l'aperçu : ceux du joueur, plus l'option en essai. */
function previewSkin() {
  return trial ? { ...currentSkin(), [trial.key]: trial.value } : currentSkin();
}

function equippedHero() {
  return HEROES[getEquipped("hero")?.id] || HEROES.pilot;
}

function weaponColor() {
  return (WEAPONS[getEquipped("weapon")?.id] || WEAPONS.blaster).color;
}

// --- LISTE DES OPTIONS ---

function render() {
  setText("skinGoldDisplay", account.gold);
  $("skinParts").replaceChildren(...SKIN_PARTS.map(partSection));
  renderBuyBar();
}

function partSection(part) {
  const section = el("section", "skin-part");
  section.dataset.part = part.key;
  const row = el("div", `skin-row skin-row-${part.kind}`);
  if (part.kind === "hull") row.append(...SKIN_HULLS.map((h) => hullChip(h)));
  else if (part.kind === "trail") row.append(...SKIN_TRAILS.map((t) => textChip("trail", t)));
  else row.append(...colorChips(part));
  section.append(el("h4", "", part.title), row);
  return section;
}

/** Bouton d'option commun : sélection, essai d'une option payante, cadenas et prix. */
function chip(key, value, className, label) {
  const btn = el("button", `skin-chip ${className}`);
  btn.dataset.value = value ?? "default";
  btn.setAttribute("aria-label", label);
  btn.title = label;
  const shown = previewSkin()[key];
  if (shown === value) btn.classList.add(trial?.key === key ? "trial" : "on");
  const offer = skinOffer(key, value);
  if (offer && !ownsSkin(key, value)) {
    btn.classList.add("locked");
    const price = el("span", "skin-price");
    setLabel(price, `${offer.price} `, "coin", { color: "#ffd700" });
    btn.append(price);
  }
  btn.addEventListener("click", () => pick(key, value));
  return btn;
}

function hullChip(h) {
  const btn = chip("hull", h.id, "skin-hull", h.name);
  const c = document.createElement("canvas");
  c.width = c.height = 96;
  const g = c.getContext("2d");
  const look = shipLook(equippedHero(), { ...previewSkin(), hull: h.id });
  drawShip(48, 50, 26, -Math.PI / 2, look.color, false, 0, look.hull, g);
  btn.prepend(c, el("small", "", h.name));
  return btn;
}

function textChip(key, option) {
  const btn = chip(key, option.id, "skin-text", option.name);
  btn.prepend(el("small", "", option.name));
  return btn;
}

function colorChips(part) {
  const chips = [];
  const def = chip(part.key, null, "skin-color skin-default", `Par défaut (${part.fallback})`);
  def.prepend(el("small", "", part.fallback));
  chips.push(def);
  for (const color of SKIN_COLORS) {
    const btn = chip(part.key, color, "skin-color", color);
    btn.style.setProperty("--swatch", color);
    chips.push(btn);
  }
  chips.push(chip(part.key, RAINBOW, "skin-color skin-rainbow", "Arc-en-ciel"));
  chips.push(customColor(part));
  return chips;
}

/** Couleur libre : sélecteur du navigateur, appliqué en direct. */
function customColor(part) {
  const value = currentSkin()[part.key];
  const custom = value && value !== RAINBOW && !SKIN_COLORS.includes(value);
  const label = el("label", `skin-chip skin-color skin-custom${custom ? " on" : ""}`);
  label.title = "Couleur personnalisée";
  if (custom) label.style.setProperty("--swatch", value);
  const input = el("input");
  input.type = "color";
  input.value = custom ? value : "#00ffff";
  input.setAttribute("aria-label", `${part.title} : couleur personnalisée`);
  input.addEventListener("input", () => {
    if (!setSkinPart(part.key, input.value.toLowerCase())) return;
    trial = null;
    label.style.setProperty("--swatch", input.value);
    renderBuyBar();
  });
  input.addEventListener("change", () => {
    onChange();
    render();
  });
  label.append(input, icon("palette"));
  return label;
}

function pick(key, value) {
  if (ownsSkin(key, value)) {
    trial = null;
    if (setSkinPart(key, value)) {
      playSfx("pickup");
      onChange();
    }
  } else {
    trial = { key, value }; // à l'essai dans l'aperçu, en attendant l'achat
  }
  render();
}

function renderBuyBar() {
  const bar = $("skinBuyBar");
  const offer = trial && skinOffer(trial.key, trial.value);
  bar.classList.toggle("show", !!offer);
  if (!offer) return;
  const part = SKIN_PARTS.find((p) => p.key === trial.key);
  const scope = offer.unlock === "rainbow" ? "toutes les couleurs" : part.title.toLowerCase();
  setText("skinBuyText", `${offer.name} (${scope}) — à l'essai`);
  const btn = $("btnSkinBuy");
  btn.disabled = account.gold < offer.price;
  setLabel(
    btn,
    btn.disabled ? `IL MANQUE ${offer.price - account.gold} ` : `ACHETER ${offer.price} `,
    "coin",
    {
      color: btn.disabled ? "#888" : "#1a0b00",
    },
  );
}

function buyTrial() {
  if (!trial || !buySkin(trial.key, trial.value)) return;
  trial = null;
  playSfx("levelUp");
  onChange();
  render();
}

// --- APERÇU ANIMÉ ---

let running = false;
const preview = { trail: [], shots: [], lastX: 0, lastY: 0, lastShot: 0, tick: 0 };

function startPreview() {
  if (running) return;
  running = true;
  preview.trail.length = 0;
  preview.shots.length = 0;
  requestAnimationFrame(drawPreview);
}

function drawPreview(now) {
  if (currentScreen() !== "skinMenu") {
    running = false;
    return;
  }
  const canvas = $("skinPreview");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const c = canvas.getContext("2d");
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, w, h);

  // Le vaisseau décrit un huit et tire droit devant lui
  const t = now / 1000;
  const x = w / 2 + Math.sin(t * 0.9) * w * 0.3;
  const y = h / 2 + Math.sin(t * 1.8) * h * 0.22;
  const dx = x - preview.lastX;
  const dy = y - preview.lastY;
  preview.lastX = x;
  preview.lastY = y;
  const angle = Math.atan2(dy, dx);
  const size = Math.max(14, Math.min(22, h / 9));

  const skin = previewSkin();
  const look = shipLook(equippedHero(), skin, now);
  ageTrail(preview.trail);
  if (++preview.tick % 2 === 0 && Math.hypot(dx, dy) > 0.3) {
    pushTrailPoint(preview.trail, x, y, dx, dy, size, look);
  }
  drawTrail(c, preview.trail);

  if (now - preview.lastShot > 260) {
    preview.lastShot = now;
    preview.shots.push({
      x,
      y,
      vx: Math.cos(angle) * 7,
      vy: Math.sin(angle) * 7,
      color: shotColor(skin, now),
    });
  }
  drawShots(c, w, h);
  drawShip(x, y, size, angle, look.color, true, now, look.hull, c);
  requestAnimationFrame(drawPreview);
}

function shotColor(skin, now) {
  return resolveColor(skin.shot, weaponColor(), now);
}

function drawShots(c, w, h) {
  c.lineCap = "round";
  let n = 0;
  for (const s of preview.shots) {
    s.x += s.vx;
    s.y += s.vy;
    if (s.x < -20 || s.y < -20 || s.x > w + 20 || s.y > h + 20) continue;
    preview.shots[n++] = s;
    c.strokeStyle = s.color;
    c.globalAlpha = 0.35;
    c.lineWidth = 6;
    c.beginPath();
    c.moveTo(s.x - s.vx * 1.8, s.y - s.vy * 1.8);
    c.lineTo(s.x, s.y);
    c.stroke();
    c.globalAlpha = 1;
    drawSprite(c, getSprite("bullet", 5, s.color), s.x, s.y);
  }
  preview.shots.length = n;
}
