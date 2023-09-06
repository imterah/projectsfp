import crypto from "node:crypto";

export function sha256(val) {
  const hash = crypto.createHash("sha256", val).digest("hex");
  return hash;
}