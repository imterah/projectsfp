import { SymmEasyEncrypt, genPassword } from "../../server/libs/symmetricEnc.mjs";
import { EasyEncrypt } from "../libs/encryption.mjs";
import * as ws from "../modules/websocketClient.mjs";

import express from "express";
import openpgp from "openpgp";
import axios from "axios";

export function init(usersDB, clientDB, portForwardDB, sessionTokens) {
  const app = express.Router();

  async function findUserFromToken(token, ip) {
    const foundTokenData = sessionTokens.find((i) => i.ip == ip && i.token == token);
    if (!foundTokenData) return null;
  
    const tokenData = await usersDB.findOne({
      username: foundTokenData.username
    });
  
    return tokenData;
  }
  
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

    const serverPublicKeyReq = await axios.get(req.body.url + "/api/v1/pairPublicKey");
    const serverPublicKey = serverPublicKeyReq.data.publicKey;

    const passwordGenerated = genPassword();

    // Decrypt the servers public key without verification. Some could say I'm overreacting, but it's not that much work, to be honest.
    const encryption = new EasyEncrypt(serverPublicKey, "");
    await encryption.init();

    const pairingData = await axios.post(req.body.url + "/api/v1/pair", {
      encryptedPassword: await encryption.encrypt(passwordGenerated.toString("base64"), "text")
    });
    
    await clientDB.insertOne({
      password: passwordGenerated.toString("base64"),
      refID: pairingData.data.refID,
      url: req.body.url
    });
  
    res.send({
      success: true
    });

    // Stolen from index.mjs
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
    ws.main(req.body.url, pairingData.data.refID, allPorts, usersDB, clientDB, portForwardDB, sessionTokens);
  });

  return app;
}