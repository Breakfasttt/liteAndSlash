# Fiche Gameplay 06 : Les Items & L'Équipement

Ce document spécifie le fonctionnement des pièces d'équipement, les affinités de statistiques par emplacement, les bonus d'ensembles (gearsets) et le modèle de progression proposé pour le Hack'n'Slash.

---

## 1. Description Fonctionnelle des Items

Les pièces d'équipement modifient passivement les statistiques globales du joueur. Elles possèdent un niveau d'objet (Item Level ou **iLvl**) et un niveau de rareté.

### A. Raretés et Lignes de Statistiques
*   **Blanc (Commun)** : 1 ligne de statistique aléatoire.
*   **Vert (Magique)** : 2 lignes de statistiques aléatoires.
*   **Bleu (Rare)** : 3 lignes de statistiques aléatoires.
*   **Violet (Épique)** : 4 lignes de statistiques aléatoires.
*   **Orange (Unique)** :
    *   Statistiques fixes prédéfinies.
    *   Apporte une **modification majeure d'une mécanique de jeu** (ex: *"Votre Dash laisse une traînée de feu derrière lui"*, *"Votre portée d'auto-ciblage est doublée, mais vous perdez 10% de vitesse de déplacement"*).
    *   **Restriction** : Un personnage ne peut équiper qu'**un seul item unique (orange)** à la fois sur l'ensemble de son équipement.

### B. Ensembles d'Équipement (Gearsets / Familles)
Chaque équipement (hors objets uniques) appartient à une famille (ex: *"Set du Gardien Géométrique"*, *"Set de la Vitesse Spectrale"*). Porter plusieurs objets de la même famille débloque des bonus cumulatifs :
*   **Bonus (4 pièces équipées)** : Octroie un bonus passif de statistiques (ex: `+15% Vitesse de déplacement`).
*   **Bonus (6 pièces équipées)** : Modifie une mécanique de combat (ex: *"Toutes les 5 secondes, votre prochaine attaque à la Hache déclenche un séisme autour de vous"*).

---

## 2. Emplacements d'Équipement (8 slots) & Affinités

Chaque équipement se place dans l'un des 8 slots disponibles. Selon l'emplacement, il existe une **affinité** avec des catégories de statistiques précises, augmentant grandement la probabilité de rouler ces statistiques lors du drop.

| Emplacement | Affinité Principale | Exemples de Stats Favorisées |
| :--- | :--- | :--- |
| **Casque** | Protection, Critique | Armure, Volonté, Chance de coup critique |
| **Torse** | Protection | Armure, Volonté, Vie max, Bouclier élémentaire |
| **Jambes** | Protection, Déplacement | Armure, Vitesse de déplacement |
| **Gants** | Dégâts | Dégâts physiques, Dégâts élémentaires, Chance de toucher |
| **Bague** | Utilitaire, Protection | Régénération de Mana/Vie, Résistances, Cooldown Recovery |
| **Collier** | Utilitaire, Dégâts | Bonus au soin, Dégâts de coup critique, Pénétration |
| **Arme 1** | Dépend de l'arme équipée | (Ex: Épée = Dégâts physiques ; Dague = Critique) |
| **Arme 2** | Dépend de l'arme équipée | (Ex: Masse = Soutien/Régén ; Hache = Dégâts) |

---

## 3. Le Système de Craft & Recyclage (L'Économie)

L'artisanat dans *liteAndSlash* repose sur une ressource unique, les **Matériaux**, et des mécanismes simples de recyclage et de fusion.

### A. Les Matériaux (Monnaie de Craft)
*   **Obtention** : Les joueurs récoltent des Matériaux en récompense de mission ou en recyclant des équipements inutilisés.
*   **Ajout d'affixes (Ajout de lignes)** : Le joueur peut dépenser des Matériaux pour modifier un équipement possédant moins de 4 lignes de statistiques.
    *   **Ligne Aléatoire** : Ajoute une ligne de statistique totalement aléatoire sur l'objet.
    *   **Ligne Ciblée** : Permet de choisir une catégorie de statistique (Protection, Attaque ou Utilitaire) et d'ajouter une ligne aléatoire appartenant à cette catégorie. Cette opération est plus coûteuse en Matériaux.
    *   **Coût progressif** : Plus l'objet possède déjà de lignes de statistiques, plus l'ajout d'une nouvelle ligne coûte cher. Un objet ne peut jamais dépasser la limite de **4 lignes maximum** (Rareté Violette).

### B. Le Recyclage (Démantèlement)
*   Le joueur peut détruire n'importe quel équipement obsolète de son inventaire depuis l'interface de forge du Hub pour récupérer des **Matériaux**.

### C. La Fusion (Combinaison d'items)
*   **Fonctionnement** : Le joueur peut combiner **3 objets de même rareté** (ex: 3 objets Verts) pour générer **1 nouvel objet de rareté supérieure** (ex: 1 objet Bleu).
*   **Génération et Héritage** :
    *   Le type d'objet généré (Casque, Torse, Gants, etc.) et ses autres statistiques sont aléatoires.
    *   **Règle d'héritage** : L'objet généré possède obligatoirement **au moins 1 ligne de statistique identique** à l'une des lignes présentes sur les 3 objets combinés de départ.

