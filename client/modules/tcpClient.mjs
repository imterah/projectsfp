import { strict as assert } from "node:assert";
import { Socket } from "node:net";

import { Chunkasaurus } from "../libs/Chunkasaurus.mjs";
import { EasyEncrypt } from "../libs/encryption.mjs";

const decoder = new TextDecoder();

export async function connectForward(refID, tcpLocalPort, tcpLocalIP, serverSocketID, serverIP, serverPort, clientDB) {
  const socket = new Socket();
  const socketClient = new Socket();

  const clientFound = await clientDB.findOne({
    refID
  });

  assert.ok(clientFound, "Somehow the client doesn't exist");

  let isServerConnReady = false;
  let isClientConnReady = false;

  const clientConnBuffer = [];
  const serverConnBuffer = [];

  const chunkasarus = new Chunkasaurus();

  const encryption = new EasyEncrypt(clientFound.serverPublicKey, clientFound.selfPrivateKey, "");
  await encryption.init();

  const encryptedChallenge = btoa(await encryption.encrypt("FRESH_TCP_CHALLENGER", "text"));
  
  socket.on("connect", () => {
    socket.write(`EXPLAIN_TCP ${refID} ${serverSocketID} ${encryptedChallenge}`);

    socket.on("data", async(data) => {
      let justRecievedPraise = false;
      const dataDecrypted = await encryption.decrypt(data);

      if (!isServerConnReady) {
        const decodedMsg = decoder.decode(dataDecrypted);
        if (decodedMsg == "SUCCESS") isServerConnReady = true;

        justRecievedPraise = true;
        return;
      }
      
      if (isClientConnReady && clientConnBuffer.length != 0) {
        while (clientConnBuffer.length != 0) {
          const item = clientConnBuffer[0];
          socketClient.write(item);

          clientConnBuffer.splice(0, 1);
        }

        assert.equal(clientConnBuffer.length, 0, "Client connection buffer is not empty");
      }

      // FIXME: This should be a daemon.

      if (justRecievedPraise) return;
      
      if (!isClientConnReady) clientConnBuffer.push(dataDecrypted);
      else socketClient.write(dataDecrypted);
    });

    socketClient.on("connect", () => {
      socketClient.on("data", async(data) => {
        const dataEncrypted = await encryption.encrypt(data);
        if (serverConnBuffer && serverConnBuffer.length != 0) {
          while (serverConnBuffer.length != 0) {
            const item = serverConnBuffer[0];
            socket.write(item);
            
            serverConnBuffer.splice(0, 1);
          }

          assert.equal(serverConnBuffer.length, 0, "Server connection buffer is not empty");
        }

        const chunkedData = chunkasarus.chunk(dataEncrypted);

        for (const chunkedItem of chunkedData) {
          if (!isServerConnReady) serverConnBuffer.push(chunkedItem); 
          else socket.write(chunkedItem);
        }
      });

      isClientConnReady = true;
    });
  });
  
  socket.connect(serverPort, serverIP);
  socketClient.connect(tcpLocalPort, tcpLocalIP);
}