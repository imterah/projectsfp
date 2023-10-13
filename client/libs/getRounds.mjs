import fs from "node:fs/promises";

export async function getRounds() {
  const config = JSON.parse(await fs.readFile("./data/config.json"));
  return config.rounds;
}