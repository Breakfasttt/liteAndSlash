# liteAndSlash - Documentation du Jeu

Bienvenue dans la documentation officielle de **liteAndSlash**, un jeu web 2D combinant la survie/esquive automatique et la profondeur d'un Hack'n'Slash.

Ce dossier regroupe toutes les spécifications fonctionnelles (gameplay) et techniques du projet. Notre approche consiste à détailler d'abord le gameplay, puis à en déduire les contraintes techniques, avant de définir la stack finale et le code.

---

## Sommaire de la Documentation

### 1. Fiches de Gameplay (Fonctionnelles)
*   **[01. Landing Page & Connexion (Gameflow)](file:///d:/devperso/antigravity/liteAndSlash/doc/gameplay/01_gameflow_connexion.md)** : Accueil, authentification (tiers et magic link), sélection et personnalisation de personnage et structure en onglets du Hub.
*   **[02. Structure des Instances & Choix des Boss](file:///d:/devperso/antigravity/liteAndSlash/doc/gameplay/02_structure_instances.md)** : Boucle de matchmaking, lobbies (privés/publics/solo), leaderboards de temps, reconnexion et conditions de K.O./victoire/défaite.
*   **[03. Map Procédurale & Exploration](file:///d:/devperso/antigravity/liteAndSlash/doc/gameplay/03_map_procedurale.md)** : Génération par salles connectées, verrouillage de combat, obtention des clés de demi-boss et contrainte technique de scriptabilité (`MaSuperSalle extends Salle`).
*   **[04. Les Classes & Arbres de Talents](file:///d:/devperso/antigravity/liteAndSlash/doc/gameplay/04_classes_talents.md)** : Les formes géométriques comme classes (Cercle, Carré, Triangle), attribution de points par niveau et arbres de talents extensibles.
*   **[05. Les Statistiques du Joueur](file:///d:/devperso/antigravity/liteAndSlash/doc/gameplay/05_player_stats.md)** : Répertoire exhaustif des statistiques de combat triées par catégories (Protection, Attaque, Utilitaire).
*   **[06. Les Items & L'Équipement](file:///d:/devperso/antigravity/liteAndSlash/doc/gameplay/06_items_equipement.md)** : Raretés des items (Blanc à Orange Unique), affinités par emplacement, gearsets (bonus 4 et 6 pièces) et modèle de progression (artisanat, matériaux de craft, fusion d'objets).
*   **[07. Les Armes & Compétences d'Armes](file:///d:/devperso/antigravity/liteAndSlash/doc/gameplay/07_armes_competences.md)** : Double équipement (Dual wielding), persistance de la configuration des compétences par emplacement et type d'arme, structure des arbres d'attaques passives et actives.

### 2. Fiches Techniques (Architecture & Moteurs)
*   **[01. Moteur de Scripting Modulaire](file:///d:/devperso/antigravity/liteAndSlash/doc/technical/01_scripting_modularite.md)** : Architecture du registre centralisé, héritage de classes de base typées TypeScript et structure de modding pour les développeurs.
*   **[02. Boucle Serveur & Physique Autoritaire](file:///d:/devperso/antigravity/liteAndSlash/doc/technical/02_boucle_serveur_physique.md)** : Cadence de boucle de tick (30/60 Hz), résolution de hitboxes géométriques simples (Cercles, AABB) et optimisation des performances via Spatial Hash Grid.
*   **[03. Netcode WebSockets & Optimisation Réseau (Bullet Hell)](file:///d:/devperso/antigravity/liteAndSlash/doc/technical/03_netcode_websockets.md)** : Format de paquets binaires compacts, prédiction client et réconciliation serveur, et simulation décentralisée des projectiles (visuals client, collisions analytiques serveur).
*   **[04. Calculateur de Statistiques & Moteur de Combat](file:///d:/devperso/antigravity/liteAndSlash/doc/technical/04_calculateur_stats.md)** : Formule d'évaluation dynamique des statistiques cumulatives, résolution des dégâts physiques/élémentaires face à l'armure/volonté, coups critiques et afflictions de dégâts sur la durée (DoT).
*   **[05. Stack Technique Globale & Structure](file:///d:/devperso/antigravity/liteAndSlash/doc/technical/05_stack_globale.md)** : Description de la stack (PixiJS, Node, uWS, PostgreSQL, Prisma), justification de l'isomorphisme et arborescence physique du dépôt.

---

## Statut de la Rédaction

| Fiche Documentaire | Statut | Points Clés Validés |
| :--- | :--- | :--- |
| **G.01. Landing Page & Connexion** | **Rédigé** | Authentification tiers (JWT), pseudo unique global |
| **G.02. Structure des Instances** | **Rédigé** | Lobbies, leaderboards time attack, résurrection K.O., défaite/victoire |
| **G.03. Map Procédurale** | **Rédigé** | Portes verrouillables, 2 clés demi-boss requis, template de scripting de salle |
| **G.04. Classes & Arbres de Talents** | **Rédigé** | Formes géométriques (stats de base), 1 point talent par niveau |
| **G.05. Statistiques du Joueur** | **Rédigé** | Dictionnaire complet Protection / Attaque / Utilitaire |
| **G.06. Items & Équipement** | **Rédigé** | Système de craft avec Matériaux, fusion 3 pour 1 avec héritage de stat |
| **G.07. Armes & Compétences** | **Rédigé** | Dual wielding, persistance des arbres d'armes par [Slot + Type] |
| **T.01. Moteur de Scripting** | **Rédigé** | GameRegistry et clonage propre en mémoire |
| **T.02. Boucle & Physique** | **Rédigé** | High-resolution tick loop, collisions Cercle/AABB, Spatial Hash Grid en $O(N)$ |
| **T.03. Netcode & WebSockets** | **Rédigé** | Packets binaires compacts, CSP & Réconciliation, Simulation locale projectiles |
| **T.04. Calculateur & Combat** | **Rédigé** | Ordre d'opérations de stats, atténuation non linéaire d'armure, critique, DoTs |
| **T.05. Stack Technique Globale** | **Rédigé** | Justification PixiJS/uWS/Prisma et structure du projet |
