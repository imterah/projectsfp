import { getRandomInt } from "../libs/getRandomInt.mjs";

import promptSync from "prompt-sync";
import express from "express";
import openpgp from "openpgp";

const prompt = promptSync();

export function init(db, config) {
  const app = express();

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

  app.post("/api/v1/allowedToPair", (req, res) => {
    if (validateIfIsAllowedToPair(req.ip).allowed)
      return res.send({
        success: true,
        allowed: true,
      });

    return res.send({
      success: true,
      allowed: false,
    });
  });

  app.post("/api/v1/pair", async (req, res) => {
    const allowedToPair = validateIfIsAllowedToPair(req.ip);
    if (!req.body.gpgPublicKey || !req.body.name || !req.body.email) {
      return res.status(400).send({
        error: "Missing public key, name, or email",
      });
    }

    if (!allowedToPair.allowed) {
      console.error(
        "ERROR: Attempted pair request with IP '%s'. (rejected)",
        req.ip
      );

      return res.status(403).send({
        error: "Not allowed",
      });
    }

    if (!allowedToPair.autoAccept) {
      if (
        !prompt(`Would you like to allow IP '${req.ip}' to pair? `)
          .toLowerCase()
          .startsWith("y")
      ) {
        return res.status(403).send({
          error: "Not allowed",
        });
      }
    }

    console.log(
      "IP '%s' passed all checks for signing up as a client.",
      req.ip
    );

    const { privateKey, publicKey, revocationCertificate } =
      await openpgp.generateKey({
        type: "ecc",
        curve: "curve25519",
        userIDs: [
          {
            // TODO?
            name: req.body.name,
            email: req.body.email,
          },
        ],
        passphrase: "", // TODO: figure out a way to implement passwords securely
        format: "armored",
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
      refID,
    });
  });

  return app;
}
