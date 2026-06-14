# Fiche Technique 04 : Calculateur de Statistiques & Moteur de Combat

Ce document spécifie l'ordre de calcul des statistiques à la volée, le moteur d'affixes d'équipements et les formules de résolution des dégâts et des coups critiques.

---

## 1. Ordre de Calcul des Statistiques (Stat Engine)

Le calcul des statistiques du personnage s'exécute côté serveur (autoritaire) et côté client (pour affichage de l'interface utilisateur). Pour éviter les problèmes d'arrondi et garantir la cohérence, toutes les statistiques brutes du joueur sont recalculées à chaque changement d'équipement ou montée de niveau selon un ordre strict :

$$\text{StatFinale} = (\text{ValeurBase} + \sum \text{AjoutsPlats}) \times (1 + \sum \text{MultiplicateursPourcent}) \times \text{ModificateursUniques}$$

### L'algorithme en TypeScript (Shared)
```typescript
// src/shared/core/StatCalculator.ts

import { Stat } from "./Stats";
import { Player } from "../entities/Player";

export class StatCalculator {
  public static calculate(player: Player, stat: Stat): number {
    // 1. Valeur de base (liée à la classe/forme géométrique)
    let base = player.classDefinition.baseStats[stat] || 0;

    // 2. Accumulation des ajouts plats (Flat additions)
    let flatAdd = 0;
    // 3. Accumulation des multiplicateurs (Percent additions)
    let percentAdd = 0;

    // -- Parcourir l'équipement équipé (8 slots)
    for (const item of player.equipment.values()) {
      if (!item) continue;
      const bonus = item.stats[stat];
      if (bonus) {
        if (bonus.type === "FLAT") flatAdd += bonus.value;
        if (bonus.type === "PERCENT") percentAdd += bonus.value; // ex: 0.10 pour +10%
      }
    }

    // -- Parcourir l'arbre de talents actif
    for (const talentNode of player.unlockedTalents) {
      const bonus = talentNode.modifiers[stat];
      if (bonus) {
        if (bonus.type === "FLAT") flatAdd += bonus.value;
        if (bonus.type === "PERCENT") percentAdd += bonus.value;
      }
    }

    // -- Calcul intermédiaire
    let finalValue = (base + flatAdd) * (1 + percentAdd);

    // 4. Application des modificateurs uniques (Orange uniques et sets 4/6 pièces)
    finalValue = player.applyUniqueModifiers(stat, finalValue);

    return finalValue;
  }
}
```

---

## 2. Formules du Moteur de Combat

Lorsqu'un projectile ou une attaque touche une cible, le serveur applique les formules suivantes pour déterminer l'issue du coup :

### A. Validation de la Touche (Hit vs Evasion)
*   **Chance de Toucher nette** :
    $$\text{ProbabiliteTouche} = \text{ChanceDeToucher}_{\text{Attaquant}} - \text{Esquive}_{\text{Defenseur}}$$
    *   Si un jet aléatoire $[0, 100[$ est supérieur ou égal à $\text{ProbabiliteTouche} \times 100$ : **Coup Esquivé** (aucun dégât).
*   **Résolution de la Parade** :
    Si la touche est validée, le serveur teste la chance de Parade du défenseur :
    *   Si le jet de parade réussit : **Coup Paré**. Les dégâts finaux sont réduits de **75%** et l'effet de recul (knockback) est annulé.

### B. Résolution des Dégâts Physiques & Élémentaires
Les dégâts d'une arme peuvent comporter une composante Physique et/ou Élémentaire.

#### 1. Dégâts Physiques Net :
*   **Pénétration d'Armure** :
    $$\text{ArmureEffective} = \text{Armure}_{\text{Defenseur}} \times (1 - \text{PenetrationPhysique}_{\text{Attaquant}})$$
*   **Atténuation par l'Armure** :
    $$\text{ReductionPhysique} = \frac{\text{ArmureEffective}}{\text{ArmureEffective} + 100}$$
*   **Dégâts Finaux** :
    $$\text{DegatsPhysiquesNet} = \text{DegatsPhysiquesBruts} \times (1 - \text{ReductionPhysique})$$

#### 2. Dégâts Élémentaires Net :
*   **Pénétration de Volonté** :
    $$\text{VolonteEffective} = \text{Volonte}_{\text{Defenseur}} \times (1 - \text{PenetrationElementaire}_{\text{Attaquant}})$$
*   **Atténuation par la Volonté** :
    $$\text{ReductionElementaire} = \frac{\text{VolonteEffective}}{\text{VolonteEffective} + 100}$$
*   **Dégâts Finaux** :
    $$\text{DegatsElementairesNet} = \text{DegatsElementairesBruts} \times (1 - \text{ReductionElementaire})$$

### C. Calcul du Coup Critique
*   Si un jet aléatoire $[0, 100[$ est inférieur à la $\text{ChanceDeCritique}_{\text{Attaquant}} \times 100$ :
    $$\text{DegatsFinaux} = (\text{DegatsPhysiquesNet} + \text{DegatsElementairesNet}) \times (1.5 + \text{DegatsDeCritique}_{\text{Attaquant}})$$
*   Le multiplicateur de base d'un coup critique est fixé à **1.5** ($150\%$).

---

## 3. Application des Afflictions (DoT - Damage over Time)

Si l'attaque applique une affliction (Poison, Saignement, Brûlure) :
*   **Durée de l'affliction** : Réduite proportionnellement par la *Résistance Physique* (pour Poison/Saignement) ou la *Résistance Élémentaire* (pour Brûlure) du défenseur.
*   **Dégâts par Tick** : Les dégâts se déclenchent toutes les $1$ seconde. Le montant des dégâts de tick dépend des statistiques `PHYSICAL_AFFLICTION` (physique) et `ELEMENTAL_AFFLICTION` (élémentaire) de l'attaquant au moment de l'application.
