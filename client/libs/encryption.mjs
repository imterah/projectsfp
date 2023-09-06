import openpgp from "openpgp";

const encoder = new TextEncoder();

export async function encrypt(rawMsg, publicKeyArmored, privateKeyVerifcationArmored, passphrase = "", format = "binary") {
  const publicKey = await openpgp.readKey({
    armoredKey: publicKeyArmored
  });

  let privateKeyOptional;
  if (privateKeyVerifcationArmored) {
    privateKeyOptional = await openpgp.readKey({
      armoredKey: privateKeyVerifcationArmored,
      passphrase
    });
  }

  let msg;
  if (format == "binary") {
    if (typeof rawMsg == "number" || typeof rawMsg == "string") {
      msg = encoder.encode(`${rawMsg}`);
    } else {
      msg = rawMsg;
    }
  } else {
    msg = rawMsg;
  }

  const opts = {};
  opts[format] = msg;

  const message = await openpgp.createMessage(opts);
  const encrypted = await openpgp.encrypt({
    message,
    encryptionKeys: publicKey,
    signingKeys: privateKeyOptional
  });

  return encrypted;
}

export async function decrypt(msg, privateKeyArmored, publicKeyVerifcationArmored, passphrase = "", format = "binary") {
  const privateKey = await openpgp.readKey({
    armoredKey: privateKeyArmored,
    passphrase
  });

  const publicKey = await openpgp.readKey({
    armoredKey: publicKeyVerifcationArmored
  });

  const opts = {};
  if (format == "binary") {
    opts["binaryMessage"] = msg;
  } else {
    opts["armoredMessage"] = msg;
  }

  const encryptedMessage = await openpgp.readMessage({
    binaryMessage: msg
  });

  const { data: decrypted, signatures } = await openpgp.decrypt({
    encryptionKeys: privateKey,
    verificationKeys: publicKey,
    message: encryptedMessage
  });

  if (publicKey) {
    try {
      await signatures[0].verified;
    } catch (e) {
      console.error("Could not verify signature!", e.message, "\nTrace:");
      console.error(trace);
      
      if (format == "binary") {
        const uintDummy = new Uint8Array(1);
        return uintDummy;
      } else {
        return "";
      }
    }
  }

  return decrypted;
} 