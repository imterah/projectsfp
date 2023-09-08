import openpgp from "openpgp";

export class EasyEncrypt {
  constructor(publicKeyArmored, privateKeyArmored, privateKeyPassphrase) {
    this.publicKeyArmored = publicKeyArmored;
    this.privateKeyArmored = privateKeyArmored;
    this.privateKeyPassphrase = privateKeyPassphrase;
  }

  async init() {
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
    const opts = {};
    opts[format] = msg;

    const message = await openpgp.createMessage(opts);
    const encrypted = await openpgp.encrypt({
      message,
      encryptionKeys: this.publicKey,
      signingKeys: this.privateKey,
    });

    return encrypted;
  }

  async decrypt(msg, format = "binary") {
    const opts = {};
    if (format == "binary") {
      opts["binaryMessage"] = msg;
    } else {
      opts["armoredMessage"] = msg;
    }

    const encryptedMessage = await openpgp.readMessage(opts);

    const { data: decrypted, signatures } = await openpgp.decrypt({
      decryptionKeys: this.privateKey,
      verificationKeys: this.publicKey,
      message: encryptedMessage,
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

    return decrypted;
  }
}
