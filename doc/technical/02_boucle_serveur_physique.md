# Fiche Technique 02 : Boucle Serveur & Physique Autoritaire

Ce document spécifie la structure de la boucle de jeu du serveur autoritaire, les formes de hitboxes simplifiées et l'optimisation des collisions via une grille de hachage spatial (Spatial Hash Grid).

---

## 1. Boucle de Jeu du Serveur (Server Game Loop)

Le serveur de jeu tourne à une fréquence fixe (Tickrate) de **60 Hz** (60 ticks par seconde) ou **30 Hz** pour garantir une détection de collision précise et une réactivité optimale du netcode.

*   **Algorithme de la Boucle** : Pour éviter la dérive temporelle en JavaScript (due aux imprécisions de `setInterval`), la boucle utilise une compensation temporelle (high-resolution timer avec `process.hrtime.bigint()`).

```typescript
const TICK_RATE = 30; // 30 ticks par seconde
const TICK_TIME = 1000 / TICK_RATE; // ~33.33ms par tick

let lastTime = process.hrtime.bigint();

function gameLoop() {
  const now = process.hrtime.bigint();
  const deltaTime = Number(now - lastTime) / 1_000_000_000; // secondes
  lastTime = now;

  // 1. Lire et appliquer les entrées réseaux reçues des clients
  processClientInputs();

  // 2. Mettre à jour la logique de jeu (IA, Salles, Buffs)
  updateGameLogic(deltaTime);

  // 3. Exécuter le moteur de collision autoritaire
  resolveCollisions();

  // 4. Diffuser l'état global mis à jour aux clients (World Snapshot)
  broadcastWorldSnapshot();

  // Planification du prochain tick
  const duration = Number(process.hrtime.bigint() - now) / 1_000_000;
  const delay = Math.max(0, TICK_TIME - duration);
  setTimeout(gameLoop, delay);
}
```

---

## 2. Géométrie des Hitboxes & Résolution des Collisions

Afin de maximiser les performances de calcul, seules deux formes géométriques de hitboxes sont autorisées :

### A. Hitbox Circulaire (Circle)
*   **Utilisation** : Joueurs, Ennemis (Sbires, Boss) et la majorité des projectiles.
*   **Structure** : `x`, `y`, `radius`.
*   **Résolution Cercle/Cercle** :
    ```typescript
    function checkCircleCollision(c1: Circle, c2: Circle): boolean {
      const dx = c2.x - c1.x;
      const dy = c2.y - c1.y;
      const distanceSq = dx * dx + dy * dy;
      const radiusSum = c1.radius + c2.radius;
      return distanceSq < radiusSum * radiusSum;
    }
    ```

### B. Hitbox Rectangulaire (AABB - Axis-Aligned Bounding Box)
*   **Utilisation** : Obstacles fixes de la carte (murs, rochers, éléments de décor).
*   **Structure** : `x`, `y`, `width`, `height`.
*   **Résolution Cercle/AABB (Collision Joueur/Mur)** :
    On trouve le point le plus proche sur le rectangle AABB par rapport au centre du cercle, puis on mesure la distance.
    ```typescript
    function checkCircleAABBCollision(circle: Circle, rect: AABB): boolean {
      // Trouver la coordonnée la plus proche sur le rectangle
      const closestX = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width));
      const closestY = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height));

      // Calculer la distance entre le centre et le point le plus proche
      const dx = circle.x - closestX;
      const dy = circle.y - closestY;
      const distanceSq = dx * dx + dy * dy;

      return distanceSq < circle.radius * circle.radius;
    }
    ```

---

## 3. Optimisation : Grille de Hachage Spatial (Spatial Hash Grid)

### Le Problème du $O(N^2)$
Si nous avons 500 ennemis et 4 joueurs à l'écran, comparer chaque entité avec toutes les autres à chaque tick nécessite $504 \times 503 = 253\ 512$ vérifications. Cela provoque immédiatement un lag serveur.

### La Solution
La **Grille de Hachage Spatial** divise la carte en une grille de cellules carrées de taille fixe (ex: $128 \times 128$ pixels). 
*   Chaque entité s'enregistre dans la cellule correspondant à sa position en début de tick ($O(N)$).
*   Lors des tests de collision, une entité teste uniquement les entités situées dans **sa cellule** et dans les **8 cellules adjacentes**.

```typescript
// src/shared/physics/SpatialHashGrid.ts

export class SpatialHashGrid<T extends { x: number; y: number; radius: number }> {
  private cellSize: number;
  private grid: Map<string, T[]>;

  constructor(cellSize: number = 128) {
    this.cellSize = cellSize;
    this.grid = new Map();
  }

  public clear() {
    this.grid.clear();
  }

  private getCellKey(x: number, y: number): string {
    const cx = Math.floor(x / this.cellSize);
    const cy = Math.floor(y / this.cellSize);
    return `${cx},${cy}`;
  }

  public insert(entity: T) {
    // Une entité peut chevaucher plusieurs cellules si son rayon est grand
    const minX = Math.floor((entity.x - entity.radius) / this.cellSize);
    const maxX = Math.floor((entity.x + entity.radius) / this.cellSize);
    const minY = Math.floor((entity.y - entity.radius) / this.cellSize);
    const maxY = Math.floor((entity.y + entity.radius) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        if (!this.grid.has(key)) this.grid.set(key, []);
        this.grid.get(key)!.push(entity);
      }
    }
  }

  public getPotentialColliders(entity: T): T[] {
    const colliders = new Set<T>();
    const minX = Math.floor((entity.x - entity.radius) / this.cellSize);
    const maxX = Math.floor((entity.x + entity.radius) / this.cellSize);
    const minY = Math.floor((entity.y - entity.radius) / this.cellSize);
    const maxY = Math.floor((entity.y + entity.radius) / this.cellSize);

    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const key = `${x},${y}`;
        const cell = this.grid.get(key);
        if (cell) {
          for (const other of cell) {
            if (other !== entity) colliders.add(other);
          }
        }
      }
    }
    return Array.from(colliders);
  }
}
```
**Résultat** : La complexité de détection des collisions passe d'un coût quadratique $O(N^2)$ à un coût linéaire $O(N)$, garantissant une boucle physique serveur stable à 60 FPS.
