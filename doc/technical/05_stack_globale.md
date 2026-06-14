# Fiche Technique 05 : Stack Technique Globale & Structure de Projet

Ce document définit la stack technique définitive retenue pour *liteAndSlash*, justifie les choix architecturaux et décrit l'arborescence des fichiers du projet.

---

## 1. Choix de la Stack Technique

Pour répondre aux contraintes de performances critiques (60 FPS constants), de synchronisation réseau multijoueur temps réel (jusqu'à 4 joueurs) et d'isomorphisme, la stack suivante a été sélectionnée :

### A. Client (Frontend) : TypeScript + PixiJS + Vite
*   **PixiJS (v8)** : Moteur de rendu WebGL/WebGPU pur. Idéal car l'affichage utilise uniquement des formes géométriques minimalistes (cercles, carrés, lignes). PixiJS offre des performances brutes de rendu sans l'overhead physique ou scénique de Phaser 3.
*   **Vite** : Outil de build et serveur de développement ultra-rapide. Assure un rechargement à chaud (HMR) immédiat du code client.

### B. Serveur de Jeu & Hub (Backend) : Node.js + TypeScript + uWebSockets.js
*   **uWebSockets.js** : Binding C++ officiel pour Node.js. C'est l'implémentation de WebSocket la plus rapide du marché (jusqu'à 10 fois plus performante que `socket.io` ou `ws` en consommation mémoire et latence). Indispensable pour gérer les messages binaires et les snapshots du serveur autoritaire.
*   **Node.js (LTS)** : L'utilisation de TypeScript côté serveur permet le **partage de code** avec le client.

### C. Base de Données & Persistance : PostgreSQL + Prisma ORM
*   **PostgreSQL** : Base de données relationnelle robuste pour stocker les comptes, personnages, inventaires et leaderboards.
*   **Prisma ORM** : Pour la modélisation de la base de données et les migrations. Offre une génération automatique des types TypeScript à partir du schéma SQL, assurant la cohérence avec le reste du projet.

---

## 2. Le Partage de Code (Isomorphisme)

Pour assurer la cohérence et la modularité, la logique de calcul de collision, de génération de carte procédurale et de statistiques de combat est placée dans un dossier partagé (`src/shared/`).

```
                    ┌─────────────────────────┐
                    │      src/shared/        │
                    │                         │
                    │   - Physique / Hitbox   │
                    │   - Registre de scripts │
                    │   - Dictionnaire stats  │
                    │   - Générateur de Map   │
                    └────────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
     ┌───────────────────────┐       ┌───────────────────────┐
     │      src/client/      │       │      src/server/      │
     │   (PixiJS / Rendu)    │       │   (uWS / Logique HW)  │
     └───────────────────────┘       └───────────────────────┘
```

---

## 3. Structure Finale du Code du Répertoire

Voici l'arborescence du projet qui sera initialisée :

```
liteAndSlash/
├── .agent/                             # Instructions IA
│   ├── agent.md                        # Objectifs globaux et règles
│   └── skills/                         # Fiches d'aide au code technique
├── doc/                                # Spécifications fonctionnelles et techniques
│   ├── README.md                       # Index général
│   ├── gameplay/                       # Fiches fonctionnelles de gameplay (01 à 07)
│   └── technical/                      # Fiches d'architecture technique (01 à 05)
├── prisma/                             # Schéma et migrations PostgreSQL (Prisma)
│   └── schema.prisma
├── src/
│   ├── client/                         # Code Frontend
│   │   ├── components/                 # Composants d'UI du Hub (Lobby, Inventaire, etc.)
│   │   ├── engine/                     # Boucle de rendu PixiJS, interpolation, CSP
│   │   ├── index.html                  # Point d'entrée HTML
│   │   └── main.ts                     # Initialisation PixiJS et WS client
│   ├── server/                         # Code Backend
│   │   ├── api/                        # Serveur HTTP Express/Fastify (Authentification & OAuth)
│   │   ├── game/                       # Gestion des instances de jeu temps réel (Loop, uWS)
│   │   ├── lobby/                      # Gestion du Hub central, chat MMO et matchmaking
│   │   └── main.ts                     # Point d'entrée serveur
│   └── shared/                         # Code commun partagé et compilé des deux côtés
│       ├── content/                    # Scripts des classes, salles, ennemis et armes
│       ├── core/                       # Gestionnaire de statistiques et registres
│       ├── physics/                    # Hitboxes, collisions, Grille de Hachage Spatial
│       └── types/                      # Interfaces de paquets réseau binaires et types
├── package.json                        # Dépendances Node.js (Vite, Prisma, uWS, TypeScript)
├── tsconfig.json                       # Configuration globale TypeScript
└── vite.config.ts                      # Configuration de build client
```
