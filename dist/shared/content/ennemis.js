import { Ennemi } from "../core/BaseClasses";
import { Stat } from "../core/Stats";
import { GameRegistry } from "../core/GameRegistry";
// ==========================================
// 1. MONSTRE DE BASE : ZOMBIE BASIQUE
// ==========================================
export class ZombieBasique extends Ennemi {
    onInit() {
        this.name = "Zombie Basique";
        this.radius = 16;
        this.hp = 50;
        this.maxHp = 50;
        this.expReward = 15;
        this.stats.set(Stat.MOVEMENT_SPEED, 80);
    }
    onServerUpdate(dt, target, server) {
        // Suit bêtement le joueur ciblé
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            const speed = this.getStat(Stat.MOVEMENT_SPEED);
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        }
        else {
            this.vx = 0;
            this.vy = 0;
            // Dégâts de mêlée par seconde
            server.applyMeleeDamage(this, target, 10 * dt);
        }
    }
}
// ==========================================
// 2. MONSTRE RAPIDE : CHASSEUR GÉOMÉTRIQUE
// ==========================================
export class ZombieRapide extends Ennemi {
    onInit() {
        this.name = "Chasseur Véloce";
        this.radius = 12;
        this.hp = 30;
        this.maxHp = 30;
        this.expReward = 20;
        this.stats.set(Stat.MOVEMENT_SPEED, 160); // Très rapide
    }
    onServerUpdate(dt, target, server) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 5) {
            const speed = this.getStat(Stat.MOVEMENT_SPEED);
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        }
        else {
            this.vx = 0;
            this.vy = 0;
            server.applyMeleeDamage(this, target, 12 * dt);
        }
    }
}
// ==========================================
// 3. DEMI-BOSS 1 : LE GARDIEN ROUGE (DONNE UNE CLÉ)
// ==========================================
export class DemiBossRouge extends Ennemi {
    fireCooldown = 0;
    onInit() {
        this.name = "Gardien Rouge";
        this.radius = 28;
        this.hp = 350;
        this.maxHp = 350;
        this.expReward = 100;
        this.stats.set(Stat.MOVEMENT_SPEED, 60);
    }
    onServerUpdate(dt, target, server) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Mouvement d'approche lent
        if (dist > 80) {
            const speed = this.getStat(Stat.MOVEMENT_SPEED);
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        }
        else {
            this.vx = 0;
            this.vy = 0;
        }
        // Tir de projectiles périodique (toutes les 1.5s)
        this.fireCooldown += dt;
        if (this.fireCooldown >= 1.5) {
            this.fireCooldown = 0;
            // Tire 3 projectiles en arc vers le joueur
            const baseAngle = Math.atan2(dy, dx);
            for (let offset = -0.3; offset <= 0.3; offset += 0.3) {
                server.spawnMonsterProjectile({
                    ownerId: this.id,
                    x: this.x,
                    y: this.y,
                    angle: baseAngle + offset,
                    speed: 250,
                    damage: 15,
                    radius: 8
                });
            }
        }
    }
}
// ==========================================
// 4. DEMI-BOSS 2 : LE GARDIEN BLEU (DONNE LA 2ÈME CLÉ)
// ==========================================
export class DemiBossBleu extends Ennemi {
    fireCooldown = 0;
    onInit() {
        this.name = "Gardien Bleu";
        this.radius = 28;
        this.hp = 350;
        this.maxHp = 350;
        this.expReward = 100;
        this.stats.set(Stat.MOVEMENT_SPEED, 65);
    }
    onServerUpdate(dt, target, server) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 80) {
            const speed = this.getStat(Stat.MOVEMENT_SPEED);
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        }
        else {
            this.vx = 0;
            this.vy = 0;
        }
        // Lance un pattern de projectiles en forme de croix à intervalle de 2s
        this.fireCooldown += dt;
        if (this.fireCooldown >= 2.0) {
            this.fireCooldown = 0;
            for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
                server.spawnMonsterProjectile({
                    ownerId: this.id,
                    x: this.x,
                    y: this.y,
                    angle: a,
                    speed: 200,
                    damage: 18,
                    radius: 10
                });
            }
        }
    }
}
// ==========================================
// 5. BOSS FINAL : L'HYPER-OCTOGONE
// ==========================================
export class LeBossFinal extends Ennemi {
    phase = 1;
    attackCooldown = 0;
    currentPattern = 0;
    onInit() {
        this.name = "L'Hyper-Octogone";
        this.radius = 50;
        this.hp = 1200;
        this.maxHp = 1200;
        this.expReward = 500;
        this.stats.set(Stat.MOVEMENT_SPEED, 45); // Très lent
    }
    onServerUpdate(dt, target, server) {
        const dx = target.x - this.x;
        const dy = target.y - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Mouvement constant vers la cible
        if (dist > 5) {
            const speed = this.getStat(Stat.MOVEMENT_SPEED);
            this.vx = (dx / dist) * speed;
            this.vy = (dy / dist) * speed;
        }
        // Gestion des phases selon les PV
        const lifeRatio = this.hp / this.maxHp;
        if (lifeRatio <= 0.33) {
            this.phase = 3;
        }
        else if (lifeRatio <= 0.66) {
            this.phase = 2;
        }
        // Attaques cycliques (Bullet Hell)
        this.attackCooldown += dt;
        const rate = this.phase === 3 ? 2.5 : this.phase === 2 ? 3.5 : 4.5; // Plus rapide en P3
        if (this.attackCooldown >= rate) {
            this.attackCooldown = 0;
            this.currentPattern = (this.currentPattern + 1) % 2;
            if (this.currentPattern === 0) {
                // Pattern 1: Spirale de tirs
                // Le serveur ordonne aux clients de simuler la spirale localement
                server.broadcastBulletPattern({
                    bossId: this.id,
                    patternType: "SPIRAL",
                    originX: this.x,
                    originY: this.y,
                    duration: 3,
                    speed: 180,
                    damage: 20,
                    bulletCount: this.phase === 3 ? 60 : 40
                });
            }
            else {
                // Pattern 2: Vagues radiales expansives
                server.broadcastBulletPattern({
                    bossId: this.id,
                    patternType: "RADIAL",
                    originX: this.x,
                    originY: this.y,
                    duration: 2.5,
                    speed: 150,
                    damage: 25,
                    bulletCount: this.phase === 3 ? 32 : 24
                });
            }
        }
    }
}
// Enregistrements
GameRegistry.registerEnnemi("zombie", ZombieBasique);
GameRegistry.registerEnnemi("speedy", ZombieRapide);
GameRegistry.registerEnnemi("miniboss_red", DemiBossRouge);
GameRegistry.registerEnnemi("miniboss_blue", DemiBossBleu);
GameRegistry.registerEnnemi("boss", LeBossFinal);
