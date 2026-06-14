import { PrismaClient } from "@prisma/client";
let prisma = null;
if (process.env.DATABASE_URL) {
    prisma = new PrismaClient();
    console.log("Connexion PostgreSQL initialisée avec Prisma.");
}
else {
    console.warn("DATABASE_URL non trouvée dans l'environnement. Utilisation d'une Base de Données simulée en mémoire (Mock).");
}
// Structures simulées en mémoire vive
const memoryDb = {
    users: new Map(),
    characters: new Map(),
    items: new Map(),
    leaderboards: []
};
export const dbService = {
    async findUserByEmail(email) {
        if (prisma)
            return prisma.user.findUnique({ where: { email } });
        return Array.from(memoryDb.users.values()).find(u => u.email === email) || null;
    },
    async findUserByPseudo(pseudo) {
        if (prisma)
            return prisma.user.findUnique({ where: { pseudo } });
        return Array.from(memoryDb.users.values()).find(u => u.pseudo === pseudo) || null;
    },
    async createUser(pseudo, email) {
        if (prisma)
            return prisma.user.create({ data: { pseudo, email } });
        const user = { id: "u_" + Math.random().toString(36).substring(2, 9), pseudo, email, createdAt: new Date() };
        memoryDb.users.set(user.id, user);
        return user;
    },
    async getCharacters(userId) {
        if (prisma)
            return prisma.character.findMany({ where: { userId }, include: { items: true } });
        return Array.from(memoryDb.characters.values())
            .filter(c => c.userId === userId)
            .map(c => ({
            ...c,
            items: Array.from(memoryDb.items.values()).filter(it => it.characterId === c.id)
        }));
    },
    async createCharacter(userId, name, classShape) {
        // Initialise les arbres de compétences d'armes de départ
        const startingWeapons = JSON.stringify({
            ARME1: {
                [classShape === "CIRCLE" ? "DAGGER" : classShape === "SQUARE" ? "MACE" : "SWORD"]: {}
            },
            ARME2: {}
        });
        if (prisma) {
            return prisma.character.create({
                data: {
                    userId,
                    name,
                    classShape,
                    weapons: startingWeapons,
                    level: 1,
                    xp: 0,
                    materials: 100 // Matériaux de départ pour tester la forge
                },
                include: { items: true }
            });
        }
        const character = {
            id: "c_" + Math.random().toString(36).substring(2, 9),
            userId,
            name,
            classShape,
            level: 1,
            xp: 0,
            materials: 100,
            weapons: startingWeapons,
            items: []
        };
        memoryDb.characters.set(character.id, character);
        return character;
    },
    async getCharacterById(id) {
        if (prisma)
            return prisma.character.findUnique({ where: { id }, include: { items: true } });
        const c = memoryDb.characters.get(id);
        if (!c)
            return null;
        return {
            ...c,
            items: Array.from(memoryDb.items.values()).filter(it => it.characterId === c.id)
        };
    },
    async updateCharacter(characterId, data) {
        if (prisma)
            return prisma.character.update({ where: { id: characterId }, data });
        const c = memoryDb.characters.get(characterId);
        if (c) {
            Object.assign(c, data);
        }
        return c;
    },
    async saveItem(item) {
        if (prisma) {
            if (item.id && await prisma.item.findUnique({ where: { id: item.id } })) {
                return prisma.item.update({ where: { id: item.id }, data: item });
            }
            return prisma.item.create({ data: item });
        }
        if (!item.id) {
            item.id = "i_" + Math.random().toString(36).substring(2, 9);
        }
        memoryDb.items.set(item.id, item);
        return item;
    },
    async deleteItem(itemId) {
        if (prisma)
            return prisma.item.delete({ where: { id: itemId } });
        memoryDb.items.delete(itemId);
    },
    async getLeaderboard(bossId, difficulty, playerCount) {
        if (prisma) {
            return prisma.leaderboard.findMany({
                where: { bossId, difficulty, playerCount },
                orderBy: { completionTime: "asc" },
                take: 10
            });
        }
        return memoryDb.leaderboards
            .filter(l => l.bossId === bossId && l.difficulty === difficulty && l.playerCount === playerCount)
            .sort((a, b) => a.completionTime - b.completionTime)
            .slice(0, 10);
    },
    async addLeaderboard(bossId, difficulty, playerCount, completionTime, playerNames) {
        if (prisma) {
            return prisma.leaderboard.create({
                data: { bossId, difficulty, playerCount, completionTime, playerNames }
            });
        }
        const entry = {
            id: "l_" + Math.random().toString(36).substring(2, 9),
            bossId,
            difficulty,
            playerCount,
            completionTime,
            playerNames,
            achievedAt: new Date()
        };
        memoryDb.leaderboards.push(entry);
        return entry;
    }
};
