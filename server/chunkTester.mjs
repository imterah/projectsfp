import { Chunkasaurus } from "./libs/Chunkasaurus.mjs";

const chunkasarus = new Chunkasaurus(50);
const uint8Source = new Uint8Array(255);

let x255Count = 0;
for (var i = 0; i <= uint8Source.length; i++) {
  x255Count++;
  if (x255Count == 256) x255Count = 0;

  uint8Source[i] = x255Count;
}

const chunked = chunkasarus.chunk(uint8Source);
let magic = new Uint8Array(1);

for (const chunk of chunked) {
  const dechunkedData = await chunkasarus.dechunk(chunk);
  if (typeof dechunkedData != "undefined") {
    magic = dechunkedData;
  }
}
let hasPassed = true;

for (const magicEntryIndex in magic) {
  const magicEntry = magic[magicEntryIndex];
  const sourceData = uint8Source[magicEntryIndex];

  if (magicEntry != sourceData) {
    console.log("DIFF(%s): magic(%s), while source(%s)", magicEntryIndex, magicEntry, sourceData);
    hasPassed = false;
  }
}

console.log(`All checks ${hasPassed ? "passed" : "failed"}`)