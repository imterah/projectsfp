import { readFile, copyFile, mkdir } from "node:fs/promises";

import * as ws from "./modules/websockets.mjs";
import * as pair from "./routes/pair.mjs";
import * as tcp from "./modules/tcp.mjs";
import * as udp from "./modules/udp.mjs";

import Datastore from "nedb-promises";
import express from "express";

const db = Datastore.create("./data/client.db");

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
You are running ProjectSFP Server, intended to be the network forwarding the ports.\n`);

process.on("uncaughtException", (e) => {
  console.error("ERROR: Caught uncaught exception.", e);
  console.error("Report this to https://github.com/greysoh/projectsfp");
});

await mkdir("./data/").catch(() => 0);
const configRaw = await readFile("./data/config.json", "utf-8").catch(async() => {
  console.log("Failed to read config file. Does it exist in the ./data/ directory (or volume)? Attempting to copy!");
  await copyFile("./config.example.json", "./data/config.json");

  console.log("Done. You should restart.");
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

app.get("/api/v1/ports", (req, res) => {
  res.send({
    success: true,
    ports: config.ports
  })
})

app.listen(config.ports.http, () => console.log("HTTP Server listening on ::%s", config.ports.http));
ws.main(config, db);
tcp.main(config, db);
udp.main(config, db);