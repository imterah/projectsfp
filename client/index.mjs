import { strict as assert } from "node:assert";
import process from "node:process";

import { sha256 } from "./libs/sha256.mjs";

import * as ws from "./modules/websocketClient.mjs";

import * as add from "./routes/addForward.mjs";
import * as login from "./routes/login.mjs";
import * as pair from "./routes/pair.mjs";

import Datastore from "nedb-promises";
import express from "express";

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

process.on("uncaughtException", (e) => {
  console.error("ERROR: Caught uncaught exception.", e);
  console.error("Report this to https://github.com/greysoh/projectsfp");
});

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

const app = express();
app.use(express.json());

app.use(login.init(usersDB, clientDB, portForwardDB, sessionTokens));
app.use(pair.init(usersDB, clientDB, portForwardDB, sessionTokens));
app.use(add.init(usersDB, clientDB, portForwardDB, sessionTokens));

console.log("\nInitializing core...");
if (await usersDB.count() == 0 || process.env.INIT_CREATE_USER) {
  // Create a new user
  if (!process.env.INIT_USERNAME || !process.env.INIT_PASSWORD) {
    console.error("Cannot initialize! You did not specify a username and password to create, as this is the first time running!");
    console.error("Set the environment variables: INIT_USERNAME, INIT_PASSWORD");
    process.exit(1);
  }

  // Just in case, make sure a user with that username does NOT exist.
  const userSearch = await usersDB.findOne({
    username: process.env.INIT_USERNAME
  });

  if (userSearch) {
    console.error("Cannot initialize! A user with that username already exists.");
    process.exit(1);
  }

  await usersDB.insertOne({
    username: process.env.INIT_USERNAME,
    password: sha256(process.env.INIT_PASSWORD),

    isAdministrator: process.env.INIT_SHOULD_BE_REGULAR_USER ? false : true
  });
}

const portPoolPartyGen = {};

for (const clientItem of await clientDB.find({})) {
  if (!clientItem.refID) continue;

  portPoolPartyGen[clientItem.refID] = [];
}

for (const portItem of await portForwardDB.find({})) {
  if (!portPoolPartyGen[portItem.refID]) portPoolPartyGen[portItem.refID] = [];
  
  portPoolPartyGen[portItem.refID].push(portItem);
}

const allPorts = portPoolPartyGen["0"] ?? [];

for (const poolPartyItemKey of Object.keys(portPoolPartyGen)) {
  if (poolPartyItemKey == "0" || poolPartyItemKey == undefined) continue;

  const poolPartyItem = portPoolPartyGen[poolPartyItemKey];
  const totalPortsToForward = [...allPorts, ...poolPartyItem];

  const serverToConnectToData = await clientDB.findOne({
    refID: parseInt(poolPartyItemKey)
  });

  if (assert.ok(serverToConnectToData, "Your computer is honestly cursed. [Could not find DB entry for pool refID]")) break;
  ws.main(serverToConnectToData.url, poolPartyItemKey, totalPortsToForward, usersDB, clientDB, portForwardDB, sessionTokens);
}

app.listen(8000, () => console.log("Listening on ::8000"));