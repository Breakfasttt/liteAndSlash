# Fiche Technique 01 : Moteur de Scripting Modulaire

Ce document définit l'architecture logicielle permettant de scripter de manière extrêmement simple et modulaire les éléments de gameplay (salles, classes, ennemis, armes, compétences et items).

---

## 1. Principes de Conception

Pour respecter la **Contrainte 5** (scriptabilité aisée par un humain), l'architecture repose sur :
1.  **L'Héritage Typé (TypeScript)** : Des classes de base abstraites (`Salle`, `Classe`, `Arme`, `Ennemi`, `Item`) définissant le comportement standard.
2.  **Un Registre Centralisé (Registry)** : Un gestionnaire de ressources (Registry Factory) chargé d'enregistrer, d'instancier et de cloner les scripts à la volée.
3.  **L'Isomorphisme Client/Serveur** : Les fichiers de scripts résident dans un dossier partagé (`src/shared/content/`) utilisable par le client pour l'affichage visuel et par le serveur autoritaire pour la simulation logique.

---

## 2. Structure du Registre Centralisé (`GameRegistry`)

Le `GameRegistry` indexe toutes les définitions par un identifiant textuel unique (ID). Il permet d'instancier une entité par simple clonage de sa définition.

```typescript
// src/shared/core/GameRegistry.ts

export class GameRegistry {
  private static classes = new Map<string, new () => Classe>();
  private static salles = new Map<string, new () => Salle>();
  private static ennemis = new Map<string, new () => Ennemi>();
  private static armes = new Map<string, new () => Arme>();

  // Enregistrement d'un script
  public static registerClasse(id: string, classRef: new () => Classe) {
    this.classes.set(id, classRef);
  }

  public static registerSalle(id: string, classRef: new () => Salle) {
    this.salles.set(id, classRef);
  }

  // Création d'une instance propre
  public static createClasse(id: string): Classe {
    const Ref = this.classes.get(id);
    if (!Ref) throw new Error(`Classe non trouvée: ${id}`);
    const instance = new Ref();
    instance.onInit();
    return instance;
  }

  public static createSalle(id: string): Salle {
    const Ref = this.salles.get(id);
    if (!Ref) throw new Error(`Salle non trouvée: ${id}`);
    const instance = new Ref();
    instance.onInit();
    return instance;
  }
}
```

---

## 3. Spécifications des Classes de Base Scriptables

Chaque élément scriptable dispose d'un ensemble de hooks prédéfinis et de variables configurables.

### A. Les Ennemis (`Ennemi`)
Tout nouvel ennemi hérite de `Ennemi`. Il n'a besoin que de surcharger ses stats et son comportement IA dans le tick.

```typescript
// src/shared/content/ennemis/ZombieBasique.ts
import { Ennemi, Entity } from "../base";
import { Stat } from "../../core/Stats";

export class ZombieBasique extends Ennemi {
  onInit() {
    this.name = "Zombie Lambbin";
    this.stats.set(Stat.MAX_HEALTH, 80);
    this.stats.set(Stat.MOVEMENT_SPEED, 90);
    this.stats.set(Stat.ARMOR, 5);
  }

  // Comportement IA exécuté uniquement sur le serveur
  onServerUpdate(dt: number, target: Entity) {
    // Calcul d'angle vers le joueur le plus proche
    const angle = Math.atan2(target.y - this.y, target.x - this.x);
    // Déplacement
    this.vx = Math.cos(angle) * this.getStat(Stat.MOVEMENT_SPEED);
    this.vy = Math.sin(angle) * this.getStat(Stat.MOVEMENT_SPEED);
  }
}
```

### B. Les Armes (`Arme`)
L'arme définit son comportement d'attaque automatique (passif) et son ultime (actif).

```typescript
// src/shared/content/armes/DagueAssassin.ts
import { Arme, WeaponType, ProjectilePattern } from "../base";

export class DagueAssassin extends Arme {
  onInit() {
    this.type = WeaponType.DAGGER;
    
    // Définition de l'attaque automatique (Passif)
    this.autoAttackNode = {
      cooldown: 0.8, // secondes
      range: 120, // pixels
      execute: (server, player, target) => {
        // Déclenchement d'un projectile rapide perforant directionnel
        server.spawnProjectile({
          originX: player.x,
          originY: player.y,
          targetX: target.x,
          targetY: target.y,
          speed: 400,
          damage: player.calculateDamage(this),
          pattern: ProjectilePattern.LINE
        });
      }
    };

    // Définition de la compétence Ultime (Actif)
    this.ultimateNode = {
      manaCost: 100,
      cooldown: 15,
      execute: (server, player) => {
        // Cercle de dagues tout autour du joueur
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 4) {
          server.spawnProjectile({
            originX: player.x,
            originY: player.y,
            angle: angle,
            speed: 500,
            damage: player.calculateDamage(this) * 2,
            pattern: ProjectilePattern.LINE
          });
        }
      }
    };
  }
}
```

---

## 4. Modèle d'Intégration du Contenu

Pour ajouter un élément au jeu :
1.  **Créer** un fichier `.ts` héritant de sa classe de base dans le répertoire approprié (ex: `src/shared/content/salles/`).
2.  **Enregistrer** la classe dans le fichier d'index central (ex: `src/shared/content/index.ts`).
3.  Le serveur et le client chargent l'index au démarrage. La création de nouvelles mécaniques s'effectue sans impacter les moteurs réseau et de rendu.
