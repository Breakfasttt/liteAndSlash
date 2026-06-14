import { WebSocket } from "ws";
import { MsgType, WSMessage } from "../shared/types/network";
import { verifyToken } from "./auth";
import { dbService } from "./database";
import { GameManager } from "./game/GameManager";

export interface ConnectedClient {
  ws: WebSocket;
  userId: string;
  pseudo: string;
  characterId?: string;
  partyId?: string;
}

export class LobbyServer {
  private static clients = new Map<WebSocket, ConnectedClient>();
  private static matchmakingQueues = new Map<string, string[]>(); // key: "bossId_difficulty" -> Array of client userId
  private static parties = new Map<string, { leaderId: string; members: string[] }>(); // partyId -> Party details

  public static handleConnection(ws: WebSocket) {
    ws.on("message", async (data) => {
      try {
        const msg: WSMessage = JSON.parse(data.toString());
        await this.handleMessage(ws, msg);
      } catch (e) {
        console.error("Erreur parsing message WS Hub:", e);
      }
    });

    ws.on("close", () => {
      this.handleDisconnect(ws);
    });
  }

  private static async handleMessage(ws: WebSocket, msg: WSMessage) {
    console.log(`[WS Hub Rcv] MsgType: ${msg.type}`);
    const client = this.clients.get(ws);

    switch (msg.type) {
      case MsgType.C2S_CONNECT: {
        const tokenPayload = verifyToken(msg.payload.token);
        if (!tokenPayload) {
          ws.send(JSON.stringify({ type: MsgType.C2S_CHAT, payload: { sender: "Système", channel: "Général", text: "Connexion échouée : Token invalide" } }));
          ws.close();
          return;
        }

        // Création de la structure client connecté
        const newClient: ConnectedClient = {
          ws,
          userId: tokenPayload.id,
          pseudo: tokenPayload.pseudo
        };
        this.clients.set(ws, newClient);

        // Envoyer confirmation et charger les personnages
        const characters = await dbService.getCharacters(tokenPayload.id);
        ws.send(JSON.stringify({
          type: MsgType.S2C_CONNECT_OK,
          payload: {
            user: { id: tokenPayload.id, pseudo: tokenPayload.pseudo },
            characters
          }
        }));

        this.broadcastHubState();
        this.broadcastSystemMessage(`${tokenPayload.pseudo} a rejoint le Hub.`);
        break;
      }

      case MsgType.C2S_SELECT_CHARACTER: {
        if (!client) return;
        const charId = msg.payload.characterId;
        const character = await dbService.getCharacterById(charId);
        if (character) {
          client.characterId = charId;
          ws.send(JSON.stringify({
            type: MsgType.S2C_CHARACTER_UPDATE,
            payload: { character }
          }));
          this.broadcastHubState();
        }
        break;
      }

      case MsgType.C2S_CHAT: {
        if (!client) return;
        const { channel, text, targetPseudo } = msg.payload;

        if (channel === "Général") {
          this.broadcastMessage(client.pseudo, text, "Général");
        } else if (channel === "Groupe" && client.partyId) {
          this.broadcastToParty(client.partyId, client.pseudo, text);
        } else if (channel === "Murmure" && targetPseudo) {
          this.sendWhisper(client, targetPseudo, text);
        }
        break;
      }

      case MsgType.C2S_JOIN_MATCHMAKING: {
        console.log(`C2S_JOIN_MATCHMAKING reçu. Client pseudo: ${client ? client.pseudo : 'null'}, characterId: ${client ? client.characterId : 'null'}`);
        if (!client || !client.characterId) {
          console.warn(`Lancement de matchmaking annulé: client ou characterId manquant.`);
          return;
        }
        const { bossId, difficulty, launchSolo } = msg.payload;
        
        if (launchSolo) {
          // Lancement immédiat en solo
          await GameManager.createGameInstance([client], bossId, difficulty);
          return;
        }

        // Sinon matchmaking public
        const queueKey = `${bossId}_${difficulty}`;
        if (!this.matchmakingQueues.has(queueKey)) {
          this.matchmakingQueues.set(queueKey, []);
        }
        const queue = this.matchmakingQueues.get(queueKey)!;
        if (!queue.includes(client.userId)) {
          queue.push(client.userId);
        }

        // Si on a assez de monde (ex: 4 joueurs max, mais pour le MVP on lance à 2 ou sur bouton forcer)
        // Pour simplifier le MVP, on envoie le statut à tous les inscrits de la file
        this.broadcastMatchmakingStatus(queueKey);
        
        // Lancement auto si file pleine (ex: 4 joueurs)
        if (queue.length >= 4) {
          this.triggerQueueStart(queueKey);
        }
        break;
      }

      case MsgType.C2S_LEAVE_MATCHMAKING: {
        if (!client) return;
        const { bossId, difficulty } = msg.payload;
        const queueKey = `${bossId}_${difficulty}`;
        const queue = this.matchmakingQueues.get(queueKey);
        if (queue) {
          const idx = queue.indexOf(client.userId);
          if (idx !== -1) {
            queue.splice(idx, 1);
            this.broadcastMatchmakingStatus(queueKey);
          }
        }
        break;
      }

      // SOCIAL & GROUPE
      case MsgType.C2S_PARTY_INVITE: {
        if (!client) return;
        const targetPseudo = msg.payload.targetPseudo;
        const targetClient = Array.from(this.clients.values()).find(c => c.pseudo === targetPseudo);
        if (targetClient) {
          targetClient.ws.send(JSON.stringify({
            type: MsgType.C2S_PARTY_INVITE,
            payload: { fromPseudo: client.pseudo }
          }));
        } else {
          ws.send(JSON.stringify({
            type: MsgType.S2C_CHAT,
            payload: { sender: "Système", channel: "Général", text: `Joueur ${targetPseudo} non trouvé.` }
          }));
        }
        break;
      }

      case MsgType.C2S_PARTY_ACCEPT: {
        if (!client) return;
        const hostPseudo = msg.payload.hostPseudo;
        const hostClient = Array.from(this.clients.values()).find(c => c.pseudo === hostPseudo);
        if (hostClient) {
          // Créer ou rejoindre la party
          let partyId = hostClient.partyId;
          if (!partyId) {
            partyId = "p_" + Math.random().toString(36).substring(2, 9);
            hostClient.partyId = partyId;
            this.parties.set(partyId, { leaderId: hostClient.userId, members: [hostClient.userId] });
          }

          const party = this.parties.get(partyId)!;
          if (party.members.length < 4 && !party.members.includes(client.userId)) {
            party.members.push(client.userId);
            client.partyId = partyId;
          }

          this.broadcastPartyUpdate(partyId);
        }
        break;
      }
    }
  }

  private static triggerQueueStart(queueKey: string) {
    const queue = this.matchmakingQueues.get(queueKey);
    if (!queue || queue.length === 0) return;
    
    const [bossId, difficulty] = queueKey.split("_");
    const matchedClients = Array.from(this.clients.values())
      .filter(c => queue.includes(c.userId) && c.characterId !== undefined);

    // Vider la file
    this.matchmakingQueues.set(queueKey, []);

    // Lancer la partie
    GameManager.createGameInstance(matchedClients, bossId, difficulty);
  }

  private static handleDisconnect(ws: WebSocket) {
    const client = this.clients.get(ws);
    if (client) {
      this.clients.delete(ws);
      this.broadcastSystemMessage(`${client.pseudo} a quitté le Hub.`);
      this.broadcastHubState();
      
      // Nettoyer matchmaking
      for (const [key, queue] of this.matchmakingQueues.entries()) {
        const idx = queue.indexOf(client.userId);
        if (idx !== -1) {
          queue.splice(idx, 1);
          this.broadcastMatchmakingStatus(key);
        }
      }
    }
  }

  // DIFFUSION COMMUNE
  private static broadcastMessage(sender: string, text: string, channel: string) {
    const message = JSON.stringify({
      type: MsgType.S2C_CHAT,
      payload: { sender, channel, text }
    });
    for (const c of this.clients.values()) {
      c.ws.send(message);
    }
  }

  private static broadcastSystemMessage(text: string) {
    this.broadcastMessage("Système", text, "Général");
  }

  private static broadcastHubState() {
    const list = Array.from(this.clients.values()).map(c => ({
      userId: c.userId,
      pseudo: c.pseudo,
      characterId: c.characterId,
      inParty: c.partyId !== undefined
    }));
    const payload = JSON.stringify({ type: MsgType.S2C_HUB_STATE, payload: list });
    for (const c of this.clients.values()) {
      c.ws.send(payload);
    }
  }

  private static broadcastMatchmakingStatus(queueKey: string) {
    const queue = this.matchmakingQueues.get(queueKey)!;
    const list = Array.from(this.clients.values()).filter(c => queue.includes(c.userId));
    const message = JSON.stringify({
      type: MsgType.S2C_MATCHMAKING_STATUS,
      payload: { queueKey, count: queue.length, members: list.map(c => c.pseudo) }
    });
    for (const c of list) {
      c.ws.send(message);
    }
  }

  private static broadcastPartyUpdate(partyId: string) {
    const party = this.parties.get(partyId);
    if (!party) return;
    const list = Array.from(this.clients.values()).filter(c => party.members.includes(c.userId));
    const message = JSON.stringify({
      type: MsgType.S2C_PARTY_UPDATE,
      payload: { partyId, leaderId: party.leaderId, members: list.map(c => ({ pseudo: c.pseudo, userId: c.userId })) }
    });
    for (const c of list) {
      c.ws.send(message);
    }
  }

  private static broadcastToParty(partyId: string, sender: string, text: string) {
    const party = this.parties.get(partyId);
    if (!party) return;
    const message = JSON.stringify({
      type: MsgType.S2C_CHAT,
      payload: { sender, channel: "Groupe", text }
    });
    for (const c of this.clients.values()) {
      if (party.members.includes(c.userId)) {
        c.ws.send(message);
      }
    }
  }

  private static sendWhisper(client: ConnectedClient, targetPseudo: string, text: string) {
    const target = Array.from(this.clients.values()).find(c => c.pseudo === targetPseudo);
    if (target) {
      const message = JSON.stringify({
        type: MsgType.S2C_CHAT,
        payload: { sender: client.pseudo, channel: "Murmure", text }
      });
      target.ws.send(message);
      client.ws.send(message);
    } else {
      client.ws.send(JSON.stringify({
        type: MsgType.S2C_CHAT,
        payload: { sender: "Système", channel: "Général", text: `Destinataire ${targetPseudo} hors-ligne.` }
      }));
    }
  }
}
