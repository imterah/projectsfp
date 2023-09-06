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

const clientDB = Datastore.create("./client.db");

const app = express();
app.use(express.json());

app.post("/api/v1/pair", async(req, res) => {
  if (!req.body.url) {
    return res.status(400).send({
      error: "Missing URL (in life there is road blox)"
    });
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
      name: "Name Here",
      email: "test@123.net"
    }],
    passphrase: "", // TODO: figure out a way to implement passwords securely
    format: "armored"
  });

  const pairingData = await axios.post(req.body.url + "/api/v1/pair", {
    gpgPublicKey: publicKey
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