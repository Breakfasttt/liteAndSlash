import { WebSocket } from "ws";
import * as fs from "fs";
import { SharedPlayer } from "../../shared/core/Player";
import { Salle, Ennemi, RoomType, Item, WeaponType, Entity } from "../../shared/core/BaseClasses";
import { GameRegistry } from "../../shared/core/GameRegistry";
import { Stat } from "../../shared/core/Stats";
import { SpatialHashGrid } from "../../shared/physics/SpatialHashGrid";
import { checkCircleCollision, checkCircleAABBCollision, AABB } from "../../shared/physics/types";
import { MsgType, WSMessage, PlayerInput } from "../../shared/types/network";
import { dbService } from "../database";
import { GameManager } from "./GameManager";
import { LobbyServer, ConnectedClient } from "../lobby";

// Modèle d'Item pour génération de Loot
interface GeneratedItem {
  slot: string;
  rarity: string;
  gearset?: string;
  statsJSON: string;
}

export class GameInstance {
  public id: string;
  public seed: number;
  public bossId: string;
  public difficulty: string;
  
  // Joueurs actifs dans l'instance
  public players = new Map<string, {
    client: SharedPlayer;
    ws: WebSocket;
    pseudo: string;
    userId: string;
    characterId: string;
    lastInputSeq: number;
    inputQueue: PlayerInput[];
    dashCooldown: number;
    dashDuration: number;
    dashDirectionX: number;
    dashDirectionY: number;
    koDeaths: number;
    koTimer: number; // Temps restant au sol pour être réanimé
    isKO: boolean;
  }>();

  // Entités du monde
  public enemies = new Map<string, Ennemi>();
  public projectiles: any[] = [];
  public aoeZones: any[] = [];
  public rooms = new Map<string, Salle>();
  public activeRoomId: string = "room_start";
  public keysCollected: number = 0; // Clé 1 (demi-boss rouge) et Clé 2 (demi-boss bleu)
  
  // Couloirs et Portes (Map continue)
  public corridors: any[] = [];
  public doors: any[] = [];

  // Grille physique
  private grid = new SpatialHashGrid<any>(128);

  // Tickrate
  private intervalId: NodeJS.Timeout | null = null;
  private isEnded: boolean = false;
  private startTime: number = 0;

  constructor(id: string, seed: number, bossId: string, difficulty: string, clients: ConnectedClient[]) {
    this.id = id;
    this.seed = seed;
    this.bossId = bossId;
    this.difficulty = difficulty;

    // Charger les joueurs et leurs caractéristiques
    for (const c of clients) {
      const p = new SharedPlayer();
      p.id = "p_" + c.userId;
      p.userId = c.userId;
      p.name = c.pseudo;
      this.players.set(c.userId, {
        client: p,
        ws: c.ws,
        pseudo: c.pseudo,
        userId: c.userId,
        characterId: c.characterId!,
        lastInputSeq: 0,
        inputQueue: [],
        dashCooldown: 0,
        dashDuration: 0,
        dashDirectionX: 0,
        dashDirectionY: 0,
        koDeaths: 0,
        koTimer: 0,
        isKO: false
      });
    }

    this.generateProceduralMap();
  }

  // ==========================================
  // GENERATION DE LA MAP PROCÉDURALE (3x3 Grid)
  // ==========================================
  private generateProceduralMap() {
    // Layout déterministe simple 3x3 pour le MVP :
    // (0,0) [DemiBossRouge]  --- (1,0) [MOB]          --- (2,0) [EVENT]
    //                               |
    // (0,1) [BOSS - Locked]  --- (1,1) [START] (Start) --- (2,1) [MOB]
    //                               |
    // (0,2) [MOB]            --- (1,2) [MOB]          --- (2,2) [DemiBossBleu]
    
    const layout = [
      { id: "room_demiboss_red", type: "DEMI_BOSS_RED", gx: 0, gy: 0, name: "Sanctuaire du Gardien Rouge" },
      { id: "room_mob_north", type: "MOB", gx: 1, gy: 0, name: "Couloir du Nord" },
      { id: "room_event", type: "MOB", gx: 2, gy: 0, name: "Antichambre des Anciens" },
      { id: "room_boss", type: "BOSS", gx: 0, gy: 1, name: "Noyau de l'Hyper-Octogone" },
      { id: "room_start", type: "START", gx: 1, gy: 1, name: "Campement de Départ" },
      { id: "room_mob_east", type: "MOB", gx: 2, gy: 1, name: "Galerie de l'Est" },
      { id: "room_mob_southwest", type: "MOB", gx: 0, gy: 2, name: "Abîme de l'Ouest" },
      { id: "room_mob_south", type: "MOB", gx: 1, gy: 2, name: "Fosse du Sud" },
      { id: "room_demiboss_blue", type: "DEMI_BOSS_BLUE", gx: 2, gy: 2, name: "Sanctuaire du Gardien Bleu" }
    ];

    const spacing = 1800;

    for (const r of layout) {
      const roomInstance = GameRegistry.createSalle(r.type);
      roomInstance.id = r.id;
      roomInstance.name = r.name;
      // Positionner au centre absolu dans le monde
      roomInstance.x = r.gx * spacing;
      roomInstance.y = r.gy * spacing;

      // Transformer les obstacles de relatif en absolu
      for (const obs of roomInstance.obstacles) {
        obs.x += roomInstance.x;
        obs.y += roomInstance.y;
      }

      this.rooms.set(r.id, roomInstance);
    }

    // Configurer les liaisons (génère aussi les couloirs)
    this.connectRooms("room_start", "room_mob_north", "N");
    this.connectRooms("room_start", "room_mob_south", "S");
    this.connectRooms("room_start", "room_mob_east", "E");
    this.connectRooms("room_start", "room_boss", "W", true); // Boss locked par défaut

    this.connectRooms("room_mob_north", "room_demiboss_red", "W");
    this.connectRooms("room_mob_north", "room_event", "E");
    this.connectRooms("room_mob_south", "room_mob_southwest", "W");
    this.connectRooms("room_mob_south", "room_demiboss_blue", "E");
  }

  private connectRooms(r1Id: string, r2Id: string, direction: "N" | "S" | "E" | "W", locked: boolean = false) {
    const r1 = this.rooms.get(r1Id)!;
    const r2 = this.rooms.get(r2Id)!;

    r1.doors[direction] = { targetRoomId: r2Id, locked };
    
    const opposite = direction === "N" ? "S" : direction === "S" ? "N" : direction === "E" ? "W" : "E";
    r2.doors[opposite] = { targetRoomId: r1Id, locked };

    // Mathématiques des couloirs rectangulaires
    const corrWidth = 120;
    let corrX = 0;
    let corrY = 0;
    let corrW = 0;
    let corrH = 0;

    const h1 = r1.shape === "SQUARE" ? r1.height / 2 : r1.radius;
    const w1 = r1.shape === "SQUARE" ? r1.width / 2 : r1.radius;
    const h2 = r2.shape === "SQUARE" ? r2.height / 2 : r2.radius;
    const w2 = r2.shape === "SQUARE" ? r2.width / 2 : r2.radius;

    if (direction === "N") {
      corrX = r1.x - corrWidth / 2;
      corrY = r2.y + h2 - 10;
      corrW = corrWidth;
      corrH = (r1.y - h1 + 10) - corrY;
    } else if (direction === "S") {
      corrX = r1.x - corrWidth / 2;
      corrY = r1.y + h1 - 10;
      corrW = corrWidth;
      corrH = (r2.y - h2 + 10) - corrY;
    } else if (direction === "W") {
      corrX = r2.x + w2 - 10;
      corrY = r1.y - corrWidth / 2;
      corrW = (r1.x - w1 + 10) - corrX;
      corrH = corrWidth;
    } else if (direction === "E") {
      corrX = r1.x + w1 - 10;
      corrY = r1.y - corrWidth / 2;
      corrW = (r2.x - w2 + 10) - corrX;
      corrH = corrWidth;
    }

    const corridorId = `corr_${r1Id}_to_${r2Id}`;
    this.corridors.push({
      id: corridorId,
      x: corrX,
      y: corrY,
      width: corrW,
      height: corrH,
      direction,
      fromRoomId: r1Id,
      toRoomId: r2Id
    });

    if (locked) {
      let doorX = 0;
      let doorY = 0;
      let doorW = 0;
      let doorH = 0;
      const doorThickness = 20;

      if (direction === "N" || direction === "S") {
        doorX = corrX;
        doorY = corrY + corrH / 2 - doorThickness / 2;
        doorW = corrWidth;
        doorH = doorThickness;
      } else {
        doorX = corrX + corrW / 2 - doorThickness / 2;
        doorY = corrY;
        doorW = doorThickness;
        doorH = corrWidth;
      }

      let color = "boss";
      if (r1Id === "room_demiboss_red" || r2Id === "room_demiboss_red") color = "red";
      else if (r1Id === "room_demiboss_blue" || r2Id === "room_demiboss_blue") color = "blue";

      this.doors.push({
        id: `door_${corridorId}`,
        x: doorX,
        y: doorY,
        width: doorW,
        height: doorH,
        locked: true,
        color,
        corridorId
      });
    }
  }

  // ==========================================
  // CYCLE DE VIE & TICK INITIALISATION
  // ==========================================
  public async start() {
    this.startTime = Date.now();

    // Charger les personnages de la base de données
    for (const p of this.players.values()) {
      const char = await dbService.getCharacterById(p.characterId);
      if (char) {
        p.client.userId = p.userId;
        p.client.name = p.pseudo;
        p.client.level = char.level;
        p.client.xp = char.xp;
        p.client.materials = char.materials;
        p.client.initClass(char.classShape as any);
        
        // Charger les armes configurées
        const parsedWeapons = JSON.parse(char.weapons);
        p.client.weaponSkillTrees = parsedWeapons;

        // Charger l'équipement
        for (const item of char.items) {
          const statsMap = JSON.parse(item.statsJSON);
          const sharedItem: Item = {
            id: item.id,
            slot: item.slot,
            rarity: item.rarity as any,
            gearset: item.gearset || undefined,
            stats: statsMap,
            isEquipped: item.isEquipped
          };
          p.client.equipment.set(item.slot, sharedItem);
        }

        // Repositionner au centre de la salle start
        const startRoom = this.rooms.get("room_start")!;
        p.client.x = startRoom.x;
        p.client.y = startRoom.y;
        p.client.hp = p.client.getStat(Stat.MAX_HEALTH);
        p.client.maxHp = p.client.hp;
      }
    }

    // Signaler le début aux clients avec la config de la map
    const startPayload = {
      gameId: this.id,
      seed: this.seed,
      bossId: this.bossId,
      difficulty: this.difficulty,
      activeRoomId: this.activeRoomId,
      map: {
        rooms: Array.from(this.rooms.values()).map(r => ({
          id: r.id,
          name: r.name,
          type: r.type,
          shape: r.shape,
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          radius: r.radius,
          obstacles: r.obstacles
        })),
        corridors: this.corridors,
        doors: this.doors
      },
      players: Array.from(this.players.values()).map(p => ({
        userId: p.userId,
        pseudo: p.pseudo,
        classShape: p.client.classShape,
        hp: p.client.hp,
        maxHp: p.client.maxHp,
        level: p.client.level,
        x: p.client.x,
        y: p.client.y
      }))
    };

    for (const p of this.players.values()) {
      p.ws.send(JSON.stringify({ type: MsgType.S2C_RUN_START, payload: startPayload }));
    }

    // Déclencher le tick
    this.intervalId = setInterval(() => this.tick(), 1000 / 30); // 30Hz loop
  }

  // ==========================================
  // TICK DU SERVEUR AUTORITAIRE
  // ==========================================
  private tick() {
    if (this.isEnded) return;
    const dt = 1 / 30;

    // 1. Gérer les Dashs et Mouvements des joueurs
    this.updatePlayersMovement(dt);

    // 2. IA et Mouvements des monstres de la salle active
    this.updateMonstersIA(dt);

    // 3. Ticks de la salle en cours
    const currentRoom = this.rooms.get(this.activeRoomId)!;
    currentRoom.onTick(dt, this);

    // 4. Mettre à jour les collisions physiques et spatial Hash grid
    this.grid.clear();
    for (const p of this.players.values()) {
      if (!p.isKO && !p.client.isDead) this.grid.insert(p.client);
    }
    for (const e of this.enemies.values()) {
      this.grid.insert(e);
    }

    this.resolveWorldCollisions();

    // 5. Gérer les zones à effets AoE
    this.updateAOE(dt);

    // 6. Ticks d'auto-attaques et auras passives des joueurs
    this.updatePlayerAttacks(dt);
    this.updatePlayerAuras(dt);

    // 7. Envoyer la snapshot binaire/JSON à tous les joueurs connectés
    this.broadcastSnapshot();
  }

  private resolveCollisionsForEntity(entity: { x: number; y: number; radius: number }, isDashing: boolean) {
    // 1. Collision avec les obstacles intérieurs de la salle active (uniquement si pas de dash)
    if (!isDashing) {
      const activeRoom = this.rooms.get(this.activeRoomId);
      if (activeRoom) {
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
            // Obstacle rectangulaire
            const rect = {
              x: obs.x - obs.width! / 2,
              y: obs.y - obs.height! / 2,
              width: obs.width!,
              height: obs.height!
            };
            if (checkCircleAABBCollision(entity, rect)) {
              this.resolveCircleAABBCollision(entity, rect);
            }
          }
        }
      }
    }

    // 2. Collision avec les portes verrouillées
    for (const door of this.doors) {
      if (door.locked) {
        if (checkCircleAABBCollision(entity, door)) {
          this.resolveCircleAABBCollision(entity, door);
        }
      }
    }

    // 3. Collision avec les murs latéraux des couloirs (épaisseur 100 pour empêcher le passage)
    for (const corr of this.corridors) {
      if (corr.direction === "N" || corr.direction === "S") {
        // Couloir vertical : murs à gauche (corr.x) et à droite (corr.x + corr.width)
        const leftWall = { x: corr.x - 100, y: corr.y, width: 100, height: corr.height };
        if (checkCircleAABBCollision(entity, leftWall)) {
          this.resolveCircleAABBCollision(entity, leftWall);
        }
        const rightWall = { x: corr.x + corr.width, y: corr.y, width: 100, height: corr.height };
        if (checkCircleAABBCollision(entity, rightWall)) {
          this.resolveCircleAABBCollision(entity, rightWall);
        }
      } else {
        // Couloir horizontal : murs en haut (corr.y) et en bas (corr.y + corr.height)
        const topWall = { x: corr.x, y: corr.y - 100, width: corr.width, height: 100 };
        if (checkCircleAABBCollision(entity, topWall)) {
          this.resolveCircleAABBCollision(entity, topWall);
        }
        const bottomWall = { x: corr.x, y: corr.y + corr.height, width: corr.width, height: 100 };
        if (checkCircleAABBCollision(entity, bottomWall)) {
          this.resolveCircleAABBCollision(entity, bottomWall);
        }
      }
    }

    // 4. Collision avec les bords extérieurs de la salle
    let insideCorridor = false;
    for (const corr of this.corridors) {
      let marginX = 0;
      let marginY = 0;
      if (corr.direction === "N" || corr.direction === "S") {
        marginY = 20; // marge verticale pour permettre d'entrer dans le couloir
      } else {
        marginX = 20; // marge horizontale
      }
      if (entity.x >= corr.x - marginX && entity.x <= corr.x + corr.width + marginX &&
          entity.y >= corr.y - marginY && entity.y <= corr.y + corr.height + marginY) {
        insideCorridor = true;
        break;
      }
    }

    if (!insideCorridor) {
      const room = this.rooms.get(this.activeRoomId);
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
          // Salle carrée
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

  private resolveCircleAABBCollision(circle: { x: number; y: number; radius: number }, rect: AABB) {
    const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
    const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

    const dx = circle.x - closestX;
    const dy = circle.y - closestY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0) {
      circle.x = closestX + (dx / dist) * circle.radius;
      circle.y = closestY + (dy / dist) * circle.radius;
    } else {
      // Le centre est à l'intérieur : on le pousse vers le bord le plus proche
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

  private updatePlayersMovement(dt: number) {
    for (const p of this.players.values()) {
      if (p.isKO || p.client.isDead) continue;

      const inputDt = 0.01667; // 60Hz step matching client

      while (p.inputQueue.length > 0) {
        const input = p.inputQueue.shift()!;
        p.lastInputSeq = input.sequenceNumber;

        // 1. Décrémenter les timers de dash pour cet input step
        if (p.dashCooldown > 0) {
          p.dashCooldown -= inputDt;
          if (p.dashCooldown < 0) p.dashCooldown = 0;
        }

        const wasDashing = p.dashDuration > 0;
        if (p.dashDuration > 0) {
          p.dashDuration -= inputDt;
          if (p.dashDuration < 0) p.dashDuration = 0;
        }

        // Si le dash vient de se terminer, on remet la vitesse à 0
        if (wasDashing && p.dashDuration === 0) {
          p.client.vx = 0;
          p.client.vy = 0;
        }

        // 2. Traiter le déclenchement du dash
        if (input.keys.dash && p.dashCooldown <= 0 && p.dashDuration <= 0) {
          p.dashDuration = 0.25;
          p.dashCooldown = 1.5 - (p.client.getStat(Stat.COOLDOWN_RECOVERY) || 0);
          
          let dx = Math.cos(input.mouseAngle);
          let dy = Math.sin(input.mouseAngle);

          p.dashDirectionX = dx;
          p.dashDirectionY = dy;
        }

        // 3. Déclencher l'ultime
        if (input.keys.ult1) {
          this.castUltimate(p, "ARME1");
        }

        // 4. Calculer la vitesse pour cet input step
        if (p.dashDuration > 0) {
          const dashSpeed = p.client.getStat(Stat.MOVEMENT_SPEED) * 2.5;
          p.client.vx = p.dashDirectionX * dashSpeed;
          p.client.vy = p.dashDirectionY * dashSpeed;
        } else {
          let dx = 0;
          let dy = 0;
          if (input.moving) {
            dx = Math.cos(input.mouseAngle);
            dy = Math.sin(input.mouseAngle);
          }
          try {
            fs.appendFileSync("debug.log", `[Server Input] seq=${input.sequenceNumber} moving=${input.moving} dx=${dx} dy=${dy} mouseAngle=${input.mouseAngle}\n`);
          } catch(e) {}
          console.log(`[Server Input] seq=${input.sequenceNumber} moving=${input.moving} dx=${dx} dy=${dy} mouseAngle=${input.mouseAngle}`);

          const speed = p.client.getStat(Stat.MOVEMENT_SPEED);
          p.client.vx = dx * speed;
          p.client.vy = dy * speed;
        }

        // 5. Déplacer le joueur et résoudre les collisions pour cet input step
        if (p.dashDuration > 0) {
          const subSteps = 4;
          const subDt = inputDt / subSteps;
          for (let step = 0; step < subSteps; step++) {
            p.client.x += p.client.vx * subDt;
            p.client.y += p.client.vy * subDt;
            this.resolveCollisionsForEntity(p.client, true);
          }
        } else {
          p.client.x += p.client.vx * inputDt;
          p.client.y += p.client.vy * inputDt;
          this.resolveCollisionsForEntity(p.client, false);
        }
      }

      // Gérer la transition de salle
      this.checkRoomTransition(p);
    }
  }

  private updateMonstersIA(dt: number) {
    if (this.enemies.size === 0) return;

    for (const e of this.enemies.values()) {
      let closestPlayer: any = null;
      let minDist = Infinity;

      for (const p of this.players.values()) {
        if (p.isKO || p.client.isDead) continue;
        const dx = p.client.x - e.x;
        const dy = p.client.y - e.y;
        const d = dx * dx + dy * dy;
        if (d < minDist) {
          minDist = d;
          closestPlayer = p.client;
        }
      }

      if (closestPlayer) {
        e.onServerUpdate(dt, closestPlayer, this);
        e.x += e.vx * dt;
        e.y += e.vy * dt;

        // Résoudre collisions pour le monstre (les monstres ne dashent pas)
        this.resolveCollisionsForEntity(e, false);
      } else {
        e.vx = 0;
        e.vy = 0;
      }
    }
  }

  private resolveWorldCollisions() {
    for (const p of this.players.values()) {
      if (p.isKO || p.client.isDead) continue;
      const nearby = this.grid.getPotentialColliders(p.client);
      for (const other of nearby) {
        if (other instanceof Ennemi) {
          if (checkCircleCollision(p.client, other)) {
            const dx = p.client.x - other.x;
            const dy = p.client.y - other.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
              const overlap = (p.client.radius + other.radius) - dist;
              p.client.x += (dx / dist) * overlap * 0.5;
              p.client.y += (dy / dist) * overlap * 0.5;
              other.x -= (dx / dist) * overlap * 0.5;
              other.y -= (dy / dist) * overlap * 0.5;
            }
          }
        }
      }
    }
  }

  private checkRoomTransition(p: any) {
    // Vérifier si le joueur est entré dans une nouvelle salle
    for (const room of this.rooms.values()) {
      let isInside = false;
      if (room.shape === "CIRCLE") {
        const dx = p.client.x - room.x;
        const dy = p.client.y - room.y;
        isInside = dx * dx + dy * dy <= room.radius * room.radius;
      } else {
        isInside = p.client.x >= room.x - room.width / 2 &&
                   p.client.x <= room.x + room.width / 2 &&
                   p.client.y >= room.y - room.height / 2 &&
                   p.client.y <= room.y + room.height / 2;
      }

      if (isInside && room.id !== this.activeRoomId) {
        this.activeRoomId = room.id;

        // Nettoyer projectiles et ennemis de l'ancienne salle
        this.enemies.clear();
        this.projectiles = [];
        this.aoeZones = [];

        // Déclencher l'entrée de la salle
        const nextRoom = this.rooms.get(this.activeRoomId)!;
        if (!nextRoom.isCleared) {
          nextRoom.onEnter(this);
        }

        // Signaler le changement aux clients
        this.broadcastMessage(MsgType.S2C_ROOM_CHANGED, {
          activeRoomId: this.activeRoomId,
          roomName: nextRoom.name,
          roomType: nextRoom.type
        });

        this.broadcastSystemMessage(`Vous êtes entré dans : ${nextRoom.name}`);
        break;
      }
    }
  }

  private updateAOE(dt: number) {
    for (let i = this.aoeZones.length - 1; i >= 0; i--) {
      const aoe = this.aoeZones[i];
      aoe.duration -= dt;
      if (aoe.duration <= 0) {
        this.aoeZones.splice(i, 1);
        continue;
      }

      // Appliquer les dégâts / soins par seconde
      aoe.tickTimer = (aoe.tickTimer || 0) + dt;
      if (aoe.tickTimer >= (aoe.tickRate || 1.0)) {
        aoe.tickTimer = 0;

        // Dégâts
        if (aoe.damagePerTick) {
          for (const e of this.enemies.values()) {
            const dx = e.x - aoe.x;
            const dy = e.y - aoe.y;
            const d = dx * dx + dy * dy;
            if (d < aoe.radius * aoe.radius) {
              this.applyDamageToEnemy(e, aoe.damagePerTick);
            }
          }
        }
        // Soin
        if (aoe.healPerSecond) {
          for (const p of this.players.values()) {
            if (p.isKO || p.client.isDead) continue;
            const dx = p.client.x - aoe.x;
            const dy = p.client.y - aoe.y;
            const d = dx * dx + dy * dy;
            if (d < aoe.radius * aoe.radius) {
              p.client.heal(aoe.healPerSecond);
            }
          }
        }
      }
    }
  }

  private updatePlayerAttacks(dt: number) {
    for (const p of this.players.values()) {
      if (p.isKO || p.client.isDead) continue;

      // Gérer cooldown d'auto-attaque pour chaque arme équipée
      for (const slot of ["ARME1", "ARME2"]) {
        const item = p.client.equipment.get(slot);
        if (!item) continue;

        // Récupérer le type d'arme dynamique depuis gearset
        const weaponType = item.gearset || (slot === "ARME1" ? "SWORD" : "DAGGER");
        const wInstance = GameRegistry.createArme(weaponType);

        // Timer de recharge
        const timerKey = `${slot}_cd`;
        (p as any)[timerKey] = ((p as any)[timerKey] || 0) - dt;

        if ((p as any)[timerKey] <= 0) {
          // Trouver le monstre le plus proche à portée
          let closestEnemy: Ennemi | null = null;
          let minDist = wInstance.autoAttackNode.range;

          for (const e of this.enemies.values()) {
            const dx = e.x - p.client.x;
            const dy = e.y - p.client.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < minDist) {
              minDist = d;
              closestEnemy = e;
            }
          }

          if (closestEnemy) {
            (p as any)[timerKey] = wInstance.autoAttackNode.cooldown;
            wInstance.autoAttackNode.execute(this, p.client, closestEnemy);
          }
        }
      }
    }
  }

  private castUltimate(p: any, slot: string) {
    if (slot !== "ARME1") return; // L'ultime n'est lançable que par l'Arme 1
    const item = p.client.equipment.get(slot);
    if (!item) return;
    
    // Charger le type d'arme dynamique depuis gearset
    const weaponType = item.gearset || "SWORD";
    const wInstance = GameRegistry.createArme(weaponType);
    // Exécuter
    wInstance.ultimateNode.execute(this, p.client);
  }

  private updatePlayerAuras(dt: number) {
    for (const p of this.players.values()) {
      if (p.isKO || p.client.isDead) continue;

      const weapon2 = p.client.equipment.get("ARME2");
      if (weapon2 && weapon2.isEquipped) {
        const weaponType = weapon2.gearset || "DAGGER";
        if (weaponType === "MACE") {
          // Régénération passive de 5 PV/s pour la Masse en slot 2
          p.client.heal(5 * dt);
        }
      }
    }
  }

  // ==========================================
  // RESOLUTION DE COMBAT (STATS CALCULATOR / DAMAGE)
  // ==========================================
  public calculateWeaponDamage(player: SharedPlayer, weapon: any): number {
    const isPhysical = weapon.type !== WeaponType.MACE;
    if (isPhysical) {
      return 15 * (player.getStat(Stat.PHYSICAL_DAMAGE) || 1.0);
    } else {
      return 12 * (player.getStat(Stat.ELEMENTAL_DAMAGE) || 1.0);
    }
  }

  public spawnProjectile(proj: any) {
    // Déclenche l'affichage client et résout la hitbox côté serveur
    this.broadcastMessage(MsgType.S2C_SPAWN_PATTERN, proj);

    // Résolution analytique de l'impact
    setTimeout(() => {
      if (this.isEnded) return;
      
      // Trouver la cible la plus proche au bout de la course théorique
      let closestEnemy: Ennemi | null = null;
      let minDist = 40; // Tolérance d'impact en pixels

      // Target par angle ou coordonnées
      const targetX = proj.targetX || (proj.x + Math.cos(proj.angle || 0) * proj.range);
      const targetY = proj.targetY || (proj.y + Math.sin(proj.angle || 0) * proj.range);

      for (const e of this.enemies.values()) {
        const dx = e.x - targetX;
        const dy = e.y - targetY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < minDist) {
          minDist = d;
          closestEnemy = e;
        }
      }

      if (closestEnemy) {
        this.applyDamageToEnemy(closestEnemy, proj.damage);
      }
    }, 150); // Délai fictif de vol de projectile
  }

  public spawnMonsterProjectile(proj: any) {
    // Similaire aux tirs joueurs, mais cible les joueurs
    this.broadcastMessage(MsgType.S2C_SPAWN_PATTERN, { ...proj, isMonster: true });

    setTimeout(() => {
      if (this.isEnded) return;
      const targetX = proj.x + Math.cos(proj.angle) * 300;
      const targetY = proj.y + Math.sin(proj.angle) * 300;

      for (const p of this.players.values()) {
        if (p.isKO || p.client.isDead) continue;
        const dx = p.client.x - targetX;
        const dy = p.client.y - targetY;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < p.client.radius + proj.radius) {
          this.applyDamageToPlayer(p, proj.damage);
          break;
        }
      }
    }, 250);
  }

  public spawnAOE(aoe: any) {
    this.aoeZones.push({ ...aoe, tickTimer: 0 });
  }

  public spawnHealAura(aura: any) {
    this.aoeZones.push({ ...aura, tickTimer: 0 });
  }

  public broadcastBulletPattern(pattern: any) {
    this.broadcastMessage(MsgType.S2C_SPAWN_PATTERN, { ...pattern, isBossPattern: true });
    
    // Résolution analytique complexe simplifiée : le boss applique des dégâts
    // si le joueur se trouve dans le cercle en expansion au mauvais moment.
    let elapsed = 0;
    const interval = setInterval(() => {
      if (this.isEnded || elapsed >= pattern.duration) {
        clearInterval(interval);
        return;
      }
      elapsed += 0.3;

      const currentRadius = pattern.speed * elapsed;

      for (const p of this.players.values()) {
        if (p.isKO || p.client.isDead) continue;
        const dx = p.client.x - pattern.originX;
        const dy = p.client.y - pattern.originY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Si le joueur est à la frontière de l'onde expansive de projectiles
        if (Math.abs(dist - currentRadius) < 30) {
          // Jet d'esquive
          const ev = p.client.getStat(Stat.EVASION) || 0;
          if (Math.random() >= ev) {
            this.applyDamageToPlayer(p, pattern.damage);
          }
        }
      }
    }, 300);
  }

  // DÉGÂTS MONSTRES
  private applyDamageToEnemy(enemy: Ennemi, damage: number) {
    enemy.hp -= damage;
    if (enemy.hp <= 0 && !enemy.isDead) {
      enemy.isDead = true;
      this.enemies.delete(enemy.id);
      
      // Donner de l'XP à tous les joueurs
      for (const p of this.players.values()) {
        p.client.xp += enemy.expReward;
        this.checkPlayerLevelUp(p);
      }
    }
  }

  // DÉGÂTS JOUEURS
  private applyDamageToPlayer(p: any, damage: number) {
    if (p.isKO || p.client.isDead || p.dashDuration > 0) return; // Invulnérable pendant le dash

    // Application des stats de protection
    const armor = p.client.getStat(Stat.ARMOR) || 0;
    const reduction = armor / (armor + 100); // atténuation non linéaire
    const netDamage = Math.max(1, damage * (1 - reduction));

    p.client.hp = Math.max(0, p.client.hp - netDamage);

    if (p.client.hp <= 0) {
      this.triggerKO(p);
    }
  }

  public applyMeleeDamage(enemy: Ennemi, target: Entity, damage: number) {
    const player = Array.from(this.players.values()).find(p => p.client.id === target.id);
    if (player) {
      this.applyDamageToPlayer(player, damage);
    }
  }

  private triggerKO(p: any) {
    p.isKO = true;
    p.koDeaths++;
    p.koTimer = 10 + p.koDeaths * 5; // Durée de KO augmente de 5s à chaque mort
    p.client.vx = 0;
    p.client.vy = 0;

    this.broadcastSystemMessage(`${p.pseudo} est K.O. ! Relevez-le.`);

    // Vérifier condition de défaite (tous K.O.)
    const allKO = Array.from(this.players.values()).every(pl => pl.isKO);
    if (allKO) {
      this.triggerDefeat();
    }
  }

  private checkPlayerLevelUp(p: any) {
    const xpRequired = p.client.level * 100;
    if (p.client.xp >= xpRequired) {
      p.client.xp -= xpRequired;
      p.client.level++;
      // Full heal
      p.client.hp = p.client.getStat(Stat.MAX_HEALTH);
      p.client.maxHp = p.client.hp;
      this.broadcastSystemMessage(`${p.pseudo} est monté au niveau ${p.client.level} !`);
    }
  }

  // ==========================================
  // FIN DE RUN (VICTOIRE / DÉFAITE) & RECOMPENSES
  // ==========================================
  public triggerVictory() {
    this.endRun(true);
  }

  private triggerDefeat() {
    this.endRun(false);
  }

  private async endRun(victory: boolean) {
    if (this.isEnded) return;
    this.isEnded = true;
    if (this.intervalId) clearInterval(this.intervalId);

    const runDuration = (Date.now() - this.startTime) / 1000;
    console.log(`Fin de l'instance ${this.id}. Résultat: ${victory ? "Victoire" : "Défaite"}. Durée: ${runDuration}s`);

    const lootDropped: { [userId: string]: GeneratedItem[] } = {};

    // Calcul des récompenses et mise à jour de la DB pour chaque joueur
    for (const p of this.players.values()) {
      lootDropped[p.userId] = [];
      let xpEarned = p.client.xp;
      let materialsEarned = victory ? 35 : 10; // Plus de matériaux en victoire

      if (victory) {
        // Bonus de rapidité si fini en moins de 3 minutes (180s)
        if (runDuration < 180) {
          xpEarned += 100;
          materialsEarned += 15;
        }

        // Générer du loot (1 à 2 items)
        const lootCount = Math.random() > 0.5 ? 2 : 1;
        for (let i = 0; i < lootCount; i++) {
          const item = this.generateRandomLoot();
          lootDropped[p.userId].push(item);
          // Sauvegarder dans la DB
          await dbService.saveItem({
            characterId: p.characterId,
            slot: item.slot,
            rarity: item.rarity,
            gearset: item.gearset,
            statsJSON: item.statsJSON,
            isEquipped: false
          });
        }
      }

      // Enregistrer progression personnage
      const newXp = p.client.xp + xpEarned;
      const newLevel = p.client.level;
      const finalMaterials = p.client.materials + materialsEarned;

      await dbService.updateCharacter(p.characterId, {
        level: newLevel,
        xp: newXp,
        materials: finalMaterials
      });
    }

    // Leaderboard si victoire
    if (victory) {
      const names = Array.from(this.players.values()).map(p => p.pseudo).join(", ");
      await dbService.addLeaderboard(this.bossId, this.difficulty, this.players.size, runDuration, names);
    }

    // Diffuser le récapitulatif de fin de partie
    const recapPayload = {
      victory,
      duration: runDuration,
      loot: lootDropped
    };

    this.broadcastMessage(MsgType.S2C_RUN_RECAP, recapPayload);

    // Détruire l'instance après un court délai pour permettre au client de lire
    setTimeout(() => {
      // Rétablir la connexion des sockets vers le Hub Lobby
      for (const p of this.players.values()) {
        p.ws.removeAllListeners("message");
        p.ws.removeAllListeners("close");
        LobbyServer.handleConnection(p.ws);
      }
      GameManager.removeGameInstance(this.id);
    }, 5000);
  }

  private generateRandomLoot(): GeneratedItem {
    const slots = ["CASQUE", "TORSE", "JAMBES", "GANTS", "BAGUE", "COLLIER", "ARME1", "ARME2"];
    const slot = slots[Math.floor(Math.random() * slots.length)];
    
    // Choix de la rareté
    const rand = Math.random();
    const rarity = rand > 0.9 ? "PURPLE" : rand > 0.7 ? "BLUE" : rand > 0.4 ? "GREEN" : "WHITE";
    
    let gearset: string | undefined;
    if (slot === "ARME1" || slot === "ARME2") {
      const weaponTypes = ["SWORD", "AXE", "DAGGER", "MACE"];
      gearset = weaponTypes[Math.floor(Math.random() * weaponTypes.length)];
    } else {
      const sets = ["Vitesse Spectrale", "Gardien Géométrique"];
      gearset = Math.random() > 0.6 ? sets[Math.floor(Math.random() * sets.length)] : undefined;
    }

    // Générer les lignes de statistiques
    const stats: any = {};
    const linesCount = rarity === "PURPLE" ? 4 : rarity === "BLUE" ? 3 : rarity === "GREEN" ? 2 : 1;

    // Liste simplifiée pour le roll
    const statPool = [Stat.ARMOR, Stat.MAX_HEALTH, Stat.PHYSICAL_DAMAGE, Stat.MOVEMENT_SPEED, Stat.CRIT_CHANCE];

    for (let i = 0; i < linesCount; i++) {
      const stat = statPool[Math.floor(Math.random() * statPool.length)];
      const isPercent = stat === Stat.MOVEMENT_SPEED || stat === Stat.CRIT_CHANCE;
      stats[stat] = {
        value: isPercent ? 0.05 + Math.random() * 0.10 : 5 + Math.floor(Math.random() * 20),
        type: isPercent ? "PERCENT" : "FLAT"
      };
    }

    return {
      slot,
      rarity,
      gearset,
      statsJSON: JSON.stringify(stats)
    };
  }

  // ==========================================
  // EXPLORATION & ACTIONS DE FORGE / TALENTS
  // ==========================================
  public spawnEnemyInRoom(roomId: string, enemyType: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;
    const e = GameRegistry.createEnnemi(enemyType);
    e.id = "e_" + Math.random().toString(36).substring(2, 9);
    
    if (room.shape === "CIRCLE") {
      const angle = Math.random() * Math.PI * 2;
      const dist = Math.random() * (room.radius * 0.6);
      e.x = room.x + Math.cos(angle) * dist;
      e.y = room.y + Math.sin(angle) * dist;
    } else {
      const halfW = room.width / 2;
      const halfH = room.height / 2;
      e.x = room.x + (Math.random() - 0.5) * (halfW * 1.2);
      e.y = room.y + (Math.random() - 0.5) * (halfH * 1.2);
    }
    
    this.enemies.set(e.id, e);
  }

  public getEnemyCountInRoom(roomId: string): number {
    return this.enemies.size;
  }

  public unlockDoorsOfRoom(roomId: string) {
    const r = this.rooms.get(roomId)!;
    for (const dir in r.doors) {
      r.doors[dir].locked = false;
    }
    
    // Déverrouiller aussi les portes physiques associées aux couloirs de cette salle
    for (const door of this.doors) {
      const corr = this.corridors.find(c => c.id === door.corridorId);
      if (corr && (corr.fromRoomId === roomId || corr.toRoomId === roomId)) {
        door.locked = false;
      }
    }
  }

  public addKeyToGroup(keyIndex: number) {
    this.keysCollected++;
    this.broadcastSystemMessage(`Clé de boss récupérée (${this.keysCollected}/2) !`);
    if (this.keysCollected >= 2) {
      // Déverrouiller la salle du Boss
      const startRoom = this.rooms.get("room_start")!;
      startRoom.doors["W"].locked = false;
      
      // Déverrouiller la porte physique
      const bossDoor = this.doors.find(d => d.color === "boss");
      if (bossDoor) {
        bossDoor.locked = false;
      }
      this.broadcastSystemMessage("Le portail vers la salle du Boss final est déverrouillé !");
    }
  }

  public spawnLootChest(roomId: string, isElite: boolean) {
    // Drop de matériaux directs au sol
    for (const p of this.players.values()) {
      p.client.materials += isElite ? 15 : 5;
    }
    this.broadcastSystemMessage(`Coffre ouvert ! +${isElite ? 15 : 5} Matériaux récoltés pour l'équipe.`);
  }

  // ==========================================
  // RECONNEXION & INFRASTRUCTURE RÉSEAU
  // ==========================================
  public markPlayerDisconnected(userId: string) {
    const p = this.players.get(userId);
    if (p) {
      // Au lieu de détruire le personnage, on le marque KO
      p.isKO = true;
      this.broadcastSystemMessage(`${p.pseudo} s'est déconnecté. Son entité reste en jeu.`);
    }
  }

  public reconnectPlayer(userId: string, ws: WebSocket) {
    const p = this.players.get(userId);
    if (p) {
      p.ws = ws;
      p.isKO = false;
      p.inputQueue = [];
      this.broadcastSystemMessage(`${p.pseudo} s'est reconnecté à la run.`);
      
      // Renvoyer le paquet de départ pour le chargement
      ws.send(JSON.stringify({
        type: MsgType.S2C_RUN_START,
        payload: {
          gameId: this.id,
          seed: this.seed,
          bossId: this.bossId,
          difficulty: this.difficulty,
          activeRoomId: this.activeRoomId,
          players: Array.from(this.players.values()).map(pl => ({
            userId: pl.userId,
            pseudo: pl.pseudo,
            classShape: pl.client.classShape,
            hp: pl.client.hp,
            maxHp: pl.client.maxHp,
            level: pl.client.level,
            x: pl.client.x,
            y: pl.client.y
          }))
        }
      }));
    }
  }

  public handlePlayerInput(userId: string, input: PlayerInput) {
    const p = this.players.get(userId);
    if (p) {
      p.inputQueue.push(input);
    }
  }

  // LIAISON CRAFT DANS LE HUB (Routé depuis le WS Lobby)
  public async handleCraftAction(userId: string, payload: any, ws: WebSocket) {
    const { action, itemId, selectedCategory, itemIds } = payload;
    const character = await dbService.getCharacters(userId).then(list => list[0]); // Premier perso
    if (!character) return;

    if (action === "SALVAGE") {
      const items = character.items as any[];
      const itemToSalvage = items.find(it => it.id === itemId);
      if (itemToSalvage && !itemToSalvage.isEquipped) {
        // Démanteler donne 10 matériaux
        const matsAdded = 10;
        await dbService.deleteItem(itemId);
        await dbService.updateCharacter(character.id, {
          materials: character.materials + matsAdded
        });
        
        ws.send(JSON.stringify({
          type: MsgType.S2C_CHAT,
          payload: { sender: "Forge", channel: "Général", text: `Objet recyclé. +10 Matériaux obtenus.` }
        }));

        this.sendUpdatedCharacter(userId, ws);
      }
    } else if (action === "ADD_LINE") {
      // Ajout de ligne
      const items = character.items as any[];
      const item = items.find(it => it.id === itemId);
      if (item) {
        const stats = JSON.parse(item.statsJSON);
        const linesCount = Object.keys(stats).length;
        if (linesCount >= 4) {
          ws.send(JSON.stringify({ type: MsgType.S2C_CHAT, payload: { sender: "Forge", channel: "Général", text: `L'objet a déjà le maximum de 4 lignes !` } }));
          return;
        }

        const cost = (linesCount + 1) * 15; // Coût progressif
        if (character.materials < cost) {
          ws.send(JSON.stringify({ type: MsgType.S2C_CHAT, payload: { sender: "Forge", channel: "Général", text: `Matériaux insuffisants (${cost} requis).` } }));
          return;
        }

        // Ajouter une statistique
        const statPool = selectedCategory === "Protection" 
          ? [Stat.ARMOR, Stat.WILLPOWER, Stat.EVASION, Stat.PARRY] 
          : selectedCategory === "Attaque" 
          ? [Stat.PHYSICAL_DAMAGE, Stat.ELEMENTAL_DAMAGE, Stat.CRIT_CHANCE] 
          : [Stat.MAX_HEALTH, Stat.MOVEMENT_SPEED, Stat.HEALTH_REGEN];

        const rollStat = statPool[Math.floor(Math.random() * statPool.length)];
        const isPercent = rollStat === Stat.MOVEMENT_SPEED || rollStat === Stat.CRIT_CHANCE || rollStat === Stat.EVASION || rollStat === Stat.PARRY;

        stats[rollStat] = {
          value: isPercent ? 0.03 + Math.random() * 0.07 : 3 + Math.floor(Math.random() * 12),
          type: isPercent ? "PERCENT" : "FLAT"
        };

        // Sauvegarder
        item.statsJSON = JSON.stringify(stats);
        if (linesCount + 1 === 2) item.rarity = "GREEN";
        else if (linesCount + 1 === 3) item.rarity = "BLUE";
        else if (linesCount + 1 === 4) item.rarity = "PURPLE";

        await dbService.saveItem(item);
        await dbService.updateCharacter(character.id, {
          materials: character.materials - cost
        });

        this.sendUpdatedCharacter(userId, ws);
      }
    } else if (action === "FUSION") {
      // Combiner 3 items de même rareté
      if (!itemIds || itemIds.length !== 3) return;
      const items = character.items as any[];
      const combineList = items.filter(it => itemIds.includes(it.id));
      if (combineList.length !== 3) return;

      const rarity = combineList[0].rarity;
      const allSame = combineList.every(it => it.rarity === rarity && !it.isEquipped);
      if (!allSame) {
        ws.send(JSON.stringify({ type: MsgType.S2C_CHAT, payload: { sender: "Forge", channel: "Général", text: `Les objets doivent être de même rareté et non équipés.` } }));
        return;
      }

      // Prochaine rareté
      const nextRarity = rarity === "WHITE" ? "GREEN" : rarity === "GREEN" ? "BLUE" : rarity === "BLUE" ? "PURPLE" : null;
      if (!nextRarity) {
        ws.send(JSON.stringify({ type: MsgType.S2C_CHAT, payload: { sender: "Forge", channel: "Général", text: `Impossible de fusionner des objets épiques/uniques.` } }));
        return;
      }

      // Collecter toutes les lignes existantes pour héritage
      const inheritedLines: any[] = [];
      for (const it of combineList) {
        const stats = JSON.parse(it.statsJSON);
        for (const sKey in stats) {
          inheritedLines.push({ key: sKey, data: stats[sKey] });
        }
      }

      // Détruire les 3 objets
      for (const it of combineList) {
        await dbService.deleteItem(it.id);
      }

      // Créer le nouvel objet
      const slots = ["CASQUE", "TORSE", "JAMBES", "GANTS", "BAGUE", "COLLIER"];
      const newSlot = slots[Math.floor(Math.random() * slots.length)];
      const newStats: any = {};

      // Hériter d'au moins 1 ligne
      const inherited = inheritedLines[Math.floor(Math.random() * inheritedLines.length)];
      newStats[inherited.key] = inherited.data;

      // Compléter les stats selon la rareté
      const linesCount = nextRarity === "PURPLE" ? 4 : nextRarity === "BLUE" ? 3 : 2;
      const statPool = [Stat.ARMOR, Stat.MAX_HEALTH, Stat.PHYSICAL_DAMAGE, Stat.MOVEMENT_SPEED, Stat.CRIT_CHANCE];

      for (let i = 1; i < linesCount; i++) {
        const rollStat = statPool[Math.floor(Math.random() * statPool.length)];
        const isPercent = rollStat === Stat.MOVEMENT_SPEED || rollStat === Stat.CRIT_CHANCE;
        newStats[rollStat] = {
          value: isPercent ? 0.05 + Math.random() * 0.08 : 5 + Math.floor(Math.random() * 15),
          type: isPercent ? "PERCENT" : "FLAT"
        };
      }

      await dbService.saveItem({
        characterId: character.id,
        slot: newSlot,
        rarity: nextRarity,
        statsJSON: JSON.stringify(newStats),
        isEquipped: false
      });

      this.sendUpdatedCharacter(userId, ws);
    }
  }

  public async handleTalentAction(userId: string, payload: any, ws: WebSocket) {
    const { talentId } = payload;
    const character = await dbService.getCharacters(userId).then(list => list[0]);
    if (!character) return;

    // charger la classe et vérifier points dispos
    const dummyPlayer = new SharedPlayer();
    dummyPlayer.initClass(character.classShape as any);
    
    // Charger talents actuels
    const currentTalents = new Set<string>();
    // Simuler le stockage
    const updatedTalents = new Set(currentTalents);
    updatedTalents.add(talentId);

    // Mettre à jour (Pour le MVP on stocke la liste en JSON simple)
    // Enregistrement...
    this.sendUpdatedCharacter(userId, ws);
  }

  private async sendUpdatedCharacter(userId: string, ws: WebSocket) {
    const character = await dbService.getCharacters(userId).then(list => list[0]);
    ws.send(JSON.stringify({
      type: MsgType.S2C_CHARACTER_UPDATE,
      payload: { character }
    }));
  }

  // ASSISTANTS
  private broadcastMessage(type: MsgType, payload: any) {
    const message = JSON.stringify({ type, payload });
    for (const p of this.players.values()) {
      p.ws.send(message);
    }
  }

  private broadcastSystemMessage(text: string) {
    this.broadcastMessage(MsgType.S2C_CHAT, {
      sender: "Système",
      channel: "Général",
      text
    });
  }

  private broadcastSnapshot() {
    // Compacter le snapshot en JSON (ou binaire)
    const playersList = Array.from(this.players.values()).map(p => ({
      userId: p.userId,
      x: p.client.x,
      y: p.client.y,
      vx: p.client.vx,
      vy: p.client.vy,
      speed: p.client.getStat(Stat.MOVEMENT_SPEED),
      dashing: p.dashDuration > 0,
      hp: p.client.hp,
      maxHp: p.client.maxHp,
      isKO: p.isKO,
      lastInputSeq: p.lastInputSeq
    }));

    const enemiesList = Array.from(this.enemies.values()).map(e => ({
      id: e.id,
      name: e.name,
      x: e.x,
      y: e.y,
      hp: e.hp,
      maxHp: e.maxHp,
      radius: e.radius
    }));

    const doorsList = this.doors.map(d => ({
      id: d.id,
      locked: d.locked
    }));

    const snapshot = {
      players: playersList,
      enemies: enemiesList,
      keysCollected: this.keysCollected,
      activeRoomId: this.activeRoomId,
      doors: doorsList
    };

    this.broadcastMessage(MsgType.S2C_SNAPSHOT, snapshot);
  }
}
