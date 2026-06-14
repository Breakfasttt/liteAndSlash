# Fiche Gameplay 03 : Map Procédurale & Exploration

Ce document spécifie la structure de la carte procédurale, les règles d'exploration par salle, et la contrainte d'extensibilité (scriptabilité) pour le développement futur.

---

## 1. Structure de la Carte & Salles

### A. Topologie de la Map
*   **Les Salles (Rooms)** : La carte de l'instance est composée d'un ensemble de salles interconnectées. 
*   **Forme & Connexions** :
    *   Chaque salle est de forme carrée.
    *   Chaque salle possède entre 1 et 4 ouvertures (portes) situées sur ses points cardinaux (Nord, Sud, Est, Ouest) permettant de rejoindre une salle adjacente.
*   **Types de Salles** :
    *   `START` : Salle de départ sécurisée.
    *   `MOB` : Combat standard contre des vagues de sbires.
    *   `EVENT` : Événements spéciaux (ex: coffre piégé à vagues, autels de bénédiction, survivant à escorter).
    *   `DEMI_BOSS` : Salle de mini-boss contenant l'un des gardiens de clés.
    *   `BOSS` : L'arène finale du Boss de l'instance.

### B. Exploration & Progression dans la Carte
*   **Objectif** : Les joueurs doivent explorer la carte à la recherche des **2 salles de Demi-Boss**.
*   **Les Clés de Boss** :
    *   Chaque Demi-Boss vaincu donne une clé unique (état global partagé par le groupe).
    *   La salle du **Boss final** est verrouillée au départ. Il est obligatoire de posséder les 2 clés pour ouvrir la porte d'accès.
*   **Verrouillage des Portes** :
    *   Lorsqu'un groupe de joueurs franchit le seuil d'une salle non nettoyée, le combat s'active et toutes les portes de la salle se verrouillent (des barrières géométriques bloquent les sorties).
    *   Les joueurs doivent nettoyer la salle (vaincre tous les monstres, réussir l'événement) pour déverrouiller les portes et continuer l'exploration.
    *   *Règle de groupe* : Si un joueur initie un combat alors que ses alliés sont dans la salle précédente, ces derniers sont automatiquement téléportés dans la salle de combat pour éviter qu'ils ne soient bloqués à l'extérieur.

---

## 2. Contrainte Technique : Modularité & Scriptabilité (Contrainte 5)

Le système de jeu doit être conçu pour qu'un développeur (ou moddeur) puisse créer du contenu très simplement, sans avoir à toucher au moteur interne.

### Exemple de Spécification de Scripting (`Salle`)

Toutes les salles héritent d'une classe de base `Salle`. Voici le modèle d'extension TypeScript simple que nous allons documenter et supporter :

```typescript
// Exemple de création de salle personnalisée
class MaSuperSalle extends Salle {
    private waveCount: number = 0;
    
    // Initialisation lors de la génération de la carte
    onInit() {
        this.name = "Salle des Ombres";
    }

    // Se déclenche dès que les joueurs entrent et que les portes se ferment
    onEnter() {
        this.spawnWave();
    }

    // Boucle de jeu de la salle (tourne sur le serveur autoritaire)
    onTick(dt: number) {
        if (this.areAllMobsDead() && this.waveCount < 3) {
            this.spawnWave();
        } else if (this.areAllMobsDead() && this.waveCount >= 3) {
            this.clear(); // Déverrouille les portes et distribue le butin
        }
    }

    private spawnWave() {
        this.waveCount++;
        // Spawns géométriques simples (carrés pour les mobs de base)
        this.spawnMob("CacodemoneSquare", { count: 5 * this.waveCount });
    }
}
```

### Événements de base exposés par la classe `Salle` :
*   `onInit()` : Appelé lors de la création de la carte (pour setup la seed et les types d'obstacles).
*   `onEnter()` : Appelé au verrouillage des portes et au début du combat.
*   `onTick(deltaTime)` : Appelé à chaque frame du serveur pour mettre à jour la logique.
*   `onClear()` : Appelé quand l'objectif est atteint. Déclenche le déverrouillage et l'ouverture des portes.
*   `onDestroy()` : Appelé lors du nettoyage de la mémoire de l'instance.
