import { Application, Graphics, Container, Text, TextStyle } from "pixi.js";
import { MsgType, WSMessage, PlayerInput } from "../shared/types/network";
import { Stat } from "../shared/core/Stats";

// URL de l'API et du WebSocket (Local)
const API_URL = "http://localhost:3000";
const WS_URL = "ws://localhost:3000";

// ÉTAT GLOBAL DU CLIENT
let token = "";
let currentUser: any = null;
let currentCharacter: any = null;
let characterList: any[] = [];
let onlinePlayers: any[] = [];
let partyState: any = null;
let ws: WebSocket | null = null;

// ÉTAT DU JEU EN RUN
let pixiApp: Application | null = null;
let gameContainer: Container | null = null;
let gameplayContainer: Container | null = null;
let mapBgContainer: Container | null = null;
let fogMask: Graphics | null = null;
let gameMap: any = null;
const doorsEntities = new Map<string, Graphics>();
let activeRoomId = "room_start";
let keysCollected = 0;
let isVictory = false;

// Variables pour le Netcode
let clientSequenceNumber = 0;
const inputBuffer: any[] = [];
let localPlayerEntity: any = { x: 1800, y: 1800, vx: 0, vy: 0, radius: 16 };
let localPlayerSpeed = 220;
let localPlayerDashing = false;
let localPlayerDashDuration = 0;
let localPlayerDashCooldown = 0;
let localPlayerDashDirectionX = 0;
let localPlayerDashDirectionY = 0;
const playersEntities = new Map<string, { graphics: Graphics; label: Text; serverX: number; serverY: number; x: number; y: number }>();
const enemiesEntities = new Map<string, { graphics: Graphics; hpBar: Graphics; serverX: number; serverY: number; x: number; y: number }>();

// Inputs du clavier
const keys = { up: false, down: false, left: false, right: false, dash: false, ult1: false, ult2: false };
let mouseAngle = 0;
let lastMouseClientX = window.innerWidth / 2;
let lastMouseClientY = window.innerHeight / 2;


// Object Pool pour les projectiles locaux
const projectilesPool: any[] = [];
const activeProjectiles: any[] = [];

// ==========================================
// 1. UTILITAIRES D'INTERFACES ET DE VUES
// ==========================================
function showView(viewId: string) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.getElementById(viewId)?.classList.add("active");

  // Arrêter PixiJS si on quitte le jeu
  if (viewId !== "game-page" && pixiApp) {
    pixiApp.destroy(true, { children: true, texture: true });
    pixiApp = null;
    gameContainer = null;
  }
}

// Helper d'appels API HTTP
async function apiPost(route: string, body: any) {
  const res = await fetch(`${API_URL}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return res.json();
}

// ==========================================
// 2. LOGIQUE D'AUTHENTIFICATION ET PERSOS
// ==========================================
async function loginGuest() {
  const pseudoInput = (document.getElementById("guest-pseudo") as HTMLInputElement).value.trim();
  const pseudo = pseudoInput || "Aventurier";
  
  const res = await apiPost("/api/auth/guest", { pseudo });
  if (res.token) {
    token = res.token;
    currentUser = res.user;
    connectWebSocket();
  }
}

async function loginSocial(provider: string) {
  // Simulation OAuth
  const pseudo = provider === "Discord" ? "DiscordPlayer" : "GooglePlayer";
  const email = `${pseudo.toLowerCase()}@social.com`;
  
  const res = await apiPost("/api/auth/login-provider", { pseudo, email, provider });
  if (res.token) {
    token = res.token;
    currentUser = res.user;
    connectWebSocket();
  }
}

async function loadCharacters() {
  const res = await fetch(`${API_URL}/api/characters?userId=${currentUser.id}`); // simulation ou direct
  // Dans le MVP, les personnages sont renvoyés directement par la validation de connexion WS.
}

function renderCharacterList() {
  const listDiv = document.getElementById("char-list")!;
  listDiv.innerHTML = "";

  characterList.forEach(c => {
    const card = document.createElement("div");
    card.className = "char-card";
    card.innerHTML = `
      <div class="avatar ${c.classShape}"></div>
      <h4>${c.name}</h4>
      <p>Niveau ${c.level} (${c.classShape})</p>
    `;
    card.onclick = () => {
      document.querySelectorAll(".char-card").forEach(div => div.classList.remove("selected"));
      card.classList.add("selected");
      currentCharacter = c;
      selectCharacter();
    };
    listDiv.appendChild(card);
  });

  // Bouton de création
  const newCard = document.createElement("div");
  newCard.className = "char-card create-new";
  newCard.innerHTML = `
    <div style="font-size: 2.5rem;">+</div>
    <h4>Créer un Héros</h4>
  `;
  newCard.onclick = () => {
    document.getElementById("char-creator")?.classList.remove("hidden");
  };
  listDiv.appendChild(newCard);

  document.getElementById("char-count")!.innerText = `(${characterList.length}/5)`;
}

async function createCharacter() {
  const name = (document.getElementById("new-char-name") as HTMLInputElement).value.trim();
  const activeOpt = document.querySelector(".class-opt.active") as HTMLElement;
  const classShape = activeOpt ? activeOpt.dataset.shape : "CIRCLE";

  if (!name) return alert("Saisissez un pseudo pour votre héros !");

  const res = await apiPost("/api/characters", {
    userId: currentUser.id,
    name,
    classShape
  });

  if (res.id) {
    // Ajouter à la liste locale
    characterList.push(res);
    renderCharacterList();
    document.getElementById("char-creator")?.classList.add("hidden");
    // Sélectionner automatiquement
    currentCharacter = res;
    selectCharacter();
  }
}

function selectCharacter() {
  ws?.send(JSON.stringify({
    type: MsgType.C2S_SELECT_CHARACTER,
    payload: { characterId: currentCharacter.id }
  }));
  showView("hub-page");
  renderHubInventory();
}

// ==========================================
// 3. CONNEXION WEBSOCKET & HUB CENTRAL
// ==========================================
function connectWebSocket() {
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    // Envoi du jeton d'authentification
    ws?.send(JSON.stringify({
      type: MsgType.C2S_CONNECT,
      payload: { token }
    }));
  };

  ws.onmessage = (e) => {
    const msg: WSMessage = JSON.parse(e.data);
    handleWSMessage(msg);
  };

  ws.onclose = () => {
    console.warn("WebSocket déconnecté.");
  };
}

function handleWSMessage(msg: WSMessage) {
  switch (msg.type) {
    case MsgType.S2C_CONNECT_OK: {
      currentUser = msg.payload.user;
      characterList = msg.payload.characters;
      showView("character-page");
      renderCharacterList();
      break;
    }

    case MsgType.S2C_CHARACTER_UPDATE: {
      currentCharacter = msg.payload.character;
      renderHubInventory();
      renderTalentTree();
      break;
    }

    case MsgType.S2C_HUB_STATE: {
      onlinePlayers = msg.payload;
      renderOnlinePlayers();
      break;
    }

    case MsgType.S2C_CHAT: {
      addChatMessage(msg.payload.sender, msg.payload.channel, msg.payload.text);
      break;
    }

    case MsgType.C2S_PARTY_INVITE: {
      const modal = document.getElementById("party-invite-modal")!;
      document.getElementById("party-invite-text")!.innerText = `Invitation de groupe reçue de ${msg.payload.fromPseudo}`;
      modal.classList.remove("hidden");
      
      document.getElementById("btn-accept-invite")!.onclick = () => {
        ws?.send(JSON.stringify({ type: MsgType.C2S_PARTY_ACCEPT, payload: { hostPseudo: msg.payload.fromPseudo } }));
        modal.classList.add("hidden");
      };
      document.getElementById("btn-decline-invite")!.onclick = () => {
        modal.classList.add("hidden");
      };
      break;
    }

    case MsgType.S2C_PARTY_UPDATE: {
      partyState = msg.payload;
      renderPartyStatus();
      break;
    }

    // MESSAGES DE GAMEPLAY EN RUN
    case MsgType.S2C_RUN_START: {
      activeRoomId = msg.payload.activeRoomId;
      showView("game-page");
      initPixiGame(msg.payload);
      break;
    }

    case MsgType.S2C_SNAPSHOT: {
      handleServerSnapshot(msg.payload);
      break;
    }

    case MsgType.S2C_ROOM_CHANGED: {
      activeRoomId = msg.payload.activeRoomId;
      document.getElementById("hud-room-name")!.innerText = msg.payload.roomName;
      // Nettoyer projectiles et ennemis locaux
      enemiesEntities.forEach(e => e.graphics.destroy());
      enemiesEntities.clear();
      activeProjectiles.forEach(p => p.sprite.destroy());
      activeProjectiles.length = 0;
      break;
    }

    case MsgType.S2C_SPAWN_PATTERN: {
      spawnProjectilesLocally(msg.payload);
      break;
    }

    case MsgType.S2C_RUN_RECAP: {
      showView("recap-page");
      renderRunRecap(msg.payload);
      break;
    }
  }
}

// ==========================================
// 4. LES ONGLETS DU HUB
// ==========================================
function renderOnlinePlayers() {
  const container = document.getElementById("online-players-list")!;
  container.innerHTML = "";
  onlinePlayers.forEach(p => {
    if (p.userId === currentUser.id) return;
    const div = document.createElement("div");
    div.className = "online-user";
    div.innerHTML = `
      <span>${p.pseudo}</span>
      <button class="btn secondary sm invite-btn" data-pseudo="${p.pseudo}">Inviter</button>
    `;
    div.querySelector(".invite-btn")?.addEventListener("click", () => {
      ws?.send(JSON.stringify({ type: MsgType.C2S_PARTY_INVITE, payload: { targetPseudo: p.pseudo } }));
    });
    container.appendChild(div);
  });
}

function renderPartyStatus() {
  const box = document.getElementById("party-status-box")!;
  if (!partyState) {
    box.innerHTML = "<p>Vous n'êtes pas dans un groupe.</p>";
    return;
  }
  let listHtml = `<h5>Membres du groupe :</h5><ul>`;
  partyState.members.forEach((m: any) => {
    listHtml += `<li>${m.pseudo} ${m.userId === partyState.leaderId ? "👑" : ""}</li>`;
  });
  listHtml += `</ul>`;
  box.innerHTML = listHtml;
}

// MMO Chat
function addChatMessage(sender: string, channel: string, text: string) {
  const area = document.getElementById("chat-messages")!;
  const msgDiv = document.createElement("div");
  msgDiv.className = `msg ${channel.toLowerCase()}`;
  msgDiv.innerHTML = `<span>[${channel}][${sender}]</span> : ${text}`;
  area.appendChild(msgDiv);
  area.scrollTop = area.scrollHeight;
}

function sendChatMessage() {
  const input = document.getElementById("chat-input") as HTMLInputElement;
  const channel = (document.getElementById("chat-channel-select") as HTMLSelectElement).value;
  const text = input.value.trim();
  if (!text) return;

  let payload: any = { channel, text };
  if (channel === "Murmure") {
    // Saisie: "/w pseudo message"
    if (text.startsWith("/w ")) {
      const parts = text.split(" ");
      payload.targetPseudo = parts[1];
      payload.text = parts.slice(2).join(" ");
    } else {
      addChatMessage("Système", "Général", "Format murmure incorrect. Utilisez: /w pseudo message");
      return;
    }
  }

  ws?.send(JSON.stringify({
    type: MsgType.C2S_CHAT,
    payload
  }));
  input.value = "";
}

// Inventaire & Forge
let selectedInventoryItemIds: string[] = [];

function renderHubInventory() {
  if (!currentCharacter) return;

  document.getElementById("char-name-stats")!.innerText = `${currentCharacter.name} (Niv. ${currentCharacter.level})`;
  document.getElementById("materials-count")!.innerText = currentCharacter.materials;

  // Render équipements équipés
  const equipped = new Map<string, any>();
  const items = currentCharacter.items || [];
  items.forEach((it: any) => {
    if (it.isEquipped) equipped.set(it.slot, it);
  });

  const slots = ["CASQUE", "TORSE", "JAMBES", "GANTS", "BAGUE", "COLLIER", "ARME1", "ARME2"];
  slots.forEach(slot => {
    const el = document.querySelector(`.slot[data-slot="${slot}"]`) as HTMLElement;
    const it = equipped.get(slot);
    if (it) {
      el.className = `slot filled border-${it.rarity}`;
      if (slot === "ARME1" || slot === "ARME2") {
        el.innerText = `${slot} [${it.gearset || "SWORD"}] (${it.rarity})`;
      } else {
        el.innerText = `${slot} (${it.rarity})`;
      }
      el.onclick = () => unequipItem(it.id, slot);
    } else {
      el.className = "slot";
      el.innerText = slot;
      el.onclick = null;
    }
  });

  // Render sacoche (Objets non équipés)
  const bagGrid = document.getElementById("bag-grid")!;
  bagGrid.innerHTML = "";
  
  const unequippedItems = items.filter((it: any) => !it.isEquipped);
  unequippedItems.forEach((it: any) => {
    const itemEl = document.createElement("div");
    itemEl.className = `bag-item border-${it.rarity}`;
    
    // Symbole visuel selon slot
    if (it.slot === "ARME1" || it.slot === "ARME2") {
      itemEl.innerText = `⚔️ ${it.gearset || "SWORD"}`;
    } else {
      itemEl.innerText = "🛡️";
    }
    
    itemEl.onclick = () => {
      // Toggle selection pour forge
      if (selectedInventoryItemIds.includes(it.id)) {
        selectedInventoryItemIds = selectedInventoryItemIds.filter(id => id !== it.id);
        itemEl.classList.remove("selected");
      } else {
        selectedInventoryItemIds.push(it.id);
        itemEl.classList.add("selected");
      }
    };

    // Double clic pour équiper
    itemEl.ondblclick = () => equipItem(it.id, it.slot);
    bagGrid.appendChild(itemEl);

  });

  // Stats calculées affichage
  const statsDisplay = document.getElementById("stat-list-display")!;
  statsDisplay.innerHTML = "";
  // Simulation de stats
  const statList = [
    { name: "Points de Vie Max", stat: Stat.MAX_HEALTH, value: 100 },
    { name: "Armure physique", stat: Stat.ARMOR, value: 10 },
    { name: "Vitesse de déplacement", stat: Stat.MOVEMENT_SPEED, value: 220 },
    { name: "Dégâts physiques", stat: Stat.PHYSICAL_DAMAGE, value: 1.0 },
    { name: "Chances de critique", stat: Stat.CRIT_CHANCE, value: 0.05 }
  ];

  statList.forEach(s => {
    const row = document.createElement("div");
    row.className = "stat-row";
    row.innerHTML = `<span>${s.name}</span><span class="val">${s.value}</span>`;
    statsDisplay.appendChild(row);
  });
}

async function equipItem(itemId: string, slot: string) {
  const res = await apiPost("/api/characters/equip", {
    characterId: currentCharacter.id,
    itemId,
    slot,
    action: "EQUIP"
  });
  if (res.id) {
    currentCharacter = res;
    renderHubInventory();
  }
}

async function unequipItem(itemId: string, slot: string) {
  const res = await apiPost("/api/characters/equip", {
    characterId: currentCharacter.id,
    itemId,
    slot,
    action: "UNEQUIP"
  });
  if (res.id) {
    currentCharacter = res;
    renderHubInventory();
  }
}

// Forge actions
function forgeAddLine() {
  if (selectedInventoryItemIds.length !== 1) return alert("Sélectionnez exactement 1 objet à modifier.");
  const itemId = selectedInventoryItemIds[0];
  ws?.send(JSON.stringify({
    type: MsgType.C2S_CRAFT_ACTION,
    payload: { action: "ADD_LINE", itemId, selectedCategory: "Attaque" }
  }));
  selectedInventoryItemIds = [];
}

function forgeSalvage() {
  if (selectedInventoryItemIds.length === 0) return alert("Sélectionnez au moins 1 objet à démanteler.");
  selectedInventoryItemIds.forEach(itemId => {
    ws?.send(JSON.stringify({
      type: MsgType.C2S_CRAFT_ACTION,
      payload: { action: "SALVAGE", itemId }
    }));
  });
  selectedInventoryItemIds = [];
}

function forgeFusion() {
  if (selectedInventoryItemIds.length !== 3) return alert("Sélectionnez exactement 3 objets de même rareté.");
  ws?.send(JSON.stringify({
    type: MsgType.C2S_CRAFT_ACTION,
    payload: { action: "FUSION", itemIds: selectedInventoryItemIds }
  }));
  selectedInventoryItemIds = [];
}

// Talents
function renderTalentTree() {
  if (!currentCharacter) return;
  const grid = document.getElementById("talents-nodes-grid")!;
  grid.innerHTML = "";

  const talentsMock = [
    { id: "stat_hp_1", name: "Robustesse de Base", desc: "+10% Points de Vie max", cost: 1 },
    { id: "stat_speed_1", name: "Agilité innée", desc: "+8% Vitesse de déplacement", cost: 1 }
  ];

  talentsMock.forEach(t => {
    const card = document.createElement("div");
    card.className = "talent-card-node";
    card.innerHTML = `<h5>${t.name}</h5><p>${t.desc}</p>`;
    card.onclick = () => {
      ws?.send(JSON.stringify({
        type: MsgType.C2S_TALENT_UNLOCK,
        payload: { talentId: t.id }
      }));
    };
    grid.appendChild(card);
  });
}

// ==========================================
// 5. GRAPHICS ENGINE & PIXIJS (GAME RUN)
// ==========================================
function drawMapLayout(container: Container) {
  if (!gameMap) return;

  // 1. Dessiner le sol et les bordures des Couloirs
  for (const corr of gameMap.corridors) {
    const floor = new Graphics();
    floor.rect(corr.x, corr.y, corr.width, corr.height);
    floor.fill({ color: 0x111625 });
    container.addChild(floor);

    const wall = new Graphics();
    if (corr.direction === "N" || corr.direction === "S") {
      wall.moveTo(corr.x, corr.y);
      wall.lineTo(corr.x, corr.y + corr.height);
      wall.moveTo(corr.x + corr.width, corr.y);
      wall.lineTo(corr.x + corr.width, corr.y + corr.height);
    } else {
      wall.moveTo(corr.x, corr.y);
      wall.lineTo(corr.x + corr.width, corr.y);
      wall.moveTo(corr.x, corr.y + corr.height);
      wall.lineTo(corr.x + corr.width, corr.y + corr.height);
    }
    wall.stroke({ width: 3, color: 0x485a7e });
    container.addChild(wall);
  }

  // 2. Dessiner le sol, les bordures et les obstacles des Salles
  for (const r of gameMap.rooms) {
    const floor = new Graphics();
    const walls = new Graphics();

    if (r.shape === "CIRCLE") {
      floor.circle(r.x, r.y, r.radius);
      floor.fill({ color: 0x0c0f1d });
      
      walls.circle(r.x, r.y, r.radius);
      let neonColor = 0x00f2fe; // Cyan
      if (r.type === "DEMI_BOSS_RED") neonColor = 0xff3838;
      else if (r.type === "DEMI_BOSS_BLUE") neonColor = 0x0066ff;
      else if (r.type === "BOSS") neonColor = 0xffcc00;
      
      walls.stroke({ width: 4, color: neonColor });
    } else {
      floor.rect(r.x - r.width / 2, r.y - r.height / 2, r.width, r.height);
      floor.fill({ color: 0x0c0f1d });

      walls.rect(r.x - r.width / 2, r.y - r.height / 2, r.width, r.height);
      walls.stroke({ width: 4, color: 0x00f2fe });
    }

    container.addChild(floor);
    container.addChild(walls);

    // Dessiner les obstacles intérieurs
    for (const obs of r.obstacles) {
      const obstacleGraphics = new Graphics();
      if (obs.shape === "CIRCLE") {
        obstacleGraphics.circle(obs.x, obs.y, obs.radius || 40);
      } else {
        obstacleGraphics.rect(obs.x - obs.width! / 2, obs.y - obs.height! / 2, obs.width!, obs.height!);
      }
      obstacleGraphics.fill({ color: 0x221a36 });
      obstacleGraphics.stroke({ width: 3, color: 0x9b59b6 });
      container.addChild(obstacleGraphics);
    }
  }
}

function drawDoorsLayout(container: Container) {
  if (!gameMap) return;

  for (const d of gameMap.doors) {
    const dg = new Graphics();
    dg.rect(0, 0, d.width, d.height);
    
    let color = 0xffcc00; // Gold
    if (d.color === "red") color = 0xff3838;
    else if (d.color === "blue") color = 0x0066ff;

    dg.fill({ color });
    dg.stroke({ width: 2, color: 0xffffff });
    
    dg.position.set(d.x, d.y);
    container.addChild(dg);
    doorsEntities.set(d.id, dg);
  }
}

function getMapSegments(): { a: { x: number; y: number }; b: { x: number; y: number } }[] {
  const segments: { a: { x: number; y: number }; b: { x: number; y: number } }[] = [];
  if (!gameMap) return segments;

  // 1. Murs des couloirs
  for (const corr of gameMap.corridors) {
    if (corr.direction === "N" || corr.direction === "S") {
      segments.push({ a: { x: corr.x, y: corr.y }, b: { x: corr.x, y: corr.y + corr.height } });
      segments.push({ a: { x: corr.x + corr.width, y: corr.y }, b: { x: corr.x + corr.width, y: corr.y + corr.height } });
    } else {
      segments.push({ a: { x: corr.x, y: corr.y }, b: { x: corr.x + corr.width, y: corr.y } });
      segments.push({ a: { x: corr.x, y: corr.y + corr.height }, b: { x: corr.x + corr.width, y: corr.y + corr.height } });
    }
  }

  const isMidpointInCorridor = (x: number, y: number) => {
    for (const corr of gameMap.corridors) {
      if (x >= corr.x - 2 && x <= corr.x + corr.width + 2 &&
          y >= corr.y - 2 && y <= corr.y + corr.height + 2) {
        return true;
      }
    }
    return false;
  };

  // 2. Murs extérieurs des Salles
  for (const r of gameMap.rooms) {
    if (r.shape === "CIRCLE") {
      const numSegments = 24;
      for (let i = 0; i < numSegments; i++) {
        const a1 = (i * Math.PI * 2) / numSegments;
        const a2 = (((i + 1) % numSegments) * Math.PI * 2) / numSegments;
        
        const ax = r.x + Math.cos(a1) * r.radius;
        const ay = r.y + Math.sin(a1) * r.radius;
        const bx = r.x + Math.cos(a2) * r.radius;
        const by = r.y + Math.sin(a2) * r.radius;
        
        const mx = (ax + bx) / 2;
        const my = (ay + by) / 2;
        
        if (!isMidpointInCorridor(mx, my)) {
          segments.push({ a: { x: ax, y: ay }, b: { x: bx, y: by } });
        }
      }
    } else {
      const x1 = r.x - r.width / 2;
      const x2 = r.x + r.width / 2;
      const y1 = r.y - r.height / 2;
      const y2 = r.y + r.height / 2;

      const candidates = [
        { a: { x: x1, y: y1 }, b: { x: x2, y: y1 } },
        { a: { x: x2, y: y1 }, b: { x: x2, y: y2 } },
        { a: { x: x2, y: y2 }, b: { x: x1, y: y2 } },
        { a: { x: x1, y: y2 }, b: { x: x1, y: y1 } }
      ];

      for (const seg of candidates) {
        const mx = (seg.a.x + seg.b.x) / 2;
        const my = (seg.a.y + seg.b.y) / 2;
        if (!isMidpointInCorridor(mx, my)) {
          segments.push(seg);
        } else {
          // Split wall around opening
          const corr = gameMap.corridors.find((c: any) => mx >= c.x - 2 && mx <= c.x + c.width + 2 && my >= c.y - 2 && my <= c.y + c.height + 2);
          if (corr) {
            if (corr.direction === "N" || corr.direction === "S") {
              segments.push({ a: seg.a, b: { x: corr.x, y: seg.a.y } });
              segments.push({ a: { x: corr.x + corr.width, y: seg.a.y }, b: seg.b });
            } else {
              segments.push({ a: seg.a, b: { x: seg.a.x, y: corr.y } });
              segments.push({ a: { x: seg.a.x, y: corr.y + corr.height }, b: seg.b });
            }
          }
        }
      }
    }

    // Obstacles
    for (const obs of r.obstacles) {
      if (obs.shape === "CIRCLE") {
        const numSegments = 12;
        const rad = obs.radius || 40;
        for (let i = 0; i < numSegments; i++) {
          const a1 = (i * Math.PI * 2) / numSegments;
          const a2 = (((i + 1) % numSegments) * Math.PI * 2) / numSegments;
          segments.push({
            a: { x: obs.x + Math.cos(a1) * rad, y: obs.y + Math.sin(a1) * rad },
            b: { x: obs.x + Math.cos(a2) * rad, y: obs.y + Math.sin(a2) * rad }
          });
        }
      } else {
        const ox1 = obs.x - obs.width! / 2;
        const ox2 = obs.x + obs.width! / 2;
        const oy1 = obs.y - obs.height! / 2;
        const oy2 = obs.y + obs.height! / 2;
        
        segments.push({ a: { x: ox1, y: oy1 }, b: { x: ox2, y: oy1 } });
        segments.push({ a: { x: ox2, y: oy1 }, b: { x: ox2, y: oy2 } });
        segments.push({ a: { x: ox2, y: oy2 }, b: { x: ox1, y: oy2 } });
        segments.push({ a: { x: ox1, y: oy2 }, b: { x: ox1, y: oy1 } });
      }
    }
  }

  // 3. Portes verrouillées
  for (const door of gameMap.doors) {
    const doorEntity = doorsEntities.get(door.id);
    const isLocked = doorEntity ? doorEntity.visible : door.locked;
    if (isLocked) {
      segments.push({ a: { x: door.x, y: door.y }, b: { x: door.x + door.width, y: door.y } });
      segments.push({ a: { x: door.x + door.width, y: door.y }, b: { x: door.x + door.width, y: door.y + door.height } });
      segments.push({ a: { x: door.x + door.width, y: door.y + door.height }, b: { x: door.x, y: door.y + door.height } });
      segments.push({ a: { x: door.x, y: door.y + door.height }, b: { x: door.x, y: door.y } });
    }
  }

  return segments;
}

function updateFogOfWar(px: number, py: number) {
  if (!fogMask) return;

  const segments = getMapSegments();
  const visionRadius = 200; // Vision du personnage de taille fixe

  const uniqueAngles = new Set<number>();
  for (let i = 0; i < 60; i++) {
    uniqueAngles.add((i * Math.PI * 2) / 60);
  }

  for (const seg of segments) {
    const a1 = Math.atan2(seg.a.y - py, seg.a.x - px);
    const a2 = Math.atan2(seg.b.y - py, seg.b.x - px);
    
    uniqueAngles.add(a1);
    uniqueAngles.add(a1 - 0.0005);
    uniqueAngles.add(a1 + 0.0005);
    
    uniqueAngles.add(a2);
    uniqueAngles.add(a2 - 0.0005);
    uniqueAngles.add(a2 + 0.0005);
  }

  const angles = Array.from(uniqueAngles);
  const hits: { x: number; y: number; angle: number }[] = [];

  for (const angle of angles) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    
    let minT = visionRadius;

    for (const seg of segments) {
      const sax = seg.a.x;
      const say = seg.a.y;
      const sbx = seg.b.x;
      const sby = seg.b.y;

      const sdx = sbx - sax;
      const sdy = sby - say;

      const denom = dx * sdy - dy * sdx;
      if (Math.abs(denom) < 0.0001) continue;

      const t = ((sax - px) * sdy - (say - py) * sdx) / denom;
      const u = ((sax - px) * dy - (say - py) * dx) / denom;

      if (t >= 0 && t < minT && u >= 0 && u <= 1) {
        minT = t;
      }
    }

    hits.push({
      x: px + dx * minT,
      y: py + dy * minT,
      angle: angle
    });
  }

  hits.sort((a, b) => {
    const normA = (a.angle < 0) ? a.angle + Math.PI * 2 : a.angle;
    const normB = (b.angle < 0) ? b.angle + Math.PI * 2 : b.angle;
    return normA - normB;
  });

  fogMask.clear();
  if (hits.length > 0) {
    fogMask.moveTo(hits[0].x, hits[0].y);
    for (let i = 1; i < hits.length; i++) {
      fogMask.lineTo(hits[i].x, hits[i].y);
    }
    fogMask.lineTo(hits[0].x, hits[0].y);
    fogMask.fill({ color: 0xffffff });
  }
}

async function initPixiGame(startPayload: any) {
  gameMap = startPayload.map;

  pixiApp = new Application();
  await pixiApp.init({
    resizeTo: window,
    backgroundColor: 0x05070e,
    antialias: true
  });

  const gamePage = document.getElementById("game-page")!;
  gamePage.querySelectorAll("canvas").forEach(c => c.remove());
  gamePage.appendChild(pixiApp.canvas);

  gameContainer = new Container();
  pixiApp.stage.addChild(gameContainer);

  // Initialisation des calques de rendu et du brouillard de guerre
  mapBgContainer = new Container();
  mapBgContainer.alpha = 0.25; // Brouillard d'exploration
  gameContainer.addChild(mapBgContainer);

  gameplayContainer = new Container();
  gameContainer.addChild(gameplayContainer);

  fogMask = new Graphics();
  gameplayContainer.addChild(fogMask);
  gameplayContainer.mask = fogMask;

  doorsEntities.forEach(d => d.destroy());
  doorsEntities.clear();

  // Dessiner la structure de la carte
  drawMapLayout(mapBgContainer);
  drawMapLayout(gameplayContainer);
  drawDoorsLayout(gameplayContainer);

  // Setup HUD
  document.getElementById("hud-keys-collected")!.innerText = "Clés : 0 / 2";
  document.getElementById("hud-room-name")!.innerText = "Campement de Départ";

  // Bind inputs
  bindGameInputs();

  // Tick local
  pixiApp.ticker.add(() => {
    updateClientLocal(1 / 60);
  });
}

function bindGameInputs() {
  // Reset
  keys.up = keys.down = keys.left = keys.right = keys.dash = keys.ult1 = keys.ult2 = false;

  window.onkeydown = null;
  window.onkeyup = null;

  // Suivi de la souris
  window.onmousemove = (e) => {
    lastMouseClientX = e.clientX;
    lastMouseClientY = e.clientY;
  };

  if (pixiApp) {
    pixiApp.canvas.onmousedown = (e) => {
      if (e.button === 0) {
        keys.dash = true;
      } else if (e.button === 2) {
        keys.ult1 = true;
      }
    };
    pixiApp.canvas.oncontextmenu = (e) => {
      e.preventDefault();
    };
  }
}

function checkCircleAABBCollisionClient(circle: { x: number; y: number; radius: number }, rect: { x: number; y: number; width: number; height: number }): boolean {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const distanceSq = dx * dx + dy * dy;

  return distanceSq < circle.radius * circle.radius;
}

function resolveCircleAABBCollisionClient(circle: { x: number; y: number; radius: number }, rect: { x: number; y: number; width: number; height: number }) {
  const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
  const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

  const dx = circle.x - closestX;
  const dy = circle.y - closestY;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 0) {
    circle.x = closestX + (dx / dist) * circle.radius;
    circle.y = closestY + (dy / dist) * circle.radius;
  } else {
    const leftDist = circle.x - rect.x;
    const rightDist = (rect.x + rect.width) - circle.x;
    const topDist = circle.y - rect.y;
    const bottomDist = (rect.y + rect.height) - circle.y;

    const minDist = Math.min(leftDist, rightDist, topDist, bottomDist);
    if (minDist === leftDist) {
      circle.x = rect.x - circle.radius;
    } else if (minDist === rightDist) {
      circle.x = rect.x + rect.width + circle.radius;
    } else if (minDist === topDist) {
      circle.y = rect.y - circle.radius;
    } else {
      circle.y = rect.y + rect.height + circle.radius;
    }
  }
}

function resolveCollisionsForEntityClient(entity: { x: number; y: number; radius: number }, isDashing: boolean) {
  if (!gameMap) return;

  // 1. Obstacles de la salle active (si pas de dash)
  if (!isDashing) {
    const activeRoom = gameMap.rooms.find((r: any) => r.id === activeRoomId);
    if (activeRoom && activeRoom.obstacles) {
      for (const obs of activeRoom.obstacles) {
        if (obs.shape === "CIRCLE") {
          const dx = entity.x - obs.x;
          const dy = entity.y - obs.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = entity.radius + (obs.radius || 40);
          if (dist < minDist) {
            if (dist > 0) {
              entity.x = obs.x + (dx / dist) * minDist;
              entity.y = obs.y + (dy / dist) * minDist;
            } else {
              entity.x += entity.radius;
            }
          }
        } else {
          const rect = {
            x: obs.x - obs.width! / 2,
            y: obs.y - obs.height! / 2,
            width: obs.width!,
            height: obs.height!
          };
          if (checkCircleAABBCollisionClient(entity, rect)) {
            resolveCircleAABBCollisionClient(entity, rect);
          }
        }
      }
    }
  }

  // 2. Portes verrouillées
  if (gameMap.doors) {
    for (const door of gameMap.doors) {
      if (door.locked) {
        if (checkCircleAABBCollisionClient(entity, door)) {
          resolveCircleAABBCollisionClient(entity, door);
        }
      }
    }
  }

  // 3. Murs latéraux des couloirs (épaisseur 100)
  if (gameMap.corridors) {
    for (const corr of gameMap.corridors) {
      if (corr.direction === "N" || corr.direction === "S") {
        const leftWall = { x: corr.x - 100, y: corr.y, width: 100, height: corr.height };
        if (checkCircleAABBCollisionClient(entity, leftWall)) {
          resolveCircleAABBCollisionClient(entity, leftWall);
        }
        const rightWall = { x: corr.x + corr.width, y: corr.y, width: 100, height: corr.height };
        if (checkCircleAABBCollisionClient(entity, rightWall)) {
          resolveCircleAABBCollisionClient(entity, rightWall);
        }
      } else {
        const topWall = { x: corr.x, y: corr.y - 100, width: corr.width, height: 100 };
        if (checkCircleAABBCollisionClient(entity, topWall)) {
          resolveCircleAABBCollisionClient(entity, topWall);
        }
        const bottomWall = { x: corr.x, y: corr.y + corr.height, width: corr.width, height: 100 };
        if (checkCircleAABBCollisionClient(entity, bottomWall)) {
          resolveCircleAABBCollisionClient(entity, bottomWall);
        }
      }
    }
  }

  // 4. Bords extérieurs de la salle
  let insideCorridor = false;
  if (gameMap.corridors) {
    for (const corr of gameMap.corridors) {
      let marginX = 0;
      let marginY = 0;
      if (corr.direction === "N" || corr.direction === "S") {
        marginY = 20;
      } else {
        marginX = 20;
      }
      if (entity.x >= corr.x - marginX && entity.x <= corr.x + corr.width + marginX &&
          entity.y >= corr.y - marginY && entity.y <= corr.y + corr.height + marginY) {
        insideCorridor = true;
        break;
      }
    }
  }

  if (!insideCorridor) {
    const room = gameMap.rooms.find((r: any) => r.id === activeRoomId);
    if (room) {
      if (room.shape === "CIRCLE") {
        const dx = entity.x - room.x;
        const dy = entity.y - room.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const limit = room.radius - entity.radius;
        if (dist > limit) {
          if (dist > 0) {
            entity.x = room.x + (dx / dist) * limit;
            entity.y = room.y + (dy / dist) * limit;
          } else {
            entity.x = room.x;
            entity.y = room.y;
          }
        }
      } else {
        const minX = room.x - room.width / 2 + entity.radius;
        const maxX = room.x + room.width / 2 - entity.radius;
        const minY = room.y - room.height / 2 + entity.radius;
        const maxY = room.y + room.height / 2 - entity.radius;

        if (entity.x < minX) entity.x = minX;
        if (entity.x > maxX) entity.x = maxX;
        if (entity.y < minY) entity.y = minY;
        if (entity.y > maxY) entity.y = maxY;
      }
    }
  }
}

function getLocalPlayerCooldownRecovery(): number {
  if (!currentCharacter || !currentCharacter.items) return 0;
  let cooldownRecovery = 0;
  const weapon2 = currentCharacter.items.find((it: any) => it.isEquipped && it.slot === "ARME2");
  if (weapon2 && (weapon2.gearset || "DAGGER") === "DAGGER") {
    cooldownRecovery += 0.15;
  }
  return cooldownRecovery;
}

function updateClientLocal(dt: number) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;

  // Calculer l'angle de la souris et l'état de déplacement
  let dx = 0;
  let dy = 0;
  let moving = false;

  if (pixiApp) {
    const rect = pixiApp.canvas.getBoundingClientRect();
    const centerX = pixiApp.screen.width / 2;
    const centerY = pixiApp.screen.height / 2;
    const x = lastMouseClientX - rect.left - centerX;
    const y = lastMouseClientY - rect.top - centerY;
    const dist = Math.sqrt(x * x + y * y);
    if (dist >= 24) {
      mouseAngle = Math.atan2(y, x);
      moving = true;
      dx = Math.cos(mouseAngle);
      dy = Math.sin(mouseAngle);
    }
  }

  // 1. Envoyer les inputs actuels au serveur (30 Hz standard, ou à chaque frame)
  clientSequenceNumber++;
  const inputPayload: PlayerInput = {
    sequenceNumber: clientSequenceNumber,
    keys: { ...keys },
    mouseAngle,
    moving
  };

  // Mettre à jour les timers locaux de dash
  if (localPlayerDashCooldown > 0) {
    localPlayerDashCooldown -= dt;
    if (localPlayerDashCooldown < 0) localPlayerDashCooldown = 0;
  }
  const wasDashingLocally = localPlayerDashDuration > 0;
  if (localPlayerDashDuration > 0) {
    localPlayerDashDuration -= dt;
    if (localPlayerDashDuration < 0) localPlayerDashDuration = 0;
  }

  // Mettre à jour l'affichage visuel du cooldown sur le HUD
  const cooldownOverlay = document.getElementById("cooldown-dash");
  if (cooldownOverlay) {
    const cooldownRecovery = getLocalPlayerCooldownRecovery();
    const maxCooldown = 1.5 - cooldownRecovery;
    const pct = maxCooldown > 0 ? (localPlayerDashCooldown / maxCooldown) * 100 : 0;
    cooldownOverlay.style.height = `${pct}%`;
  }

  // Si le dash vient de se terminer localement, on remet le flag dashing à false
  if (wasDashingLocally && localPlayerDashDuration === 0) {
    localPlayerDashing = false;
  }

  // Déclencher le dash localement si demandé et disponible
  if (keys.dash && localPlayerDashCooldown <= 0 && localPlayerDashDuration <= 0) {
    localPlayerDashDuration = 0.25;
    const cooldownRecovery = getLocalPlayerCooldownRecovery();
    localPlayerDashCooldown = 1.5 - cooldownRecovery;
    localPlayerDashing = true;
    
    // Déterminer la direction de dash local (vers l'angle de souris)
    let dashDx = dx;
    let dashDy = dy;
    if (dashDx === 0 && dashDy === 0) {
      dashDx = Math.cos(mouseAngle);
      dashDy = Math.sin(mouseAngle);
    }
    localPlayerDashDirectionX = dashDx;
    localPlayerDashDirectionY = dashDy;
  }

  // Calculer la vitesse (vx, vy) locale pour cette frame
  let vx = 0;
  let vy = 0;
  if (localPlayerDashDuration > 0) {
    const dashSpeed = (localPlayerSpeed || 220) * 2.5;
    vx = localPlayerDashDirectionX * dashSpeed;
    vy = localPlayerDashDirectionY * dashSpeed;
  } else {
    vx = dx * (localPlayerSpeed || 220);
    vy = dy * (localPlayerSpeed || 220);
  }

  // Appliquer le déplacement
  localPlayerEntity.x += vx * dt;
  localPlayerEntity.y += vy * dt;

  // Résoudre les collisions sur le client local pour éviter les tremblements et les traversées
  resolveCollisionsForEntityClient(localPlayerEntity, localPlayerDashDuration > 0);

  // Stocker dans le buffer de réconciliation avec les vitesses et état exacts pour cette étape
  inputBuffer.push({
    seq: clientSequenceNumber,
    vx,
    vy,
    dt,
    isDashing: localPlayerDashDuration > 0
  });

  // Envoyer au serveur
  ws.send(JSON.stringify({
    type: MsgType.C2S_INPUT,
    payload: inputPayload
  }));

  // Reset des déclencheurs one-shot
  keys.dash = false;

  keys.ult1 = false;
  keys.ult2 = false;

  // 2. Mettre à jour les projectiles locaux animés
  updateProjectilesLocal(dt);

  // 3. Mettre à jour la caméra, les graphismes du joueur local et le brouillard de guerre
  if (gameContainer && pixiApp) {
    const zoom = 2.0;
    const centerX = pixiApp.screen.width / 2;
    const centerY = pixiApp.screen.height / 2;
    gameContainer.scale.set(zoom);
    gameContainer.position.set(centerX - localPlayerEntity.x * zoom, centerY - localPlayerEntity.y * zoom);

    // Mettre à jour immédiatement la position du graphisme du joueur local à 60 Hz
    if (currentUser) {
      const pe = playersEntities.get(currentUser.id);
      if (pe) {
        pe.x = localPlayerEntity.x;
        pe.y = localPlayerEntity.y;
        pe.graphics.position.set(pe.x, pe.y);
        pe.label.position.set(pe.x, pe.y - 20);
      }
    }
  }
  updateFogOfWar(localPlayerEntity.x, localPlayerEntity.y);
}

// ==========================================
// NETCODE : RÉCONCILIATION ET RENDU SNAPSHOT
// ==========================================
function handleServerSnapshot(snapshot: any) {
  if (!pixiApp || !gameContainer || !gameplayContainer) return;

  keysCollected = snapshot.keysCollected;
  document.getElementById("hud-keys-collected")!.innerText = `Clés : ${keysCollected} / 2`;

  // 1. Rendre les Joueurs
  snapshot.players.forEach((p: any) => {
    const isLocal = p.userId === currentUser.id;

    if (isLocal) {
      localPlayerSpeed = p.speed || 220;
      localPlayerDashing = p.dashing || false;

      // Réconciliation locale
      localPlayerEntity.x = p.x;
      localPlayerEntity.y = p.y;
      
      // Filtrer le buffer d'inputs pour ré-appliquer les non acquittés
      const lastSeq = p.lastInputSeq;
      const idx = inputBuffer.findIndex(i => i.seq === lastSeq);
      if (idx !== -1) {
        inputBuffer.splice(0, idx + 1);
      }

      // Ré-appliquer les inputs non acquittés avec les vitesses et état exacts enregistrés
      inputBuffer.forEach(input => {
        localPlayerEntity.x += input.vx * input.dt;
        localPlayerEntity.y += input.vy * input.dt;
        resolveCollisionsForEntityClient(localPlayerEntity, input.isDashing);
      });

      // Mettre à jour l'affichage HUD
      document.getElementById("hud-hp-fill")!.style.width = `${(p.hp / p.maxHp) * 100}%`;
      document.getElementById("hud-hp-text")!.innerText = `${Math.ceil(p.hp)} / ${p.maxHp}`;
    }

    // Graphisme du joueur
    let pe = playersEntities.get(p.userId);
    if (!pe) {
      const g = new Graphics();
      const style = new TextStyle({ fontSize: 10, fill: 0xffffff });
      const label = new Text({ text: p.pseudo, style });
      label.anchor.set(0.5, 1);
      
      gameplayContainer!.addChild(g);
      gameplayContainer!.addChild(label);
      pe = { graphics: g, label, serverX: p.x, serverY: p.y, x: p.x, y: p.y };
      playersEntities.set(p.userId, pe);
    }

    pe.serverX = isLocal ? localPlayerEntity.x : p.x;
    pe.serverY = isLocal ? localPlayerEntity.y : p.y;

    // LERP uniquement pour les autres joueurs en réseau, position instantanée pour le joueur local (évite la saccade avec la caméra)
    if (isLocal) {
      pe.x = pe.serverX;
      pe.y = pe.serverY;
    } else {
      pe.x += (pe.serverX - pe.x) * 0.3;
      pe.y += (pe.serverY - pe.y) * 0.3;
    }

    pe.graphics.clear();
    pe.graphics.circle(0, 0, 16);
    pe.graphics.fill(p.isKO ? 0x7f8c8d : 0x00f2fe);
    pe.graphics.position.set(pe.x, pe.y);
    
    pe.label.position.set(pe.x, pe.y - 20);
  });

  // Nettoyer joueurs déconnectés/supprimés
  playersEntities.forEach((val, key) => {
    if (!snapshot.players.find((pl: any) => pl.userId === key)) {
      val.graphics.destroy();
      val.label.destroy();
      playersEntities.delete(key);
    }
  });

  // 2. Rendre les Monstres
  snapshot.enemies.forEach((e: any) => {
    let ee = enemiesEntities.get(e.id);
    if (!ee) {
      const g = new Graphics();
      const hp = new Graphics();
      gameplayContainer!.addChild(g);
      gameplayContainer!.addChild(hp);
      ee = { graphics: g, hpBar: hp, serverX: e.x, serverY: e.y, x: e.x, y: e.y };
      enemiesEntities.set(e.id, ee);
    }

    ee.serverX = e.x;
    ee.serverY = e.y;
    ee.x += (ee.serverX - ee.x) * 0.35;
    ee.y += (ee.serverY - ee.y) * 0.35;

    // Rendu du monstre (Carré)
    ee.graphics.clear();
    ee.graphics.rect(-e.radius, -e.radius, e.radius * 2, e.radius * 2);
    ee.graphics.fill(0xe74c3c);
    ee.graphics.position.set(ee.x, ee.y);

    // Barre de vie monstre
    ee.hpBar.clear();
    ee.hpBar.rect(-e.radius, -e.radius - 8, e.radius * 2, 4);
    ee.hpBar.fill(0x333333);
    const lifeW = (e.hp / e.maxHp) * (e.radius * 2);
    ee.hpBar.rect(-e.radius, -e.radius - 8, lifeW, 4);
    ee.hpBar.fill(0x2ecc71);
    ee.hpBar.position.set(ee.x, ee.y);
  });

  // Nettoyer monstres morts
  enemiesEntities.forEach((val, key) => {
    if (!snapshot.enemies.find((en: any) => en.id === key)) {
      val.graphics.destroy();
      val.hpBar.destroy();
      enemiesEntities.delete(key);
    }
  });

  // Mettre à jour l'affichage des portes (verrouillées/ouvertes)
  if (snapshot.doors) {
    snapshot.doors.forEach((d: any) => {
      const dg = doorsEntities.get(d.id);
      if (dg) {
        dg.visible = d.locked;
      }
      if (gameMap && gameMap.doors) {
        const mapDoor = gameMap.doors.find((md: any) => md.id === d.id);
        if (mapDoor) {
          mapDoor.locked = d.locked;
        }
      }
    });
  }
}

// Simulation des projectiles locaux (Bullet hell décentralisé)
function spawnProjectilesLocally(pattern: any) {
  if (!gameContainer || !gameplayContainer) return;

  const count = pattern.bulletCount || 1;
  const isMonster = pattern.isMonster || false;
  
  if (pattern.isBossPattern) {
    // Rendu visuel d'une spirale de projectiles
    let curAngle = pattern.baseAngle || 0;
    const step = (Math.PI * 2) / count;
    for (let i = 0; i < count; i++) {
      const p = getFreeProjectile();
      p.x = pattern.originX;
      p.y = pattern.originY;
      p.vx = Math.cos(curAngle) * pattern.speed;
      p.vy = Math.sin(curAngle) * pattern.speed;
      p.life = pattern.duration || 3.0;
      p.isMonster = true;
      p.radius = 6;
      p.sprite.clear();
      p.sprite.circle(0, 0, p.radius);
      p.sprite.fill(0xe67e22); // Orange pour boss
      p.sprite.position.set(p.x, p.y);
      gameplayContainer.addChild(p.sprite);
      activeProjectiles.push(p);
      curAngle += step;
    }
  } else {
    // Projectile unique
    const p = getFreeProjectile();
    p.x = pattern.x;
    p.y = pattern.y;
    const angle = pattern.angle !== undefined ? pattern.angle : Math.atan2(pattern.targetY - pattern.y, pattern.targetX - pattern.x);
    p.vx = Math.cos(angle) * pattern.speed;
    p.vy = Math.sin(angle) * pattern.speed;
    p.life = (pattern.range || 100) / pattern.speed;
    p.isMonster = isMonster;
    p.radius = pattern.radius || 4;

    p.sprite.clear();
    p.sprite.circle(0, 0, p.radius);
    p.sprite.fill(isMonster ? 0x9b59b6 : 0x00f2fe);
    p.sprite.position.set(p.x, p.y);
    gameplayContainer.addChild(p.sprite);
    activeProjectiles.push(p);
  }
}

function getFreeProjectile(): any {
  if (projectilesPool.length > 0) {
    return projectilesPool.pop()!;
  }
  return { sprite: new Graphics(), x: 0, y: 0, vx: 0, vy: 0, life: 0, isMonster: false, radius: 4 };
}

function updateProjectilesLocal(dt: number) {
  for (let i = activeProjectiles.length - 1; i >= 0; i--) {
    const p = activeProjectiles[i];
    p.life -= dt;
    if (p.life <= 0) {
      p.sprite.parent?.removeChild(p.sprite);
      activeProjectiles.splice(i, 1);
      projectilesPool.push(p);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.sprite.position.set(p.x, p.y);
  }
}

// ==========================================
// 6. FIN DE RUN - RECAPITULATIF
// ==========================================
function renderRunRecap(payload: any) {
  const title = document.getElementById("recap-result-title")!;
  title.innerText = payload.victory ? "VICTOIRE !" : "DÉFAITE...";
  title.className = payload.victory ? "neon-text" : "";

  document.getElementById("recap-duration")!.innerText = payload.duration.toFixed(2);

  const lootGrid = document.getElementById("recap-loot-grid")!;
  lootGrid.innerHTML = "";

  const myLoot = payload.loot[currentUser.id] || [];
  if (myLoot.length === 0) {
    lootGrid.innerHTML = `<p class="empty-text">Aucun objet récolté dans cette run.</p>`;
  } else {
    myLoot.forEach((it: any) => {
      const div = document.createElement("div");
      div.className = `recap-loot-item border-${it.rarity}`;
      div.innerHTML = `<span>⚔️ ${it.slot} (${it.rarity})</span>`;
      lootGrid.appendChild(div);
    });
  }
}

// ==========================================
// 7. INITIALISATION DES LISTENERS DOM DU HUB
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  // Landing Page
  document.getElementById("btn-play-guest")!.onclick = loginGuest;
  document.getElementById("btn-login-discord")!.onclick = () => loginSocial("Discord");
  document.getElementById("btn-login-google")!.onclick = () => loginSocial("Google");

  // Character select
  document.getElementById("btn-create-char")!.onclick = createCharacter;
  document.getElementById("btn-cancel-create")!.onclick = () => {
    document.getElementById("char-creator")?.classList.add("hidden");
  };
  document.getElementById("btn-logout")!.onclick = () => {
    location.reload();
  };

  // Hub Navigation
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const tabId = (btn as HTMLElement).dataset.tab!;
      document.getElementById(tabId)?.classList.add("active");
    });
  });

  document.getElementById("btn-hub-back")!.onclick = () => {
    showView("character-page");
  };

  // Matchmaking
  document.getElementById("btn-launch-solo")!.onclick = () => {
    console.log("Clic Lancer Solo!");
    console.log("Etat du WebSocket:", ws ? ws.readyState : "null");
    console.log("Personnage courant sélectionné:", currentCharacter);
    ws?.send(JSON.stringify({
      type: MsgType.C2S_JOIN_MATCHMAKING,
      payload: { bossId: "boss_hyper_octogone", difficulty: "NORMAL", launchSolo: true }
    }));
  };

  document.getElementById("btn-join-matchmaking")!.onclick = () => {
    ws?.send(JSON.stringify({
      type: MsgType.C2S_JOIN_MATCHMAKING,
      payload: { bossId: "boss_hyper_octogone", difficulty: "NORMAL", launchSolo: false }
    }));
  };

  // Social & Invite
  document.getElementById("btn-invite-party")!.onclick = () => {
    const input = document.getElementById("invite-pseudo") as HTMLInputElement;
    const targetPseudo = input.value.trim();
    if (!targetPseudo) return;
    ws?.send(JSON.stringify({
      type: MsgType.C2S_PARTY_INVITE,
      payload: { targetPseudo }
    }));
    input.value = "";
  };

  // Chat MMO
  document.getElementById("chat-input")!.onkeydown = (e) => {
    if (e.key === "Enter") {
      sendChatMessage();
    }
  };

  // Forge actions bind
  document.getElementById("btn-forge-add-line")!.onclick = forgeAddLine;
  document.getElementById("btn-forge-salvage")!.onclick = forgeSalvage;
  document.getElementById("btn-forge-fusion")!.onclick = forgeFusion;

  // Recap
  document.getElementById("btn-recap-close")!.onclick = () => {
    showView("hub-page");
    renderHubInventory();
  };
});
