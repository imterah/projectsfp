import { strict as assert } from "node:assert";

import { WebSocket } from "ws";

import { Patter, encodeUDPWrappedPacket, decodeUDPWrappedPacket } from "../libs/portanat.mjs";
import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";

const decoder = new TextDecoder();

export async function connectForward(refID, udpLocalIP, udpLocalPort, serverWSIP, serverWSPort, serverPort, clientDB) {
  const patter = new Patter(udpLocalIP, udpLocalPort, "udp4"); // TODO: Implement udp4 || udp6
  const ws = new WebSocket(`ws://${serverWSIP}:${serverWSPort}`);

  const clientFound = await clientDB.findOne({
    refID
  });

  let isServerConnReady = false;

  assert.ok(clientFound, "Somehow the client doesn't exist");

  const encryption = new SymmEasyEncrypt(clientFound.password, "text");
  const encryptedChallenge = encryption.encrypt("FRESH_UDP_CHALLENGER", "text");

  ws.on("open", () => {
    ws.send(`EXPLAIN_UDP ${refID} ${serverPort} ${encryptedChallenge}`);

    ws.on("message", async(data) => {
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