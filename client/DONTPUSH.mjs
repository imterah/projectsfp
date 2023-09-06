import { encrypt, decrypt } from "./libs/encryption.mjs";
import Datastore from "nedb-promises";

const clientDB = Datastore.create("./client.db");
const getReal = await clientDB.findOne({ "_id": "zalCUnv1bvWyzXr6" });

console.log(await encrypt("meow meow purr", getReal.selfPublicKey, "text"));
