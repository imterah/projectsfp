import { Chunkasaurus } from "./libs/Chunkasaurus.mjs";

const chunkasarus = new Chunkasaurus(1000);
const uint8Source = new Uint8Array(8*1024);

let x255Count = 0;
for (var i = 0; i <= uint8Source.length; i++) {
  x255Count++;
  if (x255Count == 256) x255Count = 0;

  uint8Source[i] = x255Count;
}

const chunked = chunkasarus.chunk(uint8Source);
let magic = new Uint8Array(1);

for (const chunk of chunked) {
  const dechunkedData = chunkasarus.dechunk(chunk);
  if (typeof dechunkedData != "undefined") {
    magic = dechunkedData;
  }
}
let hasPassed = true;

for (const magicEntryIndex in magic) {
  if (uint8Source-1 < magicEntryIndex) {
    console.log("WARNING: OOB! Returning...")
  }

  const magicEntry = magic[magicEntryIndex];
  const sourceData = uint8Source[magicEntryIndex];

  if (magicEntry != sourceData) {
    console.log("DIFF(%s): magic(%s), while source(%s)", magicEntryIndex, magicEntry, sourceData);
    hasPassed = false;
  }
}

console.log(`All checks ${hasPassed ? "passed" : "failed"}`)