import net from "node:net";

import { getRandomInt } from "../libs/getRandomInt.mjs";
import { Chunkasaurus } from "../libs/Chunkasaurus.mjs";
import { EasyEncrypt } from "../libs/encryption.mjs";

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
  const server = net.createServer();
  server.on("connection", (socket) => {
    socket.ready = false;
    
    socket.on("data", async(data) => {
      if (!socket.ready) { // Yes I know I have a better method of doing this
        // Yes, this is a near exact port of my auth system in websockets.js
        const msgText = decoder.decode(data);
        if (!msgText.startsWith("EXPLAIN_TCP")) return socket.end();

        const msgSplit = msgText.split(" ");
        const dbSearch = await db.findOne({
          refID: parseInt(msgSplit[1]) 
        });

        if (!dbSearch) return socket.end();
        socket.keyData = dbSearch;

        socket.msgGenObject = msgCallbacks.find((i) => i.id == parseInt(msgSplit[2]));
        if (!socket.msgGenObject) return socket.end();

        socket.encryption = new EasyEncrypt(dbSearch.userPublicKey, dbSearch.selfPrivateKey, "");
        await socket.encryption.init();

        // ...except we switch up the message to prevent some forms of replay attacks

        // This blocks only very high level skid stuff where they sniff unencrypted WebSocket traffic,
        // then replays it. This only blocks that, currently. You could easily (probably even more so)
        // sniff the TCP challenge and replay it still. Probably skids who know more could replay the
        // TCP/IP data. So I guess FIXME?
        const decryptedChallenge = await socket.encryption.decrypt(atob(msgSplit[3]), "text");
        if (decryptedChallenge == "CHALLENGE") {
          console.log("Whoops? Caught potential replay attack for IP:", socket.remoteAddress);
          console.log("Check failed: decryptedChallenge = 'CHALLENGE' // challenge used for WS auth");

          socket.write("NAHHH mf just prank called the server :skull:");
          return socket.close();
        }

        if (decryptedChallenge != "FRESH_TCP_CHALLENGER") return socket.end();
        
        // Update the send method to auto encrypt
        socket.msgGenObject.onServerClosure = socket.end;
        socket.msgGenObject.recvFunc = async(msg) => {
          const encryptedMessage = await socket.encryption.encrypt(msg);
          socket.write(encryptedMessage);
        };

        socket.msgGenObject.isServerReady = true;
        socket.ready = true;
        
        socket.write(await socket.encryption.encrypt(encoder.encode("SUCCESS")));
        socket.chunkasarus = new Chunkasaurus();
        console.log("Server validated");
        return;
      }

      const dataUnchunked = socket.chunkasarus.dechunk(data);
      if (dataUnchunked) {
        console.log("Unchunked data recv!")
        // Attempt to decrypt the message
        const dataDecrypted = await socket.encryption.decrypt(dataUnchunked).catch((e) => {
          console.error(e);
        });

        socket.msgGenObject.sendFunc(dataDecrypted);
      }
    });
  });

  server.listen(config.ports.tcp);
  console.log("TCP Relay Server listening on ::" + config.ports.tcp);
}

export function setUpConn(activeID, externalConnectNotifcations, port, config, db) {
  const server = net.createServer();
  server.on("connection", (socket) => {
    // We replay the messages when the "handshake" is complete
    socket.messageReplayCache = [];
    socket.id = getRandomInt(0, 99999);

    const msgGenObject = {
      id: socket.id,
      refIDBase: activeID,
      isServerReady: false,
      onClientClosure: () => socket.end,
      onServerClosure: () => {},
      sendFunc: (msg) => socket.write(msg),
      recvFunc: (msg) => {}
    }

    socket.msgGenObject = msgGenObject;
    msgCallbacks.push(msgGenObject);

    externalConnectNotifcations(socket.id, port); // The server shouldn't need a port, but just in case they want a reminder, here it is.

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
  });

  server.listen(port);
}