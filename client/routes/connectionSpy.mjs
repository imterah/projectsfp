import express from "express";

export function init(usersDB, clientDB, portForwardDB, sessionTokens, openConnections) {
  const app = express.Router();

  async function findUserFromToken(token, ip) {
    const foundTokenData = sessionTokens.find((i) => i.ip == ip && i.token == token);
    if (!foundTokenData) return null;
  
    const tokenData = await usersDB.findOne({
      username: foundTokenData.username
    });
  
    return tokenData;
  }

  app.post("/api/v1/getAllOpenConnections", async(req, res) => {
    if (!req.body.token) {
      return res.status(400).send({
        error: "Missing token"
      });
    }

    const user = await findUserFromToken(req.body.token, req.ip);
    if (!user) {
      return res.status(403).send({
        error: "User not found"
      });
    }

    const out = {
      success: true,
      openConnections
    }

    if (user.isAdministrator) {
      out.sessionList = sessionTokens.map((i) => {
        return {
          username: i.username,
          ip: i.ip
        }
      });
    }

    res.send(out);
  });

  return app;
}