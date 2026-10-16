// Amis : ajout par pseudo ou code ami, demande à accepter, présence, puis défi en direct qui lance
// le duel en ligne classé ELO. Supabase (RPC et Realtime) est simulé (voir fixtures.js).
import { expect, fakeRealtime, logIn, routeSupabase, test } from "./fixtures.js";

test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });

/** Ouvre le jeu connecté au compte `email` avec le pseudo `pseudo`, puis l'écran Amis (bouton de l'accueil). */
async function openFriends(page, realtime, email, pseudo) {
  await realtime(page);
  if (email) await logIn(page, email);
  await page.goto("/");
  await page.evaluate(async () => {
    const { NET } = await import("/src/config.js");
    NET.iceServers = []; // pas de STUN : les deux pages sont sur la même machine
  });
  await page.locator("#playerPseudo").fill(pseudo);
  await page.locator("#playerPseudo").dispatchEvent("change");
  await page.locator("#btnFriends").click();
  await expect(page.locator("#friendsMenu")).toBeVisible();
}

/** Deuxième joueur, dans son propre navigateur, avec le même faux Supabase. */
async function secondPlayer(browser, supabase) {
  const other = await (await browser.newContext()).newPage();
  const errors = [];
  other.on("pageerror", (e) => errors.push(e.message));
  await routeSupabase(other, supabase);
  return { other, errors };
}

const row = (page, section, name) => page.locator(`#${section} .friend-row`, { hasText: name });

/** Hôte et invité deviennent amis (demande par pseudo, acceptée par l'autre). */
async function makeFriends(page, browser, supabase, realtime) {
  const { other, errors } = await secondPlayer(browser, supabase);
  await openFriends(other, realtime, "invite@test.fr", "Invite");
  await openFriends(page, realtime, "hote@test.fr", "Hote");

  await page.locator("#friendQuery").fill("invite"); // pseudo, sans tenir compte des majuscules
  await page.locator("#btnFriendAdd").click();
  await expect(page.locator("#friendsStatus")).toHaveText("Demande envoyée à Invite.");
  await expect(row(page, "friendsOutgoing", "Invite")).toBeVisible();

  // L'autre joueur est prévenu en direct : pastille, puis demande à accepter
  await expect(other.locator("#friendsBadge")).toHaveText("1");
  await expect(other.locator("#duelFriendsBadge")).toHaveText("1");
  await row(other, "friendsIncoming", "Hote").getByText("ACCEPTER").click();
  await expect(row(other, "friendsList", "Hote")).toContainText("En ligne");
  await expect(row(page, "friendsList", "Invite")).toContainText("En ligne");
  await expect(page.locator("#friendsOutgoing .friend-row")).toHaveCount(0);
  await expect(page.locator("#friendsOnline")).toHaveText("1"); // amis en ligne, sur le bouton AMIS
  await expect(other.locator("#friendsBadge")).toHaveText("");
  return { other, errors };
}

test("amis : bouton de l'accueil, retour à l'écran d'origine", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#btnFriends")).toBeVisible();
  await page.locator("#btnFriends").click();
  await expect(page.locator("#friendsMenu")).toBeVisible();
  await expect(page).toHaveURL(/#modal=amis$/);
  await page.locator("#btnFriendsBack").click();
  await expect(page.locator("#mainMenu")).toBeVisible();

  // Ouvert depuis l'écran Duel, le retour y ramène
  await page.locator("#btnVersus").click();
  await page.locator("#btnDuelFriends").click();
  await expect(page.locator("#friendsMenu")).toBeVisible();
  await page.locator("#btnFriendsBack").click();
  await expect(page.locator("#duelMenu")).toBeVisible();
});

test("amis : il faut être connecté", async ({ page, isMobile }) => {
  test.skip(isMobile, "même écran sur mobile");
  await openFriends(page, fakeRealtime(), null, "Seul");
  await expect(page.locator("#friendsLogin")).toBeVisible();
  await expect(page.locator("#friendsBody")).toBeHidden();
  await page.locator("#btnFriendsLogin").click();
  await expect(page.locator("#loginMenu")).toBeVisible();
});

test("amis : ajout, défi accepté, duel classé ELO", async ({ page, browser, isMobile, supabase }) => {
  test.skip(isMobile, "deux navigateurs");
  test.setTimeout(60_000);
  const realtime = fakeRealtime();
  const { other, errors } = await makeFriends(page, browser, supabase, realtime);

  // Code ami affiché, erreurs d'ajout lisibles
  await expect(page.locator("#friendCode")).toHaveText("HOTE@T");
  for (const [query, message] of [
    ["Personne", "Aucun joueur avec ce pseudo ou ce code ami."],
    ["hote@t", "C'est toi !"], // son propre code ami
    ["INVITE", "Déjà ami, ou demande déjà envoyée."],
  ]) {
    await page.locator("#friendQuery").fill(query);
    await page.locator("#btnFriendAdd").click();
    await expect(page.locator("#friendsStatus")).toHaveText(message);
  }

  // Défi : l'ami le reçoit en direct, l'accepte, le duel en ligne démarre chez les deux
  await row(page, "friendsList", "Invite").getByText("DÉFIER").click();
  await expect(page.locator("#friendsStatus")).toContainText("Défi envoyé à Invite");
  await expect(other.locator("#friendInvite")).toBeVisible();
  await expect(other.locator("#friendInviteName")).toHaveText("Hote");
  await other.locator("#btnInviteAccept").click();
  for (const [p, rival] of [
    [page, "Invite"],
    [other, "Hote"],
  ]) {
    await expect(p.locator("#duelRival")).toBeVisible({ timeout: 15_000 });
    await expect(p.locator("#rivalName")).toHaveText(rival);
  }
  await expect(other.locator("#friendInvite")).toBeHidden();

  // Duel classé : l'invité meurt, l'ELO bouge chez les deux
  await other.evaluate(async () => {
    const state = await import("/src/core/state.js");
    const player = await import("/src/systems/player.js");
    state.player.revives = 0;
    player.takeDamage(1e12);
  });
  await expect(page.locator("#versusElo")).toHaveText("ELO : 1016 (+16)");
  await expect(other.locator("#versusElo")).toHaveText("ELO : 984 (-16)");

  // La cote apparaît dans la liste d'amis
  await page.locator("#btnVersusMenu").click();
  await page.locator("#btnVersus").click();
  await page.locator("#btnDuelFriends").click();
  await expect(row(page, "friendsList", "Invite")).toContainText("984 ELO");
  expect(errors).toEqual([]);
});

test("amis : défi refusé, ami retiré", async ({ page, browser, isMobile, supabase }) => {
  test.skip(isMobile, "deux navigateurs");
  test.setTimeout(60_000);
  const realtime = fakeRealtime();
  const { other, errors } = await makeFriends(page, browser, supabase, realtime);

  await row(page, "friendsList", "Invite").getByText("DÉFIER").click();
  await expect(other.locator("#friendInvite")).toBeVisible();
  await other.locator("#btnInviteDecline").click();
  await expect(page.locator("#friendsStatus")).toHaveText("Invite a refusé le défi.");
  await expect(row(page, "friendsList", "Invite").getByText("DÉFIER")).toBeEnabled();

  // Défi annulé par celui qui l'a lancé : la fenêtre disparaît chez l'ami
  await row(page, "friendsList", "Invite").getByText("DÉFIER").click();
  await expect(other.locator("#friendInvite")).toBeVisible();
  await row(page, "friendsList", "Invite").getByText("ANNULER").click();
  await expect(other.locator("#friendInvite")).toBeHidden();

  // Retirer demande deux clics ; l'autre joueur voit sa liste se vider
  const remove = row(page, "friendsList", "Invite").locator(".friend-remove");
  await remove.click();
  await expect(remove).toHaveText("RETIRER ?");
  await remove.click();
  await expect(page.locator("#friendsStatus")).toHaveText("Invite ne fait plus partie de tes amis.");
  await expect(page.locator("#friendsList")).toContainText("Aucun ami pour l'instant.");
  await expect(other.locator("#friendsList")).toContainText("Aucun ami pour l'instant.");
  expect(errors).toEqual([]);
});
