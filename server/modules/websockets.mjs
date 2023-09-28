import { strict as assert } from "node:assert";

import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import * as tcp from "../modules/tcp.mjs";

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

        ws.encryption = new SymmEasyEncrypt(dbSearch.password, "text");
        const decryptedChallenge = await ws.encryption.decrypt(msgSplit[2], "text");
        if (decryptedChallenge != "CHALLENGE") return ws.close();
        
        ws.hasSpecifiedReason = true;
        ws.send(await ws.encryption.encrypt("SUCCESS", "text"));
        return;
      }

      const decryptedMessage = await ws.encryption.decrypt(msg.data, "text");
      const msgData = JSON.parse(decryptedMessage);

      switch (msgData.type) {
        case "listenNotifRequest": {
          assert.equal(msgData.protocol, "TCP", "Unsupported protocol");
          console.log("Bringing up port '%s' for protocol '%s'", msgData.port, msgData.protocol);
          
          tcp.setUpConn(ws.keyData.refID, async(socketID) => ws.send(await ws.encryption.encrypt(JSON.stringify({
            type: "connection",
            protocol: msgData.protocol,
            socketID: socketID,
            port: msgData.port
          }), "text")), msgData.port, config, db);
          break;
        }
      }
    });
  });
}