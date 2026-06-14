export class SpatialHashGrid {
    cellSize;
    grid;
    constructor(cellSize = 128) {
        this.cellSize = cellSize;
        this.grid = new Map();
    }
    clear() {
        this.grid.clear();
    }
    insert(entity) {
        const minX = Math.floor((entity.x - entity.radius) / this.cellSize);
        const maxX = Math.floor((entity.x + entity.radius) / this.cellSize);
        const minY = Math.floor((entity.y - entity.radius) / this.cellSize);
        const maxY = Math.floor((entity.y + entity.radius) / this.cellSize);
        for (let x = minX; x <= maxX; x++) {
            for (let y = minY; y <= maxY; y++) {
                const key = `${x},${y}`;
                if (!this.grid.has(key)) {
                    this.grid.set(key, []);
                }
                this.grid.get(key).push(entity);
            }
        }
    }
    getPotentialColliders(entity) {
        const colliders = new Set();
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
                        if (other !== entity) {
                            colliders.add(other);
                        }
                    }
                }
            }
        }
        return Array.from(colliders);
    }
}
