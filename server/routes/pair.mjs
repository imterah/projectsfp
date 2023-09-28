import { SymmEasyEncrypt } from "../libs/symmetricEnc.mjs";
import { getRandomInt } from "../libs/getRandomInt.mjs";
import { EasyEncrypt } from "../libs/encryption.mjs";

import promptSync from "prompt-sync";
import express from "express";
import openpgp from "openpgp";

const prompt = promptSync();

const pairKey = await openpgp.generateKey({
  type: "ecc",
  curve: "curve25519",
  userIDs: [
    {
      name: "pairkey",
      email: "pair@example.com",
    },
  ],
  passphrase: "",
  format: "armored",
});

const oneTimeDecryption = new EasyEncrypt(null, pairKey.privateKey, "");
await oneTimeDecryption.init();

export function init(db, config) {
  const app = express();

  function validateIfIsAllowedToPair(ip) {
    return {
      allowed: config.blacklistedIPs.includes(ip)
        ? true
        : !config.blockNewIPsAutomatically,
      autoAccept: config.forceAcceptIPs.includes(ip),
    };
  }

  app.post("/api/v1/allowedToPair", (req, res) => {
    return res.send({
      success: true,
      allowed: validateIfIsAllowedToPair(req.ip).allowed,
    });
  });

  app.get("/api/v1/pairPublicKey", (req, res) => {
    return res.send({
      success: true,
      publicKey: pairKey.publicKey
    })
  });

  app.post("/api/v1/pair", async (req, res) => {
    const allowedToPair = validateIfIsAllowedToPair(req.ip);
    if (!req.body.encryptedPassword) {
      return res.status(400).send({
        error: "Missing encrypted password",
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

    const refID = getRandomInt(100000, 999999);
    const passwordDecrypted = await oneTimeDecryption.decrypt(req.body.encryptedPassword, "text");

    await db.insertOne({
      password: passwordDecrypted,
      refID,
    });

    res.send({
      success: true,
      refID,
    });
  });

  return app;
}
