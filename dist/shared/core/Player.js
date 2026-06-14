import { Entity } from "./BaseClasses";
import { Stat } from "./Stats";
import { GameRegistry } from "./GameRegistry";
export class SharedPlayer extends Entity {
    userId = "";
    name = "";
    classShape = "CIRCLE";
    classDefinition;
    level = 1;
    xp = 0;
    materials = 0;
    unlockedTalents = new Set();
    equipment = new Map(); // slot -> Item
    // Configurations des arbres de compétences d'armes par [Slot][WeaponType][NodeId] = points
    weaponSkillTrees = {
        ARME1: {},
        ARME2: {}
    };
    initClass(shape) {
        this.classShape = shape;
        this.classDefinition = GameRegistry.createClasse(shape);
        this.hp = this.classDefinition.baseStats[Stat.MAX_HEALTH] || 100;
        this.maxHp = this.hp;
    }
    heal(amount) {
        if (this.isDead)
            return;
        this.hp = Math.min(this.maxHp, this.hp + amount);
    }
    // Récupère la statistique dynamique recalculée
    getStat(stat) {
        // On appelle le calculator de statistiques statique
        return StatCalculator.calculate(this, stat);
    }
    // Applique les bonus d'ensembles uniques (4 et 6 pièces)
    applyUniqueModifiers(stat, value) {
        const setCounts = new Map();
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
