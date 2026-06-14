import { Salle, RoomType } from "../core/BaseClasses";
import { GameRegistry } from "../core/GameRegistry";

// ==========================================
// 1. SALLE DE DÉPART (START)
// ==========================================
export class SalleDepart extends Salle {
  onInit() {
    this.type = "START";
    this.name = "Campement Sécurisé";
    this.isCleared = true; // Pas de combat
    this.shape = "SQUARE";
    this.width = 800;
    this.height = 800;
    this.obstacles = [
      { id: "start_p1", shape: "SQUARE", x: -150, y: -150, width: 50, height: 50 },
      { id: "start_p2", shape: "SQUARE", x: 150, y: -150, width: 50, height: 50 },
      { id: "start_p3", shape: "SQUARE", x: -150, y: 150, width: 50, height: 50 },
      { id: "start_p4", shape: "SQUARE", x: 150, y: 150, width: 50, height: 50 }
    ];
  }

  onEnter(server: any) {
    // Rien à faire
  }

  onTick(dt: number, server: any) {
    // Rien
  }

  onClear(server: any) {
    // Déjà clean
  }
}

// ==========================================
// 2. SALLE DE COMBAT ORDINAIRE (MOB)
// ==========================================
export class SalleCombat extends Salle {
  private wave: number = 0;
  private maxWaves: number = 2;
  private spawnedThisWave: boolean = false;

  onInit() {
    this.type = "MOB";
    this.name = "Couloir Envahi";
    this.isCleared = false;
    this.shape = "SQUARE";
    this.width = 1000;
    this.height = 1000;
    this.obstacles = [
      { id: "mob_center", shape: "CIRCLE", x: 0, y: 0, radius: 70 },
      { id: "mob_wall_left", shape: "SQUARE", x: -250, y: 0, width: 40, height: 160 },
      { id: "mob_wall_right", shape: "SQUARE", x: 250, y: 0, width: 40, height: 160 }
    ];
  }

  onEnter(server: any) {
    this.wave = 1;
    this.spawnedThisWave = false;
  }

  onTick(dt: number, server: any) {
    if (this.isCleared) return;

    if (!this.spawnedThisWave) {
      this.spawnedThisWave = true;
      // Spawn des zombies ordinaires et rapides selon la vague
      const zombieCount = 3 + this.wave * 2;
      const speedyCount = 1 + this.wave;
      
      for (let i = 0; i < zombieCount; i++) {
        server.spawnEnemyInRoom(this.id, "zombie");
      }
      for (let i = 0; i < speedyCount; i++) {
        server.spawnEnemyInRoom(this.id, "speedy");
      }
    }

    // Si tous les monstres de la salle sont morts
    if (server.getEnemyCountInRoom(this.id) === 0) {
      if (this.wave < this.maxWaves) {
        this.wave++;
        this.spawnedThisWave = false; // Vague suivante
      } else {
        this.isCleared = true;
        this.onClear(server);
      }
    }
  }

  onClear(server: any) {
    server.unlockDoorsOfRoom(this.id);
    server.spawnLootChest(this.id, false); // Coffre standard
  }
}

// ==========================================
// 3. SALLE DU PREMIER DEMI-BOSS (CLÉ ROUGE)
// ==========================================
export class SalleDemiBossRouge extends Salle {
  onInit() {
    this.type = "DEMI_BOSS";
    this.name = "Sanctuaire du Gardien Rouge";
    this.isCleared = false;
    this.shape = "CIRCLE";
    this.radius = 450;
    this.obstacles = [
      { id: "red_obs_left", shape: "CIRCLE", x: -200, y: 0, radius: 50 },
      { id: "red_obs_right", shape: "CIRCLE", x: 200, y: 0, radius: 50 }
    ];
  }

  onEnter(server: any) {
    server.spawnEnemyInRoom(this.id, "miniboss_red");
  }

  onTick(dt: number, server: any) {
    if (this.isCleared) return;

    if (server.getEnemyCountInRoom(this.id) === 0) {
      this.isCleared = true;
      this.onClear(server);
    }
  }

  onClear(server: any) {
    server.addKeyToGroup(1); // Clé Rouge
    server.unlockDoorsOfRoom(this.id);
    server.spawnLootChest(this.id, true); // Coffre de Demi-Boss
  }
}

// ==========================================
// 4. SALLE DU SECOND DEMI-BOSS (CLÉ BLEUE)
// ==========================================
export class SalleDemiBossBleu extends Salle {
  onInit() {
    this.type = "DEMI_BOSS";
    this.name = "Sanctuaire du Gardien Bleu";
    this.isCleared = false;
    this.shape = "CIRCLE";
    this.radius = 450;
    this.obstacles = [
      { id: "blue_obs_top", shape: "SQUARE", x: 0, y: -200, width: 140, height: 40 },
      { id: "blue_obs_bottom", shape: "SQUARE", x: 0, y: 200, width: 140, height: 40 }
    ];
  }

  onEnter(server: any) {
    server.spawnEnemyInRoom(this.id, "miniboss_blue");
  }

  onTick(dt: number, server: any) {
    if (this.isCleared) return;

    if (server.getEnemyCountInRoom(this.id) === 0) {
      this.isCleared = true;
      this.onClear(server);
    }
  }

  onClear(server: any) {
    server.addKeyToGroup(2); // Clé Bleue
    server.unlockDoorsOfRoom(this.id);
    server.spawnLootChest(this.id, true);
  }
}

// ==========================================
// 5. SALLE DU BOSS FINAL (BOSS)
// ==========================================
export class SalleBoss extends Salle {
  onInit() {
    this.type = "BOSS";
    this.name = "Noyau de l'Hyper-Octogone";
    this.isCleared = false;
    this.shape = "CIRCLE";
    this.radius = 550;
    this.obstacles = [
      { id: "boss_obs_1", shape: "CIRCLE", x: 0, y: -180, radius: 45 },
      { id: "boss_obs_2", shape: "CIRCLE", x: -160, y: 120, radius: 45 },
      { id: "boss_obs_3", shape: "CIRCLE", x: 160, y: 120, radius: 45 }
    ];
  }

  onEnter(server: any) {
    server.spawnEnemyInRoom(this.id, "boss");
  }

  onTick(dt: number, server: any) {
    if (this.isCleared) return;

    if (server.getEnemyCountInRoom(this.id) === 0) {
      this.isCleared = true;
      this.onClear(server);
    }
  }

  onClear(server: any) {
    // Victoire totale !
    server.triggerVictory();
  }
}

// Enregistrements
GameRegistry.registerSalle("START", SalleDepart);
GameRegistry.registerSalle("MOB", SalleCombat);
GameRegistry.registerSalle("DEMI_BOSS_RED", SalleDemiBossRouge);
GameRegistry.registerSalle("DEMI_BOSS_BLUE", SalleDemiBossBleu);
GameRegistry.registerSalle("BOSS", SalleBoss);
