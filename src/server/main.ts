import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import path from "path";
import { authRouter, verifyToken } from "./auth";
import { dbService } from "./database";
import { LobbyServer } from "./lobby";
import { GameManager } from "./game/GameManager";
import { MsgType, WSMessage } from "../shared/types/network";
import "../shared/content"; // Force l'initialisation du GameRegistry

const app = express();
app.use(express.json());

// Activer le CORS basique pour le développement
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});

// Router API
app.use("/api/auth", authRouter);

// API Personnage
app.post("/api/characters", async (req, res) => {
  try {
    const { userId, name, classShape } = req.body;
    if (!userId || !name || !classShape) {
      return res.status(400).json({ error: "Champs userId, name et classShape requis" });
    }
    const character = await dbService.createCharacter(userId, name, classShape);
    res.json(character);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// API Équiper / Déséquiper
app.post("/api/characters/equip", async (req, res) => {
  try {
    const { characterId, itemId, slot, action } = req.body; // action: "EQUIP" | "UNEQUIP"
    const character = await dbService.getCharacterById(characterId);
    if (!character) return res.status(404).json({ error: "Personnage non trouvé" });

    const items = character.items as any[];
    const item = items.find(it => it.id === itemId);
    if (!item) return res.status(404).json({ error: "Item non trouvé" });

    if (action === "EQUIP") {
      // Déséquiper l'ancien item du même slot s'il y en a un
      const currentlyEquipped = items.find(it => it.slot === slot && it.isEquipped);
      if (currentlyEquipped) {
        currentlyEquipped.isEquipped = false;
        await dbService.saveItem(currentlyEquipped);
      }
      item.isEquipped = true;
      item.slot = slot;
    } else {
      item.isEquipped = false;
    }

    await dbService.saveItem(item);
    
    // Renvoyer les données à jour
    const updated = await dbService.getCharacterById(characterId);
    res.json(updated);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Servir le build de production frontend
const clientPath = path.join(__dirname, "../client");
app.use(express.static(clientPath));

// Point d'entrée pour SPA
app.get("*", (req, res) => {
  res.sendFile(path.join(clientPath, "index.html"));
});

// Créer le serveur HTTP et WebSocket attaché
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws: WebSocket) => {
  console.log("Nouvelle connexion WebSocket établie.");

  // On écoute le premier message pour aiguiller vers le Lobby (Hub) ou la Reconnexion de Run
  ws.once("message", async (data) => {
    try {
      const msg: WSMessage = JSON.parse(data.toString());
      if (msg.type === MsgType.C2S_CONNECT) {
        const token = msg.payload.token;
        const payload = verifyToken(token);
        if (payload) {
          // 1. Tenter la reconnexion à une run active
          const reconnected = GameManager.handleReconnection(ws, payload.id, payload.pseudo);
          if (reconnected) {
            return;
          }
        }
      }

      // 2. Si pas de run active, on renvoie vers le Lobby standard
      LobbyServer.handleConnection(ws);
      // Réinjecter ce premier message de connexion pour le lobby
      ws.emit("message", data);
    } catch (e) {
      console.error("Erreur d'aiguillage du socket:", e);
      ws.close();
    }
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`===================================================`);
  console.log(`   liteAndSlash SERVEUR DÉMARRÉ SUR LE PORT ${PORT}`);
  console.log(`   Hub WebSocket & Instances de Jeu Actifs`);
  console.log(`===================================================`);
});
