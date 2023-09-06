import { readFile } from "node:fs/promises";

import { getRandomInt } from "./libs/getRandomInt.mjs";

import Datastore from "nedb-promises";
import promptSync from "prompt-sync";
import express from "express";
import openpgp from "openpgp";

const db = Datastore.create("./client.db");
const prompt = promptSync();

console.log(`
 /$$$$$$$                                               /$$      /$$$$$$  /$$$$$$$$ /$$$$$$$ 
| $$__  $$                                             | $$     /$$__  $$| $$_____/| $$__  $$
| $$  \\ $$ /$$$$$$   /$$$$$$  /$$  /$$$$$$   /$$$$$$$ /$$$$$$  | $$  \\__/| $$      | $$  \\ $$
| $$$$$$$//$$__  $$ /$$__  $$|__/ /$$__  $$ /$$_____/|_  $$_/  |  $$$$$$ | $$$$$   | $$$$$$$/
| $$____/| $$  \\__/| $$  \\ $$ /$$| $$$$$$$$| $$        | $$     \\____  $$| $$__/   | $$____/ 
| $$     | $$      | $$  | $$| $$| $$_____/| $$        | $$ /$$ /$$  \\ $$| $$      | $$      
| $$     | $$      |  $$$$$$/| $$|  $$$$$$$|  $$$$$$$  |  $$$$/|  $$$$$$/| $$      | $$      
|__/     |__/       \\______/ | $$ \\_______/ \\_______/   \\___/   \\______/ |__/      |__/      
                        /$$  | $$                                                            
                       |  $$$$$$/                                                            
                        \\______/                                                             

ProjectSFP - Easily forward ports over the network securely.
You are running ProjectSFP Server, intended to be the network forwarding the ports.`);

const configRaw = await readFile("./config.json", "utf-8").catch(() => {
  throw new Error("Failed to read config file. Does it exist?");
});

const config = JSON.parse(configRaw);
const app = express();

app.use(express.json());

function validateIfIsAllowedToPair(ip) {
  if (config.forceAcceptIPs.includes(ip)) return {
    allowed: true,
    autoAccept: true
  };

  if (config.whitelistedIPs.includes(ip)) return {
    allowed: true,
    autoAccept: false
  };

  if (config.blacklistedIPs.includes(ip)) return {
    allowed: false,
    autoAccept: false
  };

  return {
    allowed: config.blockNewIPsAutomatically,
    autoAccept: false
  };
}

app.get("/sfp", (req, res) => {
  res.send({
    success: true,
    type: "ProjectSFP beta"
  });
});

app.post("/api/v1/allowedToPair", (req, res) => {
  if (validateIfIsAllowedToPair(req.ip).allowed) return res.send({
    success: true,
    allowed: true
  });

  return res.send({
    success: true,
    allowed: false
  });
});

app.post("/api/v1/pair", async(req, res) => {
  const allowedToPair = validateIfIsAllowedToPair(req.ip);

  if (!allowedToPair.allowed) {
    console.error("ERROR: Attempted pair request with IP '%s'. (rejected)", req.ip);
    
    return res.status(403).send({
      error: "Not allowed"
    });
  }

  if (!allowedToPair.autoAccept) {
    if (!prompt(`Would you like to allow IP '${req.ip}' to pair? `).toLowerCase().startsWith("y")) {
      return res.status(403).send({
        error: "Not allowed"
      })
    }
  }

  console.log("IP '%s' passed all checks for signing up as a client.", req.ip);

  if (!req.body.gpgPublicKey) {
    return res.status(400).send({
      error: "Missing public key"
    })
  }

  const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519",
    userIDs: [{ // TODO?
      name: "Name Here",
      email: "test@123.net"
    }],
    passphrase: "", // TODO: figure out a way to implement passwords securely
    format: "armored"
  });

  const refID = getRandomInt(100000, 999999);

  await db.insertOne({
    userPublicKey: req.body.gpgPublicKey,
    selfPublicKey: publicKey,
    selfPrivateKey: privateKey,
    selfRevokeCert: revocationCertificate,
    refID,
  });

  res.send({
    success: true,
    publicKey,
    refID
  });
});

app.listen(8080, () => console.log("\nListening on ::8080"));