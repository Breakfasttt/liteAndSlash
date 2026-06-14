import { Router } from "express";
import { dbService } from "./database";

export const authRouter = Router();

// Générateur de token simple basé sur Base64 (évite l'overhead d'une clé JWT secrète pour le MVP local)
export function generateToken(payload: { id: string; pseudo: string }): string {
  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

export function verifyToken(token: string): { id: string; pseudo: string } | null {
  try {
    const str = Buffer.from(token, "base64").toString("utf-8");
    return JSON.parse(str);
  } catch (e) {
    return null;
  }
}

// Générateur de tag unique à 5 chiffres
async function generateUniquePseudo(basePseudo: string): Promise<string> {
  let attempts = 0;
  while (attempts < 100) {
    const num = Math.floor(10000 + Math.random() * 90000);
    const pseudo = `${basePseudo}#${num}`;
    const existing = await dbService.findUserByPseudo(pseudo);
    if (!existing) {
      return pseudo;
    }
    attempts++;
  }
  return `${basePseudo}#${Math.floor(10000 + Math.random() * 90000)}`;
}

// 1. CONNEXION INVITÉ (GUEST)
authRouter.post("/guest", async (req, res) => {
  try {
    const baseName = req.body.pseudo || "Joueur";
    const pseudo = await generateUniquePseudo(baseName);
    const user = await dbService.createUser(pseudo);
    const token = generateToken({ id: user.id, pseudo: user.pseudo });
    res.json({ token, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. CONNEXION PAR TIERS SIMULÉE
authRouter.post("/login-provider", async (req, res) => {
  try {
    const { pseudo: basePseudo, email, provider } = req.body; // Discord, Google, Magic Link
    if (!basePseudo) {
      return res.status(400).json({ error: "Pseudo requis" });
    }

    // Recherche si un utilisateur avec cet email existe déjà
    let user = email ? await dbService.findUserByEmail(email) : null;
    
    if (!user) {
      // S'il n'existe pas, on lui crée son pseudo taggé
      const pseudo = await generateUniquePseudo(basePseudo);
      user = await dbService.createUser(pseudo, email);
    }

    const token = generateToken({ id: user.id, pseudo: user.pseudo });
    res.json({ token, user });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
