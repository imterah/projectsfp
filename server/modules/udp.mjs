import dgram from "dgram";

import { WebSocketServer } from "ws";

import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import { encodeUDPWrappedPacket, decodeUDPWrappedPacket } from "../libs/portanat.mjs";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const msgCallbacks = [
  {
    example: true,
    id: 0xDEADBEEF, // used as ref id for UDP
    port: 19132,
    sendFunc: (msg, ip, port) => {}, // main internal server subscribes to this
    recvFunc: (msg, ip, port) => {}  // user code subscribes to this
  }
];

const msgInitCallbacks = [
  {
    example: true,
    id: 0xDEADBEEF, // used as ref id for UDP
    port: 19132,
    onConnect: () => {}
  }
]

export function main(config, db) {
  const wss = new WebSocketServer({ port: config.ports.udp });

  wss.on("error", (e) => {
    console.error("An error has occured in the main server code:", e);
  });

  wss.on("connection", (ws) => {
    ws.ready = false;
    ws.encryptionChallenge = getRandomInt(0, 65535);
    ws.send("ENC_CHALLENGE " + ws.encryptionChallenge);
    
    ws.on("message", async(data) => {
      if (!ws.ready) { // Yes, I know I have a better method of doing this.
        // And yes, this is a near exact port of my auth system in websockets.js
        const msgText = decoder.decode(data);
        
        if (!msgText.startsWith("EXPLAIN_UDP")) return ws.close();

        const msgSplit = msgText.split(" ");
        const dbSearch = await db.findOne({
          refID: parseInt(msgSplit[1]) 
        });

        if (!dbSearch) return ws.close();
        ws.keyData = dbSearch;

        const encRounds = parseInt(msgSplit[3]);
        ws.encryption = new SymmEasyEncrypt(dbSearch.password, "text", encRounds);

        const decryptedChallenge = ws.encryption.decrypt(msgSplit[4], "text");
        if (decryptedChallenge != ws.encryptionChallenge) return ws.close();

        ws.msgGenObject = {
          id: parseInt(msgSplit[1]), // used as ref id for UDP
          port: parseInt(msgSplit[2]), // FIXME: Implement verification somehow
          sendFunc: (msg, ip, port) => {}, // main internal server subscribes to this
          recvFunc: (msg, ip, port) => {   // user code subscribes to this
            const encodedMessage = encodeUDPWrappedPacket(ip, port, msg);
            const encryptedMessage = ws.encryption.encrypt(encodedMessage);
            
            ws.send(encryptedMessage);
          }
        }

        msgCallbacks.push(ws.msgGenObject);

        const foundInitElem = msgInitCallbacks.find((i) => i.id == ws.msgGenObject.id && i.port == ws.msgGenObject.port);
        foundInitElem.onConnect(ws.msgGenObject);

        ws.ready = true;
        
        ws.send(ws.encryption.encrypt(encoder.encode("SUCCESS")));
        return;
      }

      // Attempt to decrypt the message
      const dataDecrypted = ws.encryption.decrypt(data);
      if (!dataDecrypted) return;

      const decodedPacket = decodeUDPWrappedPacket(dataDecrypted);
      ws.msgGenObject.sendFunc(decodedPacket.msg, decodedPacket.ip, decodedPacket.port);
    });
  });
 
  console.log("UDP Relay Server listening on ::" + config.ports.udp);
}

export function setUpConn(activeID, port, config, db) {
  const server = dgram.createSocket("udp4");
  const connsFound = [];

  server.on("message", (msg, rinfo) => {
    for (const conn of connsFound) {
      conn.recvFunc(msg, rinfo.address, rinfo.port);
    }
  });

  server.on("error", (e) => {
    console.error("An error has occured in the main server code:", e);
  });

  msgInitCallbacks.push({
    id: activeID,
    port,
    onConnect: (msgObj) => {
      connsFound.push(msgObj);

      msgObj.sendFunc = (msg, ip, port) => {
        server.send(msg, port, ip);
      }
    }
  });

  server.bind(port);
}