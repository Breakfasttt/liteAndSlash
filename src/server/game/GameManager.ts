import { ConnectedClient } from "../lobby";
import { GameInstance } from "./GameInstance";
import { MsgType, WSMessage } from "../../shared/types/network";
import { WebSocket } from "ws";

export class GameManager {
  private static instances = new Map<string, GameInstance>(); // gameId -> GameInstance
  private static playerToGame = new Map<string, string>(); // userId -> gameId

  public static async createGameInstance(clients: ConnectedClient[], bossId: string, difficulty: string) {
    const gameId = "g_" + Math.random().toString(36).substring(2, 9);
    const seed = Math.floor(Math.random() * 1000000);

    console.log(`Lancement de l'instance ${gameId} (Boss: ${bossId}, Diff: ${difficulty}) pour ${clients.length} joueurs.`);

    const instance = new GameInstance(gameId, seed, bossId, difficulty, clients);
    this.instances.set(gameId, instance);

    for (const c of clients) {
      this.playerToGame.set(c.userId, gameId);
      
      // Assigner des listeners spécifiques pour les inputs
      c.ws.removeAllListeners("message");
      c.ws.on("message", (data) => {
        try {
          const msg: WSMessage = JSON.parse(data.toString());
          this.routeGameMessage(c.ws, c.userId, gameId, msg);
        } catch (e) {
          console.error("Erreur de parsing de message de run:", e);
        }
      });

      // Gérer la déconnexion pendant la run
      c.ws.removeAllListeners("close");
      c.ws.on("close", () => {
        this.handlePlayerDisconnect(c.userId, gameId);
      });
    }

    // Initialiser et démarrer la boucle autoritaire de tick de l'instance
    await instance.start();
  }

  private static routeGameMessage(ws: WebSocket, userId: string, gameId: string, msg: WSMessage) {
    const instance = this.instances.get(gameId);
    if (!instance) return;

    if (msg.type === MsgType.C2S_INPUT) {
      instance.handlePlayerInput(userId, msg.payload);
    } else if (msg.type === MsgType.C2S_CRAFT_ACTION) {
      // Routé vers la forge/crafting
      instance.handleCraftAction(userId, msg.payload, ws);
    } else if (msg.type === MsgType.C2S_TALENT_UNLOCK) {
      instance.handleTalentAction(userId, msg.payload, ws);
    }
  }

  private static handlePlayerDisconnect(userId: string, gameId: string) {
    const instance = this.instances.get(gameId);
    if (instance) {
      instance.markPlayerDisconnected(userId);
    }
  }

  public static removeGameInstance(gameId: string) {
    const instance = this.instances.get(gameId);
    if (instance) {
      // Libérer les mappings joueurs
      for (const p of instance.players.values()) {
        this.playerToGame.delete(p.userId);
      }
      this.instances.delete(gameId);
      console.log(`Instance ${gameId} détruite et nettoyée de la mémoire.`);
    }
  }

  // Tente de reconnecter un joueur
  public static handleReconnection(ws: WebSocket, userId: string, pseudo: string): boolean {
    const gameId = this.playerToGame.get(userId);
    if (!gameId) return false;

    const instance = this.instances.get(gameId);
    if (!instance) return false;

    console.log(`Reconnexion détectée pour le joueur ${pseudo} (${userId}) dans la run ${gameId}.`);
    
    // Ré-attacher les listeners WS
    ws.on("message", (data) => {
      try {
        const msg: WSMessage = JSON.parse(data.toString());
        this.routeGameMessage(ws, userId, gameId, msg);
      } catch (e) {
        console.error("Erreur de parsing reconnexion run:", e);
      }
    });

    ws.on("close", () => {
      this.handlePlayerDisconnect(userId, gameId);
    });

    // Signaler à l'instance
    instance.reconnectPlayer(userId, ws);
    return true;
  }
}
