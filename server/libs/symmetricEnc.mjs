import crypto from "crypto";

// Still less than pgp /shrug
const saltLen = 16;
const ivLen = 16;

export function genPassword() {
  return crypto.randomBytes(256);
}

export class SymmEasyEncrypt {
  constructor(password, format = "binary") {
    this.pw = format == "text" ? Buffer.from(password, "base64") : password;

    this.salt = crypto.randomBytes(16);
    this.key = crypto.pbkdf2Sync(this.pw, this.salt, 8192, 256 / 8, "sha256");
  }

  encrypt(msg, format = "binary") {
    const iv = crypto.randomBytes(ivLen);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, iv);

    const encrypted = Buffer.concat([cipher.update(msg), cipher.final()]);
    const tag = cipher.getAuthTag();
    const encryptedConcat = Buffer.concat([this.salt, iv, encrypted, tag]);

    return format === "text" ? encryptedConcat.toString("base64") : encryptedConcat;
  }

  decrypt(msgRaw, format = "binary") {
    const msg = format === "text" ? Buffer.from(msgRaw, "base64") : msgRaw;
  
    const salt = msg.slice(0, saltLen);
    const iv = msg.slice(saltLen, saltLen + ivLen);
    const tag = msg.slice(-16); // The last 16 bytes are the authentication tag.
    const ciphertext = msg.slice(saltLen + ivLen, -16); // Extract the ciphertext.
  
    const key = crypto.pbkdf2Sync(this.pw, salt, 8192, 256 / 8, "sha256");
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  
    // Set the authentication tag before decryption.
    decipher.setAuthTag(tag);
  
    // Update the decipher with the ciphertext.
    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  
    return format === "text" ? decrypted.toString() : decrypted;
  }
}