import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import * as tcp from "./tcpClient.mjs";
import * as udp from "./udpClient.mjs";

import { WebSocket } from "ws";
import axios from "axios";

export async function main(clientIPAddr, clientID, ports, usersDB, clientDB, portForwardDB, sessionTokens) {
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

    ws.encryption = new SymmEasyEncrypt(clientFound.password, "text");
    const encryptedChallenge = ws.encryption.encrypt("CHALLENGE", "text");

    ws.send(`EXPLAIN ${clientID} ${encryptedChallenge}`);
    
    ws.addEventListener("message", async(msg) => {
      const decryptedMsg = ws.encryption.decrypt(msg.data, "text");
      const msgString = decryptedMsg.toString();

      if (msgString == "SUCCESS") {
        // Start sending our garbage
        for (const port of ports) {
          ws.send(ws.encryption.encrypt(JSON.stringify({
            type: "listenNotifRequest",
            port: port.destPort,
            protocol: port.protocol
          }), "text"));

          if (port.protocol == "UDP") {
            // Give the server some time for it to play catch up with our request, and to start up the port
            await new Promise((i) => setTimeout(i, 500));
            const url = new URL(clientIPAddr);
            const ip = url.host;

            udp.connectForward(parseInt(clientID), port.sourcePort, port.ip, ip.split(":")[0], portsRes.udp, port.destPort, clientDB);
          }
        }
      } else if (msgString.startsWith("{")) {
        const msg = JSON.parse(msgString);

        switch (msg.type) {
          case "connection": {
            if (msg.protocol == "TCP") {
              // Attempt to query the main ID first
              let msgConnect = await portForwardDB.findOne({
                destPort: msg.port,
                refID: parseInt(clientID)
              });

              if (!msgConnect) {
                // Then query generic after that
                msgConnect = await portForwardDB.findOne({
                  destPort: msg.port,
                  refID: 0
                });

                if (!msgConnect) return console.error("Error: Failed to find port");
              }

              // FIXME: This is really bad
              // Ok I lied this is somewhat fine
              const url = new URL(clientIPAddr);
              const ip = url.host;

              tcp.connectForward(parseInt(clientID), msgConnect.sourcePort, msgConnect.ip, msg.socketID, ip.split(":")[0], portsRes.tcp, clientDB);
            } else if (msg.protocol == "UDP") return console.error("Not implemented [UDP]");
          }
        }
      }
    });
  });
}