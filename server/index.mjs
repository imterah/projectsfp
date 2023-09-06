import { readFile } from "node:fs/promises";

import { getRandomInt } from "./libs/getRandomInt.mjs";
import * as pair from "./routes/pair.mjs";

import Datastore from "nedb-promises";
import express from "express";

const db = Datastore.create("./client.db");

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
app.use(pair.init(db, config));

app.get("/sfp", (req, res) => {
  res.send({
    success: true,
    type: "ProjectSFP beta"
  });
});

app.listen(config.ports.http, () => console.log("\nListening on ::%s", config.ports.http));