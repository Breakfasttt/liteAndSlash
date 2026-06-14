# Fiche Gameplay 07 : Les Armes & Compétences d'Armes

Ce document décrit le système de double arme, l'affectation et la persistance des arbres de compétences d'armes par emplacement, et le fonctionnement des nœuds de compétences passifs et actifs.

---

## 1. Le Double Équipement (Dual Wielding)

Le joueur possède deux emplacements d'armes actifs : **Arme 1** et **Arme 2**.
*   **Flexibilité** : Il est possible d'équiper deux armes de types différents (ex: Hache + Dague) ou deux armes identiques (ex: Dague + Dague).
*   **Comportement en combat** : 
    *   L'arme à l'emplacement 1 et l'arme à l'emplacement 2 attaquent de manière indépendante en fonction de leur propre cadence de tir automatique (Auto-Attack).
    *   Les compétences actives (Ultimes) des deux armes équipées sont disponibles pour le joueur.

---

## 2. Persistance des Arbres de Compétences par Emplacement

La configuration des arbres de compétences est liée de manière unique au **Type d'Arme** ET à l'**Emplacement (Slot 1 ou Slot 2)**. Elle n'est pas liée à l'item spécifique en lui-même.

### Règle d'affectation :
*   Si vous équipez une **Hache** sur l'**Emplacement 1** : Vous configurez l'arbre `[Hache - Emplacement 1]`.
*   Si vous équipez une **Épée** sur l'**Emplacement 2** : Vous configurez l'arbre `[Épée - Emplacement 2]`.
*   Si vous remplacez l'Épée de l'Emplacement 2 par une **seconde Hache** :
    *   L'arbre de cette seconde Hache est `[Hache - Emplacement 2]`.
    *   Il est indépendant de l'arbre `[Hache - Emplacement 1]`. Vous pouvez donc avoir deux Haches configurées de manières totalement différentes (l'une axée sur les dégâts de zone, l'autre sur la vitesse d'attaque).
*   Si vous remplacez la Hache de l'Emplacement 1 par une **Épée** :
    *   L'arbre de cette Épée est `[Épée - Emplacement 1]`, indépendant de celui de l'Emplacement 2.
*   Si vous ré-équipez une Hache sur l'Emplacement 1 :
    *   Vous retrouvez exactement la configuration de l'arbre `[Hache - Emplacement 1]` telle que vous l'aviez laissée précédemment.

---

## 3. Structure des Arbres de Compétences d'Armes

Chaque type d'arme (Hache, Épée, Dague, Masse) possède un arbre de compétences divisé en deux sections distinctes qui fonctionnent sous le même format structurel :

### A. La section "Passif" (Auto-Attack)
Représente le comportement de l'attaque automatique qui cible l'ennemi le plus proche.

### B. La section "Actif" (Compétence Ultime)
Représente la compétence active majeure déclenchée manuellement par le joueur (ex: touche A pour l'Ultime de l'Arme 1, touche E pour l'Ultime de l'Arme 2).

### C. Fonctionnement des Nœuds (Structure commune)
1.  **Nœud Majeur (Le Choix Principal)** : 
    *   C'est le point de départ de la section. Le joueur sélectionne le "Comportement" de base de l'attaque ou de l'ultime (ex: pour la Hache : *Lancer circulaire* ou *Frappe frontale lourde*).
2.  **Branches de Modification (Modificateurs)** :
    *   À partir du nœud majeur choisi, un arbre de modificateurs se ramifie.
    *   Ces modificateurs modifient la structure ou appliquent des buffs à l'attaque principale (ex: *L'attaque ricoche sur 2 cibles supplémentaires*, *L'attaque applique une brûlure*, *Augmente la taille du projectile de 30%*).

---

## 4. Affinités de Statistiques par Type d'Arme

Chaque type d'arme favorise certaines statistiques lors de la génération aléatoire des loots :

*   **Épée** : Affinité avec les **Dégâts Physiques** et la **Chance de toucher**.
*   **Hache** : Affinité avec les **Dégâts Physiques** et la **Pénétration Physique**.
*   **Dague** : Affinité avec la **Chance de coup critique** et les **Dégâts de coup critique**.
*   **Masse** : Affinité avec le **Soutien** (Vie max, Régénération de Vie, Bonus au soin, Parade).
