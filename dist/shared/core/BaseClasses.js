// ==========================================
// 1. ENTITÉ DE BASE (PHYSIC & HEALTH)
// ==========================================
export class Entity {
    id = "";
    x = 0;
    y = 0;
    vx = 0;
    vy = 0;
    radius = 16;
    hp = 100;
    maxHp = 100;
    isDead = false;
    // Permet de lire n'importe quelle statistique finale après application du calculator
    getStat(stat) {
        return 0; // Surchargé par Player / Mob
    }
}
export class TalentNode {
    id;
    name;
    description;
    maxPoints;
    currentPoints = 0;
    modifiers;
    dependencies;
    onWeaponCrit;
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.description = config.description;
        this.maxPoints = config.maxPoints;
        this.modifiers = config.modifiers;
        this.dependencies = config.dependencies || [];
        this.onWeaponCrit = config.onWeaponCrit;
    }
}
export class TalentTree {
    nodes;
    constructor(nodes) {
        this.nodes = nodes;
    }
    getNode(id) {
        return this.nodes.find(n => n.id === id);
    }
}
export class Classe {
    shape = "CIRCLE";
    baseColor = 0xffffff;
    baseStats = {};
    talentTree = new TalentTree([]);
}
export class Salle {
    id = "";
    type = "MOB";
    name = "";
    isCleared = false;
    // Rendu et géométrie
    shape = "SQUARE";
    x = 0; // Coordonnées absolues dans le monde
    y = 0;
    width = 800; // Pour SQUARE
    height = 800; // Pour SQUARE
    radius = 400; // Pour CIRCLE
    obstacles = [];
    // Portes d'accès aux salles adjacentes (Nord, Sud, Est, Ouest)
    doors = {};
}
// ==========================================
// 4. ARMES ET COMPÉTENCES D'ARMES
// ==========================================
export var WeaponType;
(function (WeaponType) {
    WeaponType["SWORD"] = "SWORD";
    WeaponType["AXE"] = "AXE";
    WeaponType["DAGGER"] = "DAGGER";
    WeaponType["MACE"] = "MACE";
})(WeaponType || (WeaponType = {}));
export class Arme {
    type = WeaponType.SWORD;
    autoAttackNode;
    ultimateNode;
}
// ==========================================
// 5. ENEMIS IA
// ==========================================
export class Ennemi extends Entity {
    name = "";
    stats = new Map();
    expReward = 10;
    getStat(stat) {
        return this.stats.get(stat) || 0;
    }
}
