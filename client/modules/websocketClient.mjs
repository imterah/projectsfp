import { EasyEncrypt } from "../libs/encryption.mjs";

import { WebSocket } from "ws";

export async function main(clientIPAddr, clientID, usersDB, clientDB, portForwardDB, sessionTokens) {
  const clientFound = await clientDB.findOne({
    refID: clientID
  });

  if (!clientFound) throw new Error("ain no way bro really just ");

  const ws = new WebSocket(clientIPAddr);

  ws.addEventListener("open", async() => {
    ws.isReady = false;

    ws.encryption = new EasyEncrypt(clientFound.serverPublicKey, clientFound.selfPrivateKey, "");
    await ws.encryption.init();

    const encryptedChallenge = btoa(await ws.encryption.encrypt("CHALLENGE", "text"));
    ws.send(`EXPLAIN ${clientID} ${encryptedChallenge}`);
    
    ws.addEventListener("message", async(msg) => {
      const decryptedMsg = await ws.encryption.decrypt(msg);
      const msgString = decryptedMsg.toString();

      if (msgString == "SUCCESS") return;
    });
  });
}