import { parentPort, workerData } from "worker_threads";
import crypto from "crypto";

const { format, msg, salt, key, ivLen } = workerData;

const iv = crypto.randomBytes(ivLen);
const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

const encrypted = Buffer.concat([cipher.update(msg), cipher.final()]);
const tag = cipher.getAuthTag();

const encryptedConcat = Buffer.concat([salt, iv, encrypted, tag]);

parentPort.postMessage(format === "text" ? encryptedConcat.toString("base64") : encryptedConcat);