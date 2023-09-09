import express from "express";

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

  app.post("/api/v1/add", async(req, res) => {
    if (!req.body.port || !req.body.token || !req.body.protocol) {
      return res.status(400).send({
        error: "Missing port, token, or protocol (TCP/UDP)"
      });
    }

    if (req.body.protocol != "TCP" && req.body.protocol != "UDP") {
      return res.status(400).send({
        error: "Protocol invalid (must be TCP oder UDP)"
      })
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

    if (req.body.id) {
      const validateIfPaired = await clientDB.findOne({
        refID: req.body.id
      });

      if (!validateIfPaired) {
        return res.status(418).send({
          error: "Not paired to requested server"
        });
      }
    }

    // TODO: Type validation
    const validateIfAlreadyPorted = await portForwardDB.findOne({
      refID: req.body.id ?? 0,
      sourcePort: req.body.port,
      destPort: req.body.destPort ?? req.body.port,
      protocol: req.body.protocol
    });

    if (validateIfAlreadyPorted) {
      return res.status(418).send({
        error: "Already have a tunnel set up"
      });
    }

    await portForwardDB.insertOne({
      refID: req.body.id ?? 0,
      sourcePort: req.body.port,
      destPort: req.body.destPort ?? req.body.port,
      protocol: req.body.protocol
    });

    return res.send({
      success: true
    });
  });

  return app;
}