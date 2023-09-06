import { encrypt, decrypt } from "../libs/encryption.mjs";

import * as b64array from "base64-arraybuffer";
import { WebSocketServer } from "ws";

const { encode } = new TextEncoder();
const { decode } = new TextDecoder();

export async function main(config, db) {
  const wss = new WebSocketServer({
    port: config.ports.websocket
  });

  wss.on("connection", async(ws) => {
    ws.addEventListener("message", async(msg) => {
      if (!ws.hasSpecifiedReason) {
        if (!msg.startsWith("EXPLAIN ")) return ws.close();

        const msgSplit = msg.split(" ");
        const dbSearch = await db.findOne({
          refID: parseInt(msgSplit[1]) 
        });

        if (!dbSearch) return ws.close();

        ws.keyData = dbSearch;
        const decryptedChallenge = await decrypt(msgSplit[2], dbSearch.selfPrivateKey);
        const decodedString = decode(decryptedChallenge);        

        if (decodedString != "CHALLENGE") return ws.close();
      }
    });
  });
}