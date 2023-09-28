import { SymmEasyEncrypt, genPassword } from "./libs/symmetricEnc.mjs";

const pw = genPassword();

const symmEncrypt = new SymmEasyEncrypt(pw);
const msg = symmEncrypt.encrypt("I hacked the Dutch governemnt and all I got was this lousy T-Shirt", "text");

console.log(symmEncrypt.decrypt(msg, "text"));
