import { EasyEncrypt } from "../libs/encryption.mjs";

import { WebSocketServer } from "ws";

export async function main(config, db) {
  const wss = new WebSocketServer({
    port: config.ports.websocket
  });

  console.log("WebSocket Server listening on ::" + config.ports.websocket); 

  wss.on("connection", async(ws) => {
    ws.addEventListener("message", async(msg) => {
      if (!ws.hasSpecifiedReason) {
        const msgString = msg.data;
        if (!msgString.startsWith("EXPLAIN ")) return ws.close();

        const msgSplit = msgString.split(" ");
        const dbSearch = await db.findOne({
          refID: parseInt(msgSplit[1]) 
        });

        if (!dbSearch) return ws.close();
        ws.keyData = dbSearch;

        ws.encryption = new EasyEncrypt(dbSearch.userPublicKey, dbSearch.selfPrivateKey, "");
        await ws.encryption.init();

        const decryptedChallenge = await ws.encryption.decrypt(atob(msgSplit[2]), "text");
        if (decryptedChallenge != "CHALLENGE") return ws.close();
        
        ws.hasSpecifiedReason = true;
        return;
      }

      const decryptedMessage = await ws.encryption.decrypt(atob(msg.data));
      const msgData = JSON.parse(decryptedMessage);

      switch (msgData.type) {
        case "listenNotifRequest": {
          // TODO
          break;
        }
      }
    });
  });
}