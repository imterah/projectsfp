import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import * as tcp from "./tcpClient.mjs";
import * as udp from "./udpClient.mjs";

import { WebSocket } from "ws";
import axios from "axios";

import { getRandomInt } from "../libs/getRandomInt.mjs";
import { getRounds } from "../libs/getRounds.mjs";

export async function main(clientIPAddr, clientID, ports, usersDB, clientDB, portForwardDB, sessionTokens, openConnections = []) {
  const clientFound = await clientDB.findOne({
    refID: parseInt(clientID)
  });

  if (!clientFound) throw new Error("Client not found");
  let stupidBreakOutta;
  const portsReq = await axios.get(clientFound.url + "/api/v1/ports").catch((e) => {
    console.error("Failed to reach '%s'. Endpoint is down!", clientIPAddr);
    stupidBreakOutta = true;
  });

  if (stupidBreakOutta) return;

  const portsRes = portsReq.data.ports;

  // FIXME: This will cause problems later. But currently later is not right now.
  const ws = new WebSocket(clientIPAddr.replace("http", "ws").replace(portsRes.http, portsRes.websocket));
  const connectionID = getRandomInt(0, 65535); // Used for IP tracking via dashboard

  ws.addEventListener("error", (e) => {
    console.error("Error in WebSocket for '%s'. Cannot continue. New connections will be down, but all existing connections will likely be up.", clientIPAddr);
  });

  ws.addEventListener("open", async() => {
    ws.isReady = false;

    const encRounds = await getRounds();

    ws.encryption = new SymmEasyEncrypt(clientFound.password, "text", encRounds);
    const encryptedChallenge = ws.encryption.encrypt("CHALLENGE", "text");

    ws.send(`EXPLAIN ${clientID} ${encRounds} ${encryptedChallenge}`);
    
    ws.addEventListener("message", async(msg) => {
      const decryptedMsg = ws.encryption.decrypt(msg.data, "text");
      const msgString = decryptedMsg.toString();

      if (msgString == "SUCCESS") {
        openConnections.push({
          type: "LDN", // London bridge [is falling down]
          id: connectionID,
          serverIP: clientIPAddr,
          serverPort: null,
          clientIP: null,
          clientPort: null
        });
        
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

              const connectionID = getRandomInt(0, 65535);
              openConnections.push({
                type: "TCP",
                id: connectionID,
                serverIP: clientIPAddr,
                serverPort: msg.port,
                clientIP: msg.ip,
                clientPort: msg.port
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

              tcp.connectForward(parseInt(clientID), msgConnect.sourcePort, msgConnect.ip, msg.socketID, ip.split(":")[0], portsRes.tcp, clientDB, openConnections, connectionID);
            } else if (msg.protocol == "UDP") return console.error("Not implemented [UDP]");
          }
        }
      }
    });
  });
}