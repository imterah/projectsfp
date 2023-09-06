import { getRandomInt } from "../libs/getRandomInt.mjs";
import { sha256 } from "../libs/sha256.mjs";

import express from "express";

export function init(usersDB, clientDB, portForwardDB, sessionTokens) {
  const app = express.Router();

  app.post("/api/v1/login", async (req, res) => {
    if (!req.body.username || !req.body.password) {
      return res.status(400).send({
        error: "Missing username or password",
      });
    }

    const user = await usersDB.findOne({
      username: req.body.username,
      password: sha256(req.body.password),
    });

    if (!user) {
      return res.status(403).send({
        error: "User not found",
      });
    }

    const jankToken = sha256(getRandomInt(100000, 999999));

    sessionTokens.push({
      username: req.body.username,
      token: jankToken,
      ip: req.ip,
    });

    //return jankToken;
    return res.send({
      success: true,
      token: jankToken,
    });
  });

  return app;
}
