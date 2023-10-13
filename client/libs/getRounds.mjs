import fs from "node:fs/promises";

export async function getRounds() {
  const config = JSON.parse(await fs.readFile("./config.json"));
  return config.rounds;
}