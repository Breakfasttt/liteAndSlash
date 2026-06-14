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
        return finalValue;
    }
}
