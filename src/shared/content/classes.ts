import { Classe, TalentNode, TalentTree } from "../core/BaseClasses";
import { Stat } from "../core/Stats";
import { GameRegistry } from "../core/GameRegistry";

// ==========================================
// 1. CLASSE CERCLE (VITESSE / ESQUIVE)
// ==========================================
export class ClasseCercle extends Classe {
  onInit() {
    this.shape = "CIRCLE";
    this.baseColor = 0xe74c3c; // Rouge
    this.baseStats = {
      [Stat.MAX_HEALTH]: 100,
      [Stat.MAX_MANA]: 80,
      [Stat.MOVEMENT_SPEED]: 250, // Rapide
      [Stat.EVASION]: 0.15, // 15% esquive
      [Stat.ARMOR]: 5,
      [Stat.CRIT_CHANCE]: 0.10, // 10% critique
      [Stat.HIT_CHANCE]: 1.00
    };

    // Arbre de talents
    this.talentTree = new TalentTree([
      new TalentNode({
        id: "cercle_speed",
        name: "Vitesse Fulgurante",
        description: "+8% Vitesse de Déplacement par point",
        maxPoints: 5,
        modifiers: { [Stat.MOVEMENT_SPEED]: { value: 0.08, type: "PERCENT" } }
      }),
      new TalentNode({
        id: "cercle_evasion",
        name: "Esprit Agile",
        description: "+3% Chance d'Esquive",
        maxPoints: 5,
        dependencies: ["cercle_speed"],
        modifiers: { [Stat.EVASION]: { value: 0.03, type: "FLAT" } }
      }),
      new TalentNode({
        id: "cercle_crit",
        name: "Précision Chirurgicale",
        description: "+5% Dégâts de Coup Critique",
        maxPoints: 5,
        modifiers: { [Stat.CRIT_DAMAGE]: { value: 0.05, type: "PERCENT" } }
      })
    ]);
  }
}

// ==========================================
// 2. CLASSE CARRÉ (TANK / PROTECTION)
// ==========================================
export class ClasseCarre extends Classe {
  onInit() {
    this.shape = "SQUARE";
    this.baseColor = 0x3498db; // Bleu
    this.baseStats = {
      [Stat.MAX_HEALTH]: 160, // Énorme vie
      [Stat.MAX_MANA]: 50,
      [Stat.MOVEMENT_SPEED]: 190, // Lent
      [Stat.ARMOR]: 25, // Armure innée
      [Stat.PARRY]: 0.10, // 10% parade
      [Stat.HEALTH_REGEN]: 2.0, // Régén passive
      [Stat.HIT_CHANCE]: 0.95
    };

    this.talentTree = new TalentTree([
      new TalentNode({
        id: "carre_health",
        name: "Forteresse de Chair",
        description: "+10% Points de Vie Max",
        maxPoints: 5,
        modifiers: { [Stat.MAX_HEALTH]: { value: 0.10, type: "PERCENT" } }
      }),
      new TalentNode({
        id: "carre_armor",
        name: "Armure Plaqué",
        description: "+10 Armure brute",
        maxPoints: 5,
        dependencies: ["carre_health"],
        modifiers: { [Stat.ARMOR]: { value: 10, type: "FLAT" } }
      }),
      new TalentNode({
        id: "carre_parry",
        name: "Garde de Fer",
        description: "+3% Chance de Parade",
        maxPoints: 5,
        modifiers: { [Stat.PARRY]: { value: 0.03, type: "FLAT" } }
      })
    ]);
  }
}

// ==========================================
// 3. CLASSE TRIANGLE (DÉGÂTS / MAGIE)
// ==========================================
export class ClasseTriangle extends Classe {
  onInit() {
    this.shape = "TRIANGLE";
    this.baseColor = 0xf1c40f; // Jaune
    this.baseStats = {
      [Stat.MAX_HEALTH]: 90,
      [Stat.MAX_MANA]: 120, // Énorme mana
      [Stat.MOVEMENT_SPEED]: 210,
      [Stat.ARMOR]: 8,
      [Stat.PHYSICAL_DAMAGE]: 1.0,
      [Stat.ELEMENTAL_DAMAGE]: 1.15, // Dégâts magiques
      [Stat.CRIT_CHANCE]: 0.05,
      [Stat.HIT_CHANCE]: 1.00
    };

    this.talentTree = new TalentTree([
      new TalentNode({
        id: "triangle_mana",
        name: "Esprit Surchargé",
        description: "+12% Mana Max par point",
        maxPoints: 5,
        modifiers: { [Stat.MAX_MANA]: { value: 0.12, type: "PERCENT" } }
      }),
      new TalentNode({
        id: "triangle_damage",
        name: "Amplification Élémentaire",
        description: "+8% Dégâts Élémentaires",
        maxPoints: 5,
        dependencies: ["triangle_mana"],
        modifiers: { [Stat.ELEMENTAL_DAMAGE]: { value: 0.08, type: "PERCENT" } }
      }),
      new TalentNode({
        id: "triangle_cooldown",
        name: "Flux Temporel",
        description: "+6% Vitesse de Récupération des sorts",
        maxPoints: 5,
        modifiers: { [Stat.COOLDOWN_RECOVERY]: { value: 0.06, type: "PERCENT" } }
      })
    ]);
  }
}

// Enregistrement global
GameRegistry.registerClasse("CIRCLE", ClasseCercle);
GameRegistry.registerClasse("SQUARE", ClasseCarre);
GameRegistry.registerClasse("TRIANGLE", ClasseTriangle);
