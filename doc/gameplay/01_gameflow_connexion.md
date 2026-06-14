# Fiche Gameplay 01 : Landing Page & Connexion (Gameflow)

Ce document décrit le flux d'accueil, le système d'authentification par tiers, la création de personnage et la structure en onglets du Hub.

---

## 1. Description Fonctionnelle

### A. La Landing Page (Page d'Accueil)
L'interface d'accueil s'adapte selon l'état de connexion de l'utilisateur :
*   **Utilisateur Non Connecté** :
    *   Bouton principal de connexion tiers (ex: "Se connecter avec Discord/Google").
    *   Pas d'accès direct au jeu.
*   **Utilisateur Connecté** :
    *   Un gros bouton **"Jouer"** au centre, qui redirige immédiatement vers l'écran de sélection de personnage.
    *   Une option pour se déconnecter et un rappel du pseudo du compte global (ex: `breakyt#12592`).

### B. Le Système de Connexion & Authentification
*   **Authentification Tiers** : Connexion simplifiée via Google, Discord ou par "Magic Link" (envoi d'un lien unique de connexion temporaire par email). Aucun mot de passe n'est stocké dans notre base de données.
*   **Pseudo de Compte Unique** :
    *   Lors de sa première connexion, l'utilisateur choisit son pseudo de compte global (ex: `breakyt`).
    *   Le serveur génère et lui attribue un suffixe unique à 5 chiffres (ex: `#12592`).
    *   Le pseudo final est de la forme `Pseudo#XXXXX`. Cela permet à plusieurs utilisateurs d'avoir le même pseudo d'affichage tout en restant identifiables de manière unique pour le système d'amis et le matchmaking.

### C. Sélection et Création de Personnage (Max 5 personnages)
*   **Sélection** : Une liste présente les personnages créés (maximum 5). Chaque entrée montre le pseudo du personnage, son niveau, son arme et sa forme géométrique.
*   **Création** :
    *   **Pseudo du personnage** : Saisie d'un nom propre au personnage (indépendant du pseudo de compte global).
    *   **Forme Géométrique (Classe)** : Le joueur choisit une forme géométrique de base (ex: Cercle, Carré, Triangle). Cette forme détermine :
        *   Les statistiques de départ (PV max, Vitesse, Armure, etc.).
        *   L'arbre de talents et les modificateurs de gameplay accessibles plus tard.
    *   **Personnalisation Visuelle (Prévue pour la suite/Monétisation)** : Le joueur pourra débloquer et appliquer des options de personnalisation esthétique (qui ne modifient pas le gameplay) :
        *   Couleur de remplissage (gradient, néon).
        *   Glow (effet de halo lumineux de couleur autour de la forme).
        *   Textures de surface (motifs géométriques, animations internes).

### D. Le Hub / Camp de Base (Lobby principal)
Une fois le personnage sélectionné, le joueur arrive sur une interface structurée autour de **4 onglets principaux** et d'un **chat MMO persistant** :

1.  **Onglet "Jouer"** : Choix des boss et instances, options de matchmaking (solo ou groupe).
2.  **Onglet "Inventaire"** : Grille d'objets, équipement du personnage, statistiques détaillées.
3.  **Onglet "Skills" (Compétences)** : Arbre de talents de la classe/forme, choix des compétences actives/ultime.
4.  **Onglet "Social"** : Gestion de la liste d'amis (recherche via `Pseudo#XXXXX`), invitations dans le groupe (4 joueurs max), statut en ligne/hors-ligne.
5.  **Le Chat MMO (Persistant en bas de l'écran)** :
    *   Canal **Général** (tous les joueurs connectés au Hub).
    *   Canal **Groupe** (uniquement visible par les membres du groupe actif).
    *   Canal **Murmures / MP** (messages directs entre deux joueurs).

---

## 2. Structure Technique & Flux Réseau

### A. Flux d'authentification et de session
*   **OAuth2 / Magic Links** : Le client redirige vers l'authentification tierce. Le serveur d'API valide la réponse de l'OAuth ou génère le Magic Link, puis crée la ligne utilisateur en base de données.
*   **Génération du Hash Unique** : Lors de l'inscription, le serveur exécute une fonction récursive ou une contrainte SQL unique pour générer un nombre aléatoire de 5 chiffres compris entre `10000` et `99999` non encore attribué pour ce pseudo.
*   **WebSocket & Canaux de Chat** : Dès l'entrée dans le Hub, le client ouvre une connexion WebSocket authentifiée par JWT. Le serveur gère la diffusion (Broadcast) des messages de chat par groupes de canaux.
