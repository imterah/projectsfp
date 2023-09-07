import { EasyEncrypt } from "../libs/encryption.mjs";

import { WebSocketServer } from "ws";

export async function main(config, db) {
  const wss = new WebSocketServer({
    port: config.ports.websocket
  });

  wss.on("connection", async(ws) => {
    ws.addEventListener("message", async(msg) => {
      if (!ws.hasSpecifiedReason) {
        if (!msg.startsWith("EXPLAIN ")) return ws.close();

        const msgSplit = msg.split(" ");
        const dbSearch = await db.findOne({
          refID: parseInt(msgSplit[1]) 
        });

        if (!dbSearch) return ws.close();

        ws.keyData = dbSearch;
        ws.encryption = new EasyEncrypt(dbSearch.userPublicKey, dbSearch.selfPrivateKey, "");
        await ws.encryption.init();

        const decryptedChallenge = await ws.encryption.decrypt(atob(msgSplit[2]), "text"); 
        if (decryptedChallenge != "CHALLENGE") return ws.close();

        return hasSpecifiedReason = true;
      }

      const decryptedMessage = await ws.encryption.decrypt(msg);
      
    });
  });
}