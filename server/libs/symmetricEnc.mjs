import { Worker } from "worker_threads";
import crypto from "crypto";

// Still less than pgp /shrug
const saltLen = 16;
const ivLen = 16;

export function genPassword() {
  return crypto.randomBytes(127);
}

export class SymmEasyEncrypt {
  constructor(password, format = "binary") {
    this.pw = format == "text" ? Buffer.from(password, "base64") : password;

    this.salt = crypto.randomBytes(16);
    this.key = crypto.pbkdf2Sync(this.pw, this.salt, 100000, 256 / 8, "sha256");
  }

  encrypt(msg, format = "binary") {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./libs/libsymm/encrypt.mjs', {
        workerData: {
          msg,
          format,
  
          saltLen,
          ivLen,

          salt: this.salt,
          key: this.key,
        }
      });
      
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Decryption worker failed with code ${code}`));
        }
      });
    });
  }

  decrypt(msgRaw, format = "binary") {
    return new Promise((resolve, reject) => {
      const worker = new Worker('./libs/libsymm/decrypt.mjs', {
        workerData: {
          msgRaw,
          format,
  
          saltLen,
          ivLen,
  
          pw: this.pw,
        }
      });
      
      worker.on('message', resolve);
      worker.on('error', reject);
      worker.on('exit', (code) => {
        if (code !== 0) {
          reject(new Error(`Decryption worker failed with code ${code}`));
        }
      });
    })
  }
}