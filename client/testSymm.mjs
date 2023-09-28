import { SymmEasyEncrypt, genPassword } from "./libs/symmetricEnc.mjs";

const pw = genPassword();

const symmEncrypt = new SymmEasyEncrypt(pw);
const msg = await symmEncrypt.encrypt("I hacked the Dutch governemnt and all I got was this lousy T-Shirt");

console.log(await symmEncrypt.decrypt(msg));
