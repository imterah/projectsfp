import { strict as assert } from "node:assert";

import openpgp from "openpgp";

export class EasyEncrypt {
  constructor(publicKeyArmored, privateKeyArmored, privateKeyPassphrase) {
    this.publicKeyArmored = publicKeyArmored;
    this.privateKeyArmored = privateKeyArmored;
    this.privateKeyPassphrase = privateKeyPassphrase;

    this.hasInit = false;
  }

  async init() {
    if (this.hasInit) throw new Error("Already initialized");

    if (this.publicKeyArmored) {
      this.publicKey = await openpgp.readKey({
        armoredKey: this.publicKeyArmored,
      });
    }

    if (this.privateKeyArmored) {
      if (this.privateKeyPassphrase == "") {
        // Top notch security @ fort knox.
        this.privateKey = await openpgp.readPrivateKey({ armoredKey: this.privateKeyArmored });
      } else {
        this.privateKey = await openpgp.decryptKey({
          privateKey: await openpgp.readPrivateKey({ armoredKey: this.privateKeyArmored }),
          passphrase: this.privateKeyPassphrase,
        });
      }
    }
  }

  async encrypt(msg, format = "binary") {
    if (!this.hasInit) await this.init();

    const opts = {};
    opts[format] = msg;

    if (format == "binary" && !(msg instanceof Uint8Array)) {
      throw new Error("Requested binary output with non-binary input");
    }

    const message = await openpgp.createMessage(opts).catch((e) => {
      throw new Error("Failed to read message")
    });

    const encrypted = await openpgp.encrypt({
      message,
      format: format == "binary" ? "binary" : undefined, // Get real
      encryptionKeys: this.publicKey,
      signingKeys: this.privateKey
    }).catch((e) => {
      console.log(e);
      throw new Error("Failed to encrypt message")
    });

    if (format == "binary") {
      assert.ok(encrypted instanceof Uint8Array, "Binary format is NOT binary (in task encryption)");
    }

    return encrypted;
  }

  async decrypt(msg, format = "binary") {
    if (!this.hasInit) await this.init();
    
    const opts = {};
    if (format == "binary") {
      opts["binaryMessage"] = msg;
    } else {
      opts["armoredMessage"] = msg;
    }    

    const encryptedMessage = await openpgp.readMessage(opts).catch((e) => {
      throw new Error("Failed to read message")
    });

    const { data: decrypted, signatures } = await openpgp.decrypt({
      decryptionKeys: this.privateKey,
      verificationKeys: this.publicKey,
      message: encryptedMessage,
      format: format == "binary" ? "binary" : undefined, // Get real
    }).catch((e) => {
      throw new Error("Failed to decrypt message")
    });

    if (this.publicKey) {
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

    if (format == "binary") {
      assert.ok(decrypted instanceof Uint8Array, "Binary format is NOT binary (in task decryption)");
    }
    
    return decrypted;
  }
}