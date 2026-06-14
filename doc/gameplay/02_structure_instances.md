# Fiche Gameplay 02 : Structure des Instances & Choix des Boss

Ce document détaille le fonctionnement de la boucle de matchmaking, de la gestion du groupe et des conditions de victoire et de défaite d'une mission.

---

## 1. Description Fonctionnelle

### A. Sélection de la Mission (Onglet "Jouer")
Depuis le Hub principal, l'onglet "Jouer" permet d'initier une partie :
*   **Sélection du Boss** : Une liste présente les boss disponibles (avec déblocage progressif).
*   **Niveau de Difficulté** : Pour chaque boss, le joueur sélectionne une difficulté (ex: Normal, Difficile, Cauchemar). La difficulté augmente les statistiques des monstres, la vitesse des projectiles et améliore la qualité du loot.
*   **Création du Lobby** : Avant de lancer la partie, le joueur choisit le type de salon :
    *   **Lobby Privé** : Accessible uniquement sur invitation directe ou pour les amis du chef de groupe.
    *   **Lobby Public (Matchmaking)** : La partie est ouverte. Le système de matchmaking cherche d'autres joueurs (jusqu'à 4 au total) ayant sélectionné le même boss dans la même difficulté.
    *   **Solo** : Le joueur lance immédiatement l'instance seul.
*   **Leaderboard (Classement)** : Chaque combinaison (Boss + Difficulté + Nombre de joueurs [1, 2, 3 ou 4]) possède son propre classement basé sur le **temps de complétion** (time attack). Le classement affiche les pseudos des joueurs et le temps précis mis pour tuer le boss.

### B. Gestion du Groupe et Matchmaking
*   **Rôle du Chef de Groupe** : C'est le créateur du groupe ou le joueur désigné. Il est le seul à pouvoir sélectionner le boss, la difficulté et lancer la recherche ou le départ.
*   **Reconnexion** : 
    *   Si un joueur subit une déconnexion (crash, perte internet) pendant une partie en cours, sa place est réservée. Il peut se reconnecter et rejoindre directement son groupe dans la run en cours.
    *   Il est strictement **impossible** pour un nouveau joueur de rejoindre une run déjà lancée.

### C. Conditions de Victoire et Défaite
*   **Mécanique de K.O. et Réanimation** :
    *   Lorsqu'un joueur perd tous ses points de vie, il tombe à terre (état K.O.). Il ne peut plus agir ni attaquer.
    *   Les coéquipiers encore debout peuvent s'approcher de lui et interagir pendant un certain temps (canalisation) pour le relever.
    *   **Pénalité de mort répétée** : Plus un joueur tombe K.O. au cours d'une même run, plus le temps de canalisation requis pour le relever augmente (ex: 3s à la première mort, 6s à la deuxième, 12s à la troisième).
*   **Condition de Défaite** :
    *   La défaite survient lorsque **tous les joueurs du groupe sont K.O. simultanément** (ou mort en solo).
    *   **Écran de récapitulatif (Défaite)** : Affiche les statistiques de la run et le butin amassé dans les salles. Les joueurs conservent le loot récolté au sol durant la run, mais ne reçoivent aucun bonus d'XP ou de butin de fin de partie.
*   **Condition de Victoire** :
    *   La victoire est prononcée dès que le Boss final de l'instance est vaincu.
    *   **Écran de récapitulatif (Victoire)** :
        *   Affichage du butin récolté dans la run.
        *   **Bonus d'XP de fin de mission** et **Bonus de loot de fin de mission** (coffre de fin).
        *   **Bonus de rapidité** : Si l'instance a été complétée en dessous d'un temps de référence, un bonus supplémentaire d'XP/loot est octroyé.

---

## 2. Structure Technique & Flux Réseau

### A. Gestion des Lobby (Hub WS)
*   Les salons d'attente (Lobbies) sont gérés au niveau du serveur de Hub en mémoire vive.
*   Le serveur valide les invitations d'amis et le matchmaking public en associant des profils avec des filtres simples : `[bossId, difficulty, partySize]`.

### B. Cycle de Vie d'une Instance de Jeu
1.  **Instanciation** : Quand le lobby est complet ou lancé, le serveur de Hub demande la création d'une instance physique (soit un sous-processus, soit une pièce virtuelle logique gérée par le serveur autoritaire).
2.  **Handshake de Run** : Les clients reçoivent l'adresse IP/port ou l'ID de canal de l'instance, s'y connectent via WebSocket, et reçoivent la **seed** de génération de la carte.
3.  **Heartbeat & Reconnexion** : Le serveur d'instance maintient un état `disconnectedPlayers`. Si un WebSocket se coupe, le personnage passe en état d'inactivité (ou K.O. automatique) mais n'est pas supprimé de l'état du jeu pendant un délai de grâce (ex: 2 minutes). Si le joueur se reconnecte avec le même JWT, le serveur lui ré-associe son entité de jeu.
