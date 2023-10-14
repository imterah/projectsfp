import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import * as tcp from "../modules/tcp.mjs";
import * as udp from "../modules/udp.mjs";

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

        const encRounds = parseInt(msgSplit[2]);

        ws.encryption = new SymmEasyEncrypt(dbSearch.password, "text", encRounds);
        const decryptedChallenge = ws.encryption.decrypt(msgSplit[3], "text");
        if (decryptedChallenge != "CHALLENGE") return ws.close();
        
        ws.hasSpecifiedReason = true;
        ws.send(ws.encryption.encrypt("SUCCESS", "text"));
        return;
      }

      const decryptedMessage = ws.encryption.decrypt(msg.data, "text");
      const msgData = JSON.parse(decryptedMessage);

      switch (msgData.type) {
        case "listenNotifRequest": {
          console.log("Bringing up port '%s' for protocol '%s'", msgData.port, msgData.protocol);

          if (msgData.protocol == "TCP") {
            tcp.setUpConn(ws.keyData.refID, async(socketID, port, ip) => ws.send(ws.encryption.encrypt(JSON.stringify({
              type: "connection",
              protocol: msgData.protocol,
              socketID: socketID,
              port: msgData.port,
              ip: ip
            }), "text")), msgData.port, config, db);
          } else if (msgData.protocol == "UDP") {
            udp.setUpConn(ws.keyData.refID, msgData.port, config, db);
          } else {
            console.error("Unsupported protocol:", msgData.protocol);
          }
          
          break;
        }
      }
    });
  });
}