import { parentPort, workerData } from "worker_threads";
import crypto from "crypto";

const { format, msgRaw, pw, ivLen, saltLen } = workerData;

const msg = format === "text" ? Buffer.from(msgRaw, "base64") : msgRaw;
  
const salt = msg.slice(0, saltLen);
const iv = msg.slice(saltLen, saltLen + ivLen);
const tag = msg.slice(-16); // The last 16 bytes are the authentication tag.
const ciphertext = msg.slice(saltLen + ivLen, -16); // Extract the ciphertext.

const key = crypto.pbkdf2Sync(pw, salt, 100000, 256 / 8, "sha256");
const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);

// Set the authentication tag before decryption.
decipher.setAuthTag(tag);

// Update the decipher with the ciphertext.
const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
parentPort.postMessage(format === "text" ? decrypted.toString() : decrypted);