import crypto from "node:crypto";

export function sha256(val) {
  const hash = crypto.createHash("sha256").update(val.toString()).digest("hex");
  return hash;
}