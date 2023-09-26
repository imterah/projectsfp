import { Chunkasaurus } from "./libs/Chunkasaurus.mjs";
import { getRandomInt } from "./libs/getRandomInt.mjs";

const chunkasarus = new Chunkasaurus(50);
const uint8Source = new Uint8Array(255);

let x255Count = 0;
for (var i = 0; i <= uint8Source.length; i++) {
  x255Count++;
  if (x255Count == 256) x255Count = 0;

  uint8Source[i] = x255Count;
}

const chunked = chunkasarus.chunk(uint8Source);

function shuffleArrayExceptFirstLast(arr) {
  if (arr.length < 2) {
    console.log("The array is too small to shuffle.");
    return arr;
  }

  const first = arr[0];
  const middle = arr.slice(1);

  for (let i = middle.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [middle[i], middle[j]] = [middle[j], middle[i]];
  }

  const shuffledArray = [first, ...middle];

  return shuffledArray;
}

while (true) {
  const newChunked = shuffleArrayExceptFirstLast(chunked);

  let magic = new Uint8Array(1);

  for (const chunkIndex in newChunked) {
    const chunk = chunked[chunkIndex];
    //console.log("Decoding %s/%s", chunkIndex, chunked.length - 1);
    //console.log(chunk[4]);

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
      console.log(
        "DIFF(%s): magic(%s), while source(%s)",
        magicEntryIndex,
        magicEntry,
        sourceData
      );
      hasPassed = false;
    }
  }

  console.log(`All checks ${hasPassed ? "passed" : "failed"}`);
}
