import process from "node:process";

import { getRandomInt } from "./libs/getRandomInt.mjs";
import { sha256 } from "./libs/sha256.mjs";

import Datastore from "nedb-promises";
import express from "express";
import openpgp from "openpgp";
import axios from "axios";

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
You are running ProjectSFP Client, intended for forwarding ports to the server.`);

const portForwardDB = Datastore.create("./ports.db");
const clientDB = Datastore.create("./client.db");
const usersDB = Datastore.create("./users.db");

const sessionTokens = [
  {
    username: "example",
    token: "",
    ip: "0.0.0.0"
  }
]

async function findUserFromToken(token, ip) {
  const foundTokenData = sessionTokens.find((i) => i.ip == ip && i.token == token);
  if (!foundTokenData) return null;

  const tokenData = await usersDB.findOne({
    username: foundTokenData.username
  });

  return tokenData;
}

const app = express();
app.use(express.json());

if (await usersDB.count() == 0 || process.env.INIT_CREATE_USER) {
  // Create a new user
  if (!process.env.INIT_USERNAME || !process.env.INIT_PASSWORD) {
    console.error("\nCannot initialize! You did not specify a username and password to create, as this is the first time running!");
    console.error("Set the environment variables: INIT_USERNAME, INIT_PASSWORD");
    process.exit(1);
  }

  // Just in case, make sure a user with that username does NOT exist.
  const userSearch = await usersDB.findOne({
    username: process.env.INIT_USERNAME
  });

  if (userSearch) {
    console.error("\nCannot initialize! A user with that username already exists.");
    process.exit(1);
  }

  await usersDB.insertOne({
    username: process.env.INIT_USERNAME,
    password: sha256(process.env.INIT_PASSWORD),

    isAdministrator: process.env.INIT_SHOULD_BE_REGULAR_USER ? false : true
  });
}

app.post("/api/v1/login", async(req, res) => {
  if (!req.body.username || !req.body.password) {
    return res.status(400).send({
      error: "Missing username or password"
    });
  };
  
  const user = await usersDB.findOne({
    username: req.body.username,
    password: sha256(req.body.password)
  });

  if (!user) {
    return res.status(403).send({
      error: "User not found"
    });
  }

  const jankToken = sha256(getRandomInt(100000, 999999));

  sessionTokens.push({
    username: req.body.username,
    token: jankToken,
    ip: req.ip
  });

  //return jankToken;
  return res.send({
    success: true,
    token: jankToken
  })
})

app.post("/api/v1/pair", async(req, res) => {
  if (!req.body.url || !req.body.token) {
    return res.status(400).send({
      error: "Missing URL or token"
    });
  }

  const user = await findUserFromToken(req.body.token, req.ip);
  if (!user) {
    return res.status(403).send({
      error: "User not found"
    });
  } else if (!user.isAdministrator) {
    return res.status(403).send({
      error: "User is not administrator"
    });
  }

  const validateIfAlreadyPaired = await clientDB.findOne({
    url: req.body.url
  });

  if (validateIfAlreadyPaired) {
    // TOOD: Find better HTTP status code
    return res.status(403).send({
      error: "Server is already paired"
    })
  }

  const validateIfAllowedToPair = await axios.post(req.body.url + "/api/v1/allowedToPair");
  if (!validateIfAllowedToPair.data.allowed) {
    return res.status(403).send({
      error: "Server returned not allowed to pair"
    });
  };

  const { privateKey, publicKey, revocationCertificate } = await openpgp.generateKey({
    type: "ecc",
    curve: "curve25519",
    userIDs: [{ // TODO?
      name: `${user.username} [Client Key @ ProjectSFP]`,
      email: `${user.username}@1dummy.greysoh.dev`
    }],
    passphrase: "", // TODO: figure out a way to implement passwords securely
    format: "armored"
  });

  const pairingData = await axios.post(req.body.url + "/api/v1/pair", {
    gpgPublicKey: publicKey,
    name: `${user.username} [Server Key @ ProjectSFP]`,
    email: `${user.username}@1dummy.greysoh.dev`
  });
  
  await clientDB.insertOne({
    serverPublicKey: pairingData.publicKey,
    selfPublicKey: publicKey,
    selfPrivateKey: privateKey,
    selfRevokeCert: revocationCertificate,
    refID: pairingData.refID,
    url: req.body.url
  });

  res.send({
    success: true
  })
});

app.listen(8000, () => console.log("\nListening on ::8000"));