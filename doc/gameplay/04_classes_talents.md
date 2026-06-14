# Fiche Gameplay 04 : Les Classes & Arbres de Talents

Ce document détaille le fonctionnement des classes du joueur (représentées par des formes géométriques), la structure de leur arbre de talents et la simplicité de codage pour en créer de nouvelles.

---

## 1. Concept de Classes (Formes Géométriques)

Dans *liteAndSlash*, la forme géométrique du personnage correspond à sa classe de départ. Elle détermine ses attributs fondamentaux et son orientation de build :

*   **Le Cercle (Spécialité Mobilité / Esquive / Projectiles rapides)** : 
    *   Affinité naturelle avec la vitesse de déplacement, l'esquive, et les dagues/arcs.
*   **Le Carré (Spécialité Protection / Tanking / Mêlée)** :
    *   Affinité naturelle avec la vie max, l'armure, la parade, et les masses/épées de mêlée.
*   **Le Triangle (Spécialité Dégâts / Zone / Magie)** :
    *   Affinité naturelle avec le mana max, les dégâts élémentaires, et les bâtons magiques/haches.

*Custo Visuelle* : Les joueurs pourront débloquer des glows (effets de lumière), des traînées de couleur ou des textures géométriques applicables à leur forme pour personnaliser leur personnage (sans altérer la hitbox de base).

---

## 2. L'Arbre de Talents de Classe

*   **Attribution des points** : À chaque montée de niveau du personnage (Level Up), il reçoit **1 point de talent**.
*   **Structure de l'Arbre** :
    *   Chaque classe dispose de son propre arbre de talents structuré en nœuds interconnectés.
    *   Pour débloquer un nœud, il faut avoir activé au moins un nœud parent direct et posséder un point libre.
*   **Types de Talents** :
    *   **Talents de Statistiques Passives** : Augmentation directe d'une statistique du joueur (ex: `+5% PV Max`, `+3% Vitesse de déplacement`).
    *   **Talents Modificateurs d'Armes** : Altération d'une mécanique liée à un type d'arme spécifique (ex: *"Lorsque vous équipez une Dague, vos coups critiques appliquent un effet de saignement"*, ou *"Vos attaques à la Hache frappent dans un angle 15% plus large"*).

---

## 3. Contrainte de Scripting (Contrainte 5)

La création d'une nouvelle classe et de ses talents associés doit être modulaire et rapide.

### Exemple de Spécification de Scripting (`Classe`)

```typescript
// Spécification d'une nouvelle classe de personnage
class GuerrierCarre extends Classe {
    onInit() {
        this.shape = "SQUARE";
        this.baseColor = 0x3498db; // Bleu
        
        // Définition des statistiques de base
        this.baseStats = {
            [Stat.MAX_HEALTH]: 150,
            [Stat.ARMOR]: 20,
            [Stat.MOVEMENT_SPEED]: 220,
            [Stat.PARRY_CHANCE]: 0.05
        };

        // Construction de l'arbre de talents
        this.talentTree = new TalentTree([
            new TalentNode({
                id: "square_stat_hp_1",
                name: "Robustesse",
                description: "+10% Points de Vie maximum",
                maxPoints: 3,
                modifiers: [{ stat: Stat.MAX_HEALTH, percent: 10 }]
            }),
            new TalentNode({
                id: "square_weapon_axe_bleed",
                name: "Tranchant Brutal",
                description: "Les Haches infligent Saignement (Affliction Physique) sur coup critique",
                maxPoints: 1,
                dependencies: ["square_stat_hp_1"],
                // Hook logique pour modifier le comportement de l'arme
                onWeaponCrit: (event, player) => {
                    if (event.weaponType === WeaponType.AXE) {
                        event.target.applyAffliction(AfflictionType.BLEED, player);
                    }
                }
            })
        ]);
    }
}
```
