import { Stat } from "./Stats";
export class StatCalculator {
    static calculate(player, stat) {
        if (!player.classDefinition) {
            return 0;
        }
        // 1. Valeur de base de la classe
        let base = player.classDefinition.baseStats[stat] || 0;
        // 2. Accumulation des ajouts
        let flatAdd = 0;
        let percentAdd = 0;
        // -- Équipements équipés
        for (const item of player.equipment.values()) {
            if (!item || !item.isEquipped)
                continue;
            const modifier = item.stats[stat];
            if (modifier) {
                if (modifier.type === "FLAT")
                    flatAdd += modifier.value;
                if (modifier.type === "PERCENT")
                    percentAdd += modifier.value;
            }
        }
        // -- Arbre de talents
        if (player.classDefinition.talentTree) {
            for (const node of player.classDefinition.talentTree.nodes) {
                if (player.unlockedTalents.has(node.id)) {
                    const modifier = node.modifiers[stat];
                    if (modifier) {
                        if (modifier.type === "FLAT")
                            flatAdd += modifier.value;
                        if (modifier.type === "PERCENT")
                            percentAdd += modifier.value;
                    }
                }
            }
        }
        // -- Calcul final de base
        let finalValue = (base + flatAdd) * (1 + percentAdd);
        // 3. Modificateurs uniques / Ensembles
        finalValue = player.applyUniqueModifiers(stat, finalValue);
        // -- Modificateurs d'arme passive en slot 2
        const weapon2 = player.equipment.get("ARME2");
        if (weapon2 && weapon2.isEquipped) {
            const weaponType = weapon2.gearset || "DAGGER";
            if (weaponType === "SWORD") {
                // Epée en slot 2 : +15% Vitesse de déplacement
                if (stat === Stat.MOVEMENT_SPEED) {
                    finalValue *= 1.15;
                }
            }
            else if (weaponType === "AXE") {
                // Hache en slot 2 : +15% Dégâts physiques
                if (stat === Stat.PHYSICAL_DAMAGE) {
                    finalValue *= 1.15;
                }
            }
            else if (weaponType === "DAGGER") {
                // Dague en slot 2 : +10% de Chance de Critique et +15% Cooldown Recovery
                if (stat === Stat.CRIT_CHANCE) {
                    finalValue += 0.10;
                }
                if (stat === Stat.COOLDOWN_RECOVERY) {
                    finalValue += 0.15;
                }
            }
            else if (weaponType === "MACE") {
                // Masse en slot 2 : +15 Bonus au Soin
                if (stat === Stat.HEALING_BONUS) {
                    finalValue += 15;
                }
            }
        }
        return finalValue;
    }
}
