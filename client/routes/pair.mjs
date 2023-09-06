import { getRandomInt } from "../libs/getRandomInt.mjs";

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

  return app;
}