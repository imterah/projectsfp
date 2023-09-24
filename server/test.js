import { EasyEncrypt } from "./libs/encryption.mjs";
import openpgp from "openpgp";

console.log("Generating keys...");

// Client
async function doBadStuff() {
  const { privateKeyA, publicKeyA, revocationCertificateA } =
    await openpgp.generateKey({
      type: "ecc",
      curve: "curve25519",
      userIDs: [
        {
          // TODO?
          name: "John Doe",
          email: "johndoe@mail.humans.com",
        },
      ],
      passphrase: "", // TODO: figure out a way to implement passwords securely
      format: "armored",
    });

  // Server
  const { privateKeyB, publicKeyB, revocationCertificateB } =
    await openpgp.generateKey({
      type: "ecc",
      curve: "curve25519",
      userIDs: [
        {
          // TODO?
          name: "Jane Doe",
          email: "janedoe@robots.net",
        },
      ],
      passphrase: "", // TODO: figure out a way to implement passwords securely
      format: "armored",
    });

  const encryptionClient = new EasyEncrypt(publicKeyB, privateKeyA, "");
  const encryptionServer = new EasyEncrypt(publicKeyA, privateKeyB, "");

  return {
    encryptionClient,
    encryptionServer,
  };
}

// Misc
const decoder = new TextDecoder();
const encoder = new TextEncoder();

console.log("Starting...");

test("text encryption", async () => {
  const { encryptionClient, encryptionServer } = await doBadStuff();
  console.log(encryptionClient)

  const encrypted = await encryptionClient.encrypt("Hello, world!", "text");
  expect(await encryptionServer.decrypt(encrypted, "text")).toBe(
    "Hello, world!"
  );
});
