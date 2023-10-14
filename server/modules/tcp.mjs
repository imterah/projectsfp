import net from "node:net";

import { WebSocketServer } from "ws";

import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import { getRandomInt } from "../libs/getRandomInt.mjs";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

const msgCallbacks = [
  {
    example: true,
    id: 0xDEADBEEF,
    isServerReady: false,
    onClientClosure: () => {}, // main internal server handles this
    onServerClosure: () => {}, // user server handles this
    sendFunc: (msg) => {}, // main internal server subscribes to this
    recvFunc: (msg) => {}  // user code subscribes to this
  }
];

export function main(config, db) {
  const wss = new WebSocketServer({ port: config.ports.tcp });

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
        
        if (!msgText.startsWith("EXPLAIN_TCP")) return ws.close();

        const msgSplit = msgText.split(" ");
        const dbSearch = await db.findOne({
          refID: parseInt(msgSplit[1]) 
        });

        if (!dbSearch) return ws.close();
        ws.keyData = dbSearch;

        ws.msgGenObject = msgCallbacks.find((i) => i.id == parseInt(msgSplit[2]));
        if (!ws.msgGenObject) return ws.close();

        const encRounds = parseInt(msgSplit[3]);
        ws.encryption = new SymmEasyEncrypt(dbSearch.password, "text", encRounds);

        const decryptedChallenge = ws.encryption.decrypt(msgSplit[4], "text");
        if (decryptedChallenge != ws.encryptionChallenge) return ws.close();
        
        // Update the send method to auto encrypt
        ws.msgGenObject.onServerClosure = () => ws.close();
        ws.msgGenObject.recvFunc = async(msg) => {
          const encryptedMessage = ws.encryption.encrypt(msg);
          ws.send(encryptedMessage);
        };

        ws.msgGenObject.isServerReady = true;
        ws.ready = true;
        
        ws.send(ws.encryption.encrypt(encoder.encode("SUCCESS")));
        return;
      }

      // Attempt to decrypt the message
      const dataDecrypted = ws.encryption.decrypt(data);
      if (!dataDecrypted) return;
      
      ws.msgGenObject.sendFunc(dataDecrypted);
    });

    ws.on("close", () => {
      if (!ws.msgGenObject) return;
      
      try {
        ws.msgGenObject.onClientClosure();
      } catch (e) {
        //
      }
    });
  });

  console.log("TCP Relay Server listening on ::" + config.ports.tcp);
}

export function setUpConn(activeID, externalConnectNotifcations, port, config, db) {
  const server = net.createServer();

  server.on("error", (e) => {
    console.error("An error has occured in the main server code:", e);
  });

  server.on("connection", (socket) => {
    // We replay the messages when the "handshake" is complete
    socket.messageReplayCache = [];
    socket.id = getRandomInt(0, 99999);

    const msgGenObject = {
      id: socket.id,
      refIDBase: activeID,
      isServerReady: false,
      onClientClosure: () => socket.end(),
      onServerClosure: () => {},
      sendFunc: (msg) => socket.write(msg),
      recvFunc: (msg) => {}
    }

    socket.msgGenObject = msgGenObject;
    msgCallbacks.push(msgGenObject);

    externalConnectNotifcations(socket.id, port, socket.remoteAddress); // The server shouldn't need a port, but just in case they want a reminder, here it is.

    async function doReadyRepeatDaemon() {
      if (msgGenObject.isServerReady) {
        for (const msg of socket.messageReplayCache) {
          await socket.msgGenObject.recvFunc(msg);
        }

        socket.messageReplayCache = [];
      }

      setTimeout(doReadyRepeatDaemon, 100);
    }

    doReadyRepeatDaemon();
    
    socket.on("data", async(data) => {
      if (!msgGenObject.isServerReady) return socket.messageReplayCache.push(data);
      await socket.msgGenObject.recvFunc(data);
    });

    socket.on("error", (e) => {
      console.error("An error has occured:", e);
      console.error("Closing current connection...");
  
      socket.msgGenObject.onServerClosure();
      try {
        socket.end();
      } catch (e) {
        console.error("Failed to end connection on socketClient:", e);
      }
    });

    socket.on("close", () => {
      try {
        socket.msgGenObject.onServerClosure();
      } catch (e) {
        //
      }
    });
  });

  server.listen(port);
}