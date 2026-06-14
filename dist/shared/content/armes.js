import { Arme, WeaponType } from "../core/BaseClasses";
import { GameRegistry } from "../core/GameRegistry";
// ==========================================
// 1. ÉPÉE (DÉGÂTS COMPLETS & RÉGULIERS)
// ==========================================
export class ArmeEpee extends Arme {
    onInit() {
        this.type = WeaponType.SWORD;
        this.autoAttackNode = {
            cooldown: 0.6, // Rapide
            range: 130,
            execute: (server, player, target) => {
                // Le serveur calcule les dégâts et applique une impulsion de projectile linéaire
                server.spawnProjectile({
                    ownerId: player.id,
                    x: player.x,
                    y: player.y,
                    targetX: target.x,
                    targetY: target.y,
                    speed: 450,
                    range: 130,
                    damage: server.calculateWeaponDamage(player, this),
                    width: 8,
                    height: 24,
                    pattern: "LINE"
                });
            }
        };
        this.ultimateNode = {
            manaCost: 60,
            cooldown: 8,
            execute: (server, player) => {
                // Spin whirlwind (8 projectiles dans toutes les directions)
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
                    server.spawnProjectile({
                        ownerId: player.id,
                        x: player.x,
                        y: player.y,
                        angle: a,
                        speed: 350,
                        range: 150,
                        damage: server.calculateWeaponDamage(player, this) * 1.5,
                        width: 12,
                        height: 12,
                        pattern: "LINE"
                    });
                }
            }
        };
    }
}
// ==========================================
// 2. HACHE (LOURD / DE ZONE)
// ==========================================
export class ArmeHache extends Arme {
    onInit() {
        this.type = WeaponType.AXE;
        this.autoAttackNode = {
            cooldown: 1.0, // Lent
            range: 140,
            execute: (server, player, target) => {
                // Envoie 3 projectiles en cône (Cleave)
                const baseAngle = Math.atan2(target.y - player.y, target.x - player.x);
                const angles = [baseAngle - 0.2, baseAngle, baseAngle + 0.2];
                for (const angle of angles) {
                    server.spawnProjectile({
                        ownerId: player.id,
                        x: player.x,
                        y: player.y,
                        angle: angle,
                        speed: 350,
                        range: 140,
                        damage: server.calculateWeaponDamage(player, this) * 1.2,
                        width: 16,
                        height: 16,
                        pattern: "LINE"
                    });
                }
            }
        };
        this.ultimateNode = {
            manaCost: 80,
            cooldown: 12,
            execute: (server, player) => {
                // Slam au sol: on spawn un séisme géant (Zone d'effet temporaire)
                server.spawnAOE({
                    ownerId: player.id,
                    x: player.x,
                    y: player.y,
                    radius: 120,
                    duration: 3,
                    tickRate: 0.5,
                    damagePerTick: server.calculateWeaponDamage(player, this) * 0.8
                });
            }
        };
    }
}
// ==========================================
// 3. DAGUE (CRITIQUE / RAPIDE)
// ==========================================
export class ArmeDague extends Arme {
    onInit() {
        this.type = WeaponType.DAGGER;
        this.autoAttackNode = {
            cooldown: 0.35, // Très rapide
            range: 100, // Courte portée
            execute: (server, player, target) => {
                // Projectile ultra-rapide et fin
                server.spawnProjectile({
                    ownerId: player.id,
                    x: player.x,
                    y: player.y,
                    targetX: target.x,
                    targetY: target.y,
                    speed: 600,
                    range: 100,
                    damage: server.calculateWeaponDamage(player, this) * 0.7,
                    width: 4,
                    height: 16,
                    pattern: "LINE"
                });
            }
        };
        this.ultimateNode = {
            manaCost: 100,
            cooldown: 15,
            execute: (server, player) => {
                // Éruption de dagues (16 tirs circulaires)
                for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
                    server.spawnProjectile({
                        ownerId: player.id,
                        x: player.x,
                        y: player.y,
                        angle: a,
                        speed: 500,
                        range: 180,
                        damage: server.calculateWeaponDamage(player, this) * 1.3,
                        width: 6,
                        height: 16,
                        pattern: "LINE"
                    });
                }
            }
        };
    }
}
// ==========================================
// 4. MASSE (SOUTIEN / VIE)
// ==========================================
export class ArmeMasse extends Arme {
    onInit() {
        this.type = WeaponType.MACE;
        this.autoAttackNode = {
            cooldown: 0.9,
            range: 120,
            execute: (server, player, target) => {
                // Lourd coup direct qui inflige des dégâts et soigne le joueur du montant de son Bonus au Soin
                server.spawnProjectile({
                    ownerId: player.id,
                    x: player.x,
                    y: player.y,
                    targetX: target.x,
                    targetY: target.y,
                    speed: 300,
                    range: 120,
                    damage: server.calculateWeaponDamage(player, this) * 1.1,
                    width: 20,
                    height: 20,
                    pattern: "LINE"
                });
                // Soin personnel
                const healAmount = 5 + (player.getStat("HEALING_BONUS") || 0);
                player.heal(healAmount);
            }
        };
        this.ultimateNode = {
            manaCost: 70,
            cooldown: 10,
            execute: (server, player) => {
                // Aura sacrée de soin autour du joueur
                server.spawnHealAura({
                    ownerId: player.id,
                    x: player.x,
                    y: player.y,
                    radius: 150,
                    duration: 4,
                    healPerSecond: 10 + (player.getStat("HEALING_BONUS") || 0)
                });
            }
        };
    }
}
// Enregistrement
GameRegistry.registerArme("SWORD", ArmeEpee);
GameRegistry.registerArme("AXE", ArmeHache);
GameRegistry.registerArme("DAGGER", ArmeDague);
GameRegistry.registerArme("MACE", ArmeMasse);
