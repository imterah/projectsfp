import openpgp from "openpgp";
import net from "node:net";

import { EasyEncrypt } from "./libs/encryption.mjs";

import { Chunkasaurus } from "./libs/Chunkasaurus.mjs";
import { getRandomInt } from "./libs/getRandomInt.mjs";

const chunkasarus = new Chunkasaurus(6);
let uint8Source = new Uint8Array(1024);
let uint8Encrypted = new Uint8Array(1);

console.log("Generating keys...");
const { privateKey, publicKey, revocationCertificate } =
  await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519",
    userIDs: [
      {
        // TODO?
        name: "Rad1o",
        email: "obama@whitehouse.gov",
      },
    ],
    passphrase: "", // TODO: figure out a way to implement passwords securely
    format: "armored",
  });

const encrypt = new EasyEncrypt(publicKey, privateKey, "");
await encrypt.init();

console.log("...done.");

const server = net.createServer();

async function doTest() {
  uint8Source = new Uint8Array(1024);
  
  for (var i = 0; i <= uint8Source.length; i++) {
    uint8Source[i] = getRandomInt(0, 255);
  }

  uint8Encrypted = await encrypt.encrypt(uint8Source);

  const chunked = chunkasarus.chunk(uint8Encrypted);
  const client = net.connect(0xdead, "127.0.0.1");

  client.on("connect", () => {
    for (const chunk of chunked) {
      client.write(chunk);
    }
  });
}

server.on("connection", (socket) => {
  socket.on("data", async(data) => {
    const dechunked = await chunkasarus.dechunk(data);
    console.log(dechunked);

    if (dechunked) {
      let hasPassed = true;

      try {
        // Attempt decryption first.
        const decryptedData = await encrypt.decrypt(dechunked, "binary");

        for (const magicEntryIndex in dechunked) {
          const magicEntry = decryptedData[magicEntryIndex];
          const sourceData = uint8Source[magicEntryIndex];
  
          if (magicEntry != sourceData) {
            console.error(
              "DIFF(%s): magic(%s), while source(%s)",
              magicEntryIndex,
              magicEntry,
              sourceData
            );
            hasPassed = false;
          }
        }
  
        if (!hasPassed) throw new Error("FAILED!!!");
        console.log("pass status:", hasPassed);
      } catch (e) {
        for (const magicEntryIndex in uint8Encrypted) {
          const magicEntry = dechunked[magicEntryIndex];
          const sourceData = uint8Encrypted[magicEntryIndex];
  
          if (magicEntry != sourceData) {
            console.error(
              "DIFF(%s): magic(%s), while source(%s)",
              magicEntryIndex,
              magicEntry,
              sourceData
            );
            hasPassed = false;
          }
        }
  
        console.log(e);
        console.log("pass status:", hasPassed);
        throw new Error("FAILED!!! <Decryption stage>");
      }

      socket.end();
      await doTest();
    }
  });
});

server.listen(0xdead, "127.0.0.1");
await doTest();
