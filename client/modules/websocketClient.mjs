import { EasyEncrypt } from "../libs/encryption.mjs";

import { WebSocket } from "ws";
import axios from "axios";

export async function main(clientIPAddr, clientID, ports, usersDB, clientDB, portForwardDB, sessionTokens) {
  console.log(typeof clientID, clientID);
  const clientFound = await clientDB.findOne({
    refID: parseInt(clientID)
  });

  if (!clientFound) throw new Error("Client not found");
  const portsReq = await axios.get(clientFound.url + "/api/v1/ports");
  const portsRes = portsReq.data.ports;

  // FIXME: This will cause problems later. But currently later is not right now.
  const ws = new WebSocket(clientIPAddr.replace("http", "ws").replace(portsRes.http, portsRes.websocket));

  ws.addEventListener("open", async() => {
    ws.isReady = false;

    ws.encryption = new EasyEncrypt(clientFound.serverPublicKey, clientFound.selfPrivateKey, "");
    await ws.encryption.init();

    const encryptedChallenge = btoa(await ws.encryption.encrypt("CHALLENGE", "text"));
    ws.send(`EXPLAIN ${clientID} ${encryptedChallenge}`);
    
    ws.addEventListener("message", async(msg) => {
      const decryptedMsg = await ws.encryption.decrypt(msg);
      const msgString = decryptedMsg.toString();

      if (msgString == "SUCCESS") {
        // Start sending our garbage
        for (const port of ports) {
          ws.send(btoa(await ws.encryption.encrypt(JSON.stringify({
            type: "listenNotifRequest",
            port: port.destPort
          }))));
        }
      }
    });
  });
}