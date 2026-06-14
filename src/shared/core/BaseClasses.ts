import { Stat, StatsMap, BaseStatsMap } from "./Stats";

// ==========================================
// 1. ENTITÉ DE BASE (PHYSIC & HEALTH)
// ==========================================
export class Entity {
  public id: string = "";
  public x: number = 0;
  public y: number = 0;
  public vx: number = 0;
  public vy: number = 0;
  public radius: number = 16;
  
  public hp: number = 100;
  public maxHp: number = 100;
  public isDead: boolean = false;

  // Permet de lire n'importe quelle statistique finale après application du calculator
  public getStat(stat: Stat): number {
    return 0; // Surchargé par Player / Mob
  }
}

// ==========================================
// 2. CLASSES & ARBRES DE TALENTS
// ==========================================
export interface TalentNodeConfig {
  id: string;
  name: string;
  description: string;
  maxPoints: number;
  modifiers: StatsMap;
  dependencies?: string[];
  onWeaponCrit?: (event: any, player: any) => void;
}

export class TalentNode {
  public id: string;
  public name: string;
  public description: string;
  public maxPoints: number;
  public currentPoints: number = 0;
  public modifiers: StatsMap;
  public dependencies: string[];
  public onWeaponCrit?: (event: any, player: any) => void;

  constructor(config: TalentNodeConfig) {
    this.id = config.id;
    this.name = config.name;
    this.description = config.description;
    this.maxPoints = config.maxPoints;
    this.modifiers = config.modifiers;
    this.dependencies = config.dependencies || [];
    this.onWeaponCrit = config.onWeaponCrit;
  }
}

export class TalentTree {
  public nodes: TalentNode[];

  constructor(nodes: TalentNode[]) {
    this.nodes = nodes;
  }

  public getNode(id: string): TalentNode | undefined {
    return this.nodes.find(n => n.id === id);
  }
}

export abstract class Classe {
  public shape: "CIRCLE" | "SQUARE" | "TRIANGLE" = "CIRCLE";
  public baseColor: number = 0xffffff;
  public baseStats: BaseStatsMap = {};
  public talentTree: TalentTree = new TalentTree([]);

  public abstract onInit(): void;
}

// ==========================================
// 3. SALLES DE LA MAP PROCÉDURALE
// ==========================================
export type RoomType = "START" | "MOB" | "EVENT" | "DEMI_BOSS" | "BOSS";

export interface Obstacle {
  id: string;
  shape: "CIRCLE" | "SQUARE";
  x: number; // Coordonnées absolues
  y: number;
  width?: number; // Pour SQUARE
  height?: number; // Pour SQUARE
  radius?: number; // Pour CIRCLE
}

export abstract class Salle {
  public id: string = "";
  public type: RoomType = "MOB";
  public name: string = "";
  public isCleared: boolean = false;
  
  // Rendu et géométrie
  public shape: "CIRCLE" | "SQUARE" = "SQUARE";
  public x: number = 0; // Coordonnées absolues dans le monde
  public y: number = 0;
  public width: number = 800; // Pour SQUARE
  public height: number = 800; // Pour SQUARE
  public radius: number = 400; // Pour CIRCLE
  public obstacles: Obstacle[] = [];

  // Portes d'accès aux salles adjacentes (Nord, Sud, Est, Ouest)
  public doors: { [dir: string]: { targetRoomId: string; locked: boolean } } = {};

  // Hooks scriptables
  public abstract onInit(): void;
  public abstract onEnter(server: any): void;
  public abstract onTick(dt: number, server: any): void;
  public abstract onClear(server: any): void;
}

// ==========================================
// 4. ARMES ET COMPÉTENCES D'ARMES
// ==========================================
export enum WeaponType {
  SWORD = "SWORD",
  AXE = "AXE",
  DAGGER = "DAGGER",
  MACE = "MACE"
}

export interface AttackNode {
  cooldown: number; // secondes
  range: number; // pixels
  execute: (server: any, player: any, target: Entity) => void;
}

export interface UltimateNode {
  manaCost: number;
  cooldown: number;
  execute: (server: any, player: any) => void;
}

export abstract class Arme {
  public type: WeaponType = WeaponType.SWORD;
  public autoAttackNode!: AttackNode;
  public ultimateNode!: UltimateNode;

  public abstract onInit(): void;
}

// ==========================================
// 5. ENEMIS IA
// ==========================================
export abstract class Ennemi extends Entity {
  public name: string = "";
  public stats: Map<Stat, number> = new Map();
  public expReward: number = 10;
  
  public abstract onInit(): void;
  public abstract onServerUpdate(dt: number, target: Entity, server: any): void;

  public getStat(stat: Stat): number {
    return this.stats.get(stat) || 0;
  }
}

// ==========================================
// 6. ITEMS & EQUIPEMENT
// ==========================================
export type ItemRarity = "WHITE" | "GREEN" | "BLUE" | "PURPLE" | "UNIQUE";

export interface Item {
  id: string;
  slot: string; // CASQUE, TORSE, JAMBES, GANTS, BAGUE, COLLIER, ARME1, ARME2
  rarity: ItemRarity;
  gearset?: string;
  stats: StatsMap;
  isEquipped: boolean;
}
