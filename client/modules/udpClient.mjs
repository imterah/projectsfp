import { strict as assert } from "node:assert";

import { WebSocket } from "ws";

import { Patter, encodeUDPWrappedPacket, decodeUDPWrappedPacket } from "../libs/portanat.mjs";
import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import { getRounds } from "../libs/getRounds.mjs";

const decoder = new TextDecoder();

export async function connectForward(refID, udpLocalIP, udpLocalPort, serverWSIP, serverWSPort, serverPort, clientDB, openConnections = []) {
  const patter = new Patter(udpLocalIP, udpLocalPort, "udp4"); // TODO: Implement udp4 || udp6
  const ws = new WebSocket(`ws://${serverWSIP}:${serverWSPort}`);

  const connectionID = getRandomInt(0, 65535); // Used for IP tracking via dashboard

  const clientFound = await clientDB.findOne({
    refID
  });

  let isServerConnReady = false;

  assert.ok(clientFound, "Somehow the client doesn't exist");

  const encRounds = await getRounds();
  const encryption = new SymmEasyEncrypt(clientFound.password, "text", encRounds);

  ws.on("open", () => {
    ws.on("message", async(data) => {
      if (data.toString().startsWith("ENC_CHALLENGE") && !isServerConnReady) {
        const challenge = data.toString().split(" ")[1];
        const encryptedChallenge = encryption.encrypt(challenge, "text");
  
        return ws.send(`EXPLAIN_UDP ${refID} ${serverPort} ${encRounds} ${encryptedChallenge}`);
      }
      
      let justRecievedPraise = false;
      const dataDecrypted = encryption.decrypt(data);
      const uint8Array = new Uint8Array(dataDecrypted.buffer, dataDecrypted.byteOffset, dataDecrypted.length);

      if (!isServerConnReady) {
        const decodedMsg = decoder.decode(dataDecrypted);
        if (decodedMsg == "SUCCESS") isServerConnReady = true;
        
        justRecievedPraise = true;
        return;
      }

      if (justRecievedPraise) return;
      const decodedPacket = decodeUDPWrappedPacket(uint8Array);
      
      if (patter.init(decodedPacket.ip, decodedPacket.port)) {
        openConnections.push({
          type: "UDP4",
          id: connectionID,
          serverIP: udpLocalIP,
          serverPort: udpLocalPort,
          clientIP: decodedPacket.ip,
          clientPort: decodedPacket.port
        });
        
        patter.subscribeOnMessageFor(decodedPacket.ip, decodedPacket.port, (msg) => {
          const encoded = encodeUDPWrappedPacket(decodedPacket.ip, decodedPacket.port, msg);
          const encrypted = encryption.encrypt(encoded);

          ws.send(encrypted);
        });
      }
      
      patter.sendOnBehalfOfIP(decodedPacket.msg, decodedPacket.ip, decodedPacket.port);
    });
  });
}