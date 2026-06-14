# Agent Persona & Finalités - Project: liteAndSlash

Ce document sert de guide de référence pour l'IA (Antigravity) afin de maintenir l'alignement sur les objectifs finaux, les règles de développement et les compétences techniques requises pour le projet **liteAndSlash**.

---

## 1. Finalités du Projet

Le projet **liteAndSlash** est un jeu par navigateur 2D (vue du dessus) alliant :
- **Gameplay d'action auto-shooter (Vampire Survivors)** : Déplacements contrôlés par le joueur, visée et attaques automatiques ciblées sur l'ennemi le plus proche, une esquive active (Dash) et une compétence majeure (Ultime).
- **Structure de boucle Hack'n'Slash** : Choix du boss à affronter (instances instanciées pour 1 à 4 joueurs), combat contre des vagues de sbires, combat de boss, système de loot d'équipements avec affixes aléatoires, gestion d'inventaire, et conception de builds (arbre de compétences, modificateurs d'armes).
- **Direction Artistique Minimaliste** : Formes géométriques simples (cercles pour les personnages/monstres, carrés pour les obstacles, projectiles rectangulaires/circulaires simples) pour maximiser la lisibilité et les performances de rendu.

---

## 2. Règles Fondamentales pour l'Agent

### Règle A : Conception "Documentation First"
Ne jamais coder une fonctionnalité avant d'avoir :
1. Documenté l'aspect gameplay (règles, calculs, expérience joueur).
2. Validé la structure technique (architecture, flux réseau, partages de code).
3. Reçu l'approbation de l'utilisateur.

### Règle B : Isomorphisme & Partage de Code (TypeScript)
Le client (Frontend) et le serveur (Backend) doivent être conçus en TypeScript pour maximiser le partage de code.
- **Dossier Partagé (`shared/`)** : Doit contenir les calculs de collision (hitboxes), les calculs de statistiques de personnages (calculs de dégâts, résistances, modificateurs de vitesse), les types de messages réseau et la logique de génération de carte procédurale par seed.

### Règle C : Zéro Allocation en Runtime (GC Safety)
Pour éviter les saccades dues au Garbage Collector dans le navigateur et sur le serveur :
- Utiliser un pattern **Object Pool** strict pour les monstres, projectiles, et particules.
- Interdiction de créer des objets temporaires (ex: `new Vector2D(x, y)`) dans les boucles de mise à jour (`tick`/`update`). Réutiliser des vecteurs statiques ou des pools de vecteurs.

### Règle D : Optimisation Réseau (Bullet Hell Netcode)
- Les projectiles de masse ne sont **jamais** synchronisés individuellement par WebSocket.
- Le serveur émet uniquement l'événement d'activation d'un pattern de tir (ID du pattern, position d'origine, angle initial, seed aléatoire du pattern si applicable).
- Le client simule visuellement les trajectoires des projectiles localement.
- Le serveur calcule mathématiquement si un joueur entre en collision avec un projectile (par exemple en comparant le temps écoulé par rapport à la trajectoire théorique du projectile).

---

## 3. Compétences Techniques (Skills) à Développer

Chaque aspect technique clé fera l'objet d'un fichier de spécification ou "Skill" dans le dossier `.agent/skills/` pour servir de guide de codage :

1. **`skill_networking.md`** : Gestion des WebSockets, prédiction client (Client-side Prediction), réconciliation serveur (Server Reconciliation) et interpolation d'entités.
2. **`skill_physics.md`** : Moteur de collision léger cercle/boîte (AABB), gestion de la grille de hachage spatial (Spatial Hash Grid) pour optimiser les requêtes de proximité côté serveur.
3. **`skill_pooling.md`** : Modèles et structures génériques d'Object Pools en TypeScript pour le recyclage d'instances.
4. **`skill_generation.md`** : Algorithmes de génération procédurale par seed (bruit cohérent ou partitionnement d'espace) partagés entre client et serveur.
5. **`skill_loot_and_stats.md`** : Moteur de calcul de statistiques à la volée (calcul cumulatif des bonus d'équipements, talents et buffs temporaires).
