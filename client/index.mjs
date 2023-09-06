import process from "node:process";

import { sha256 } from "./libs/sha256.mjs";

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

app.listen(8000, () => console.log("\nListening on ::8000"));