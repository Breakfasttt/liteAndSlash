import { Entity, Classe, Item } from "./BaseClasses";
import { Stat } from "./Stats";
import { GameRegistry } from "./GameRegistry";

export class SharedPlayer extends Entity {
  public userId: string = "";
  public name: string = "";
  public classShape: "CIRCLE" | "SQUARE" | "TRIANGLE" = "CIRCLE";
  public classDefinition!: Classe;
  public level: number = 1;
  public xp: number = 0;
  
  public materials: number = 0;
  public unlockedTalents: Set<string> = new Set();
  public equipment: Map<string, Item> = new Map(); // slot -> Item

  // Configurations des arbres de compétences d'armes par [Slot][WeaponType][NodeId] = points
  public weaponSkillTrees: {
    [slot: string]: {
      [weaponType: string]: { [nodeId: string]: number }
    }
  } = {
    ARME1: {},
    ARME2: {}
  };

  public initClass(shape: "CIRCLE" | "SQUARE" | "TRIANGLE") {
    this.classShape = shape;
    this.classDefinition = GameRegistry.createClasse(shape);
    this.hp = this.classDefinition.baseStats[Stat.MAX_HEALTH] || 100;
    this.maxHp = this.hp;
  }

  public heal(amount: number) {
    if (this.isDead) return;
    this.hp = Math.min(this.maxHp, this.hp + amount);
  }

  // Récupère la statistique dynamique recalculée
  public getStat(stat: Stat): number {
    // On appelle le calculator de statistiques statique
    return StatCalculator.calculate(this, stat);
  }

  // Applique les bonus d'ensembles uniques (4 et 6 pièces)
  public applyUniqueModifiers(stat: Stat, value: number): number {
    const setCounts = new Map<string, number>();
    for (const item of this.equipment.values()) {
      if (item && item.gearset) {
        setCounts.set(item.gearset, (setCounts.get(item.gearset) || 0) + 1);
      }
    }

    let modifiedValue = value;
    for (const [setName, count] of setCounts.entries()) {
      // Bonus 4 pièces : +15% Vitesse de déplacement pour Set Agile, ou +20% Armure pour Set Gardien
      if (count >= 4) {
        if (stat === Stat.MOVEMENT_SPEED && setName === "Vitesse Spectrale") {
          modifiedValue *= 1.15;
        }
        if (stat === Stat.ARMOR && setName === "Gardien Géométrique") {
          modifiedValue *= 1.20;
        }
      }
      // Bonus 6 pièces
      if (count >= 6) {
        if (stat === Stat.PHYSICAL_DAMAGE && setName === "Gardien Géométrique") {
          modifiedValue *= 1.10; // +10% dégâts
        }
      }
    }
    return modifiedValue;
  }
}

// Pour éviter la dépendance circulaire lors du chargement, on importe StatCalculator à la toute fin ou dynamiquement
import { StatCalculator } from "./StatCalculator";
