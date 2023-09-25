import { getRandomInt } from "./getRandomInt.mjs";

// https://chat.openai.com/share/19c44c9c-b9de-4f33-a29f-f152a8bc3fd6
function splitUint8Array(uint8Array, delimiters) {
  const result = [];
  let startIndex = 0;

  for (let i = 0; i < uint8Array.length; i++) {
    if (delimiters[0] === uint8Array[i]) {
      // Check if the current element is the first delimiter in the sequence.
      let match = true;
      for (let j = 1; j < delimiters.length; j++) {
        if (delimiters[j] !== uint8Array[i + j]) {
          match = false;
          break;
        }
      }

      if (match) {
        // Split the chunk before the delimiter sequence.
        const chunk = uint8Array.slice(startIndex, i);
        result.push(new Uint8Array(chunk));
        startIndex = i + delimiters.length;
      }
    }
  }

  // Add the last chunk after the last delimiter (or the whole array if no delimiter found).
  if (startIndex < uint8Array.length) {
    const chunk = uint8Array.slice(startIndex);
    result.push(new Uint8Array(chunk));
  }

  return result;
}

const packetTypes = {
  HEADER_0: 0xFA, 
  HEADER_1: 0xF0,

  PACKET_BEGIN: 0x00,
  PACKET_END: 0x01,
  PACKET_TRANSMISSION: 0x02,

  PACKET_DELIMITER_0: 0xBA,
  PACKET_DELIMITER_1: 0xDD,
  PACKET_DELIMITER_2: 0xF0,
  PACKET_DELIMITER_3: 0x0D,
};

function createDataBasePacket(size) {
  const dataPacket = new Uint8Array(size+9);

  dataPacket[0] = packetTypes.HEADER_0;
  dataPacket[1] = packetTypes.HEADER_1;
  dataPacket[2] = packetTypes.PACKET_TRANSMISSION;

  dataPacket[size+5] = packetTypes.PACKET_DELIMITER_0;
  dataPacket[size+6] = packetTypes.PACKET_DELIMITER_1;
  dataPacket[size+7] = packetTypes.PACKET_DELIMITER_2;
  dataPacket[size+8] = packetTypes.PACKET_DELIMITER_3;

  return dataPacket;
}

export class Chunkasaurus {
  constructor(chunkSize = 1000) {
    this.chunkedPackets = {};
    this.chunkSize = chunkSize;
  }

  chunk(packet) {
    const packets = [];
    const packetChunkHeaders = new Uint8Array(Math.ceil(packet.length/this.chunkSize));
    
    if (Math.ceil(packet.length/this.chunkSize) > 255) {
      throw new Error("Unsupported chunk amount for current chunk size. Increase the chunk size.");
    }
    
    for (const packetChunkHeaderIndex in packetChunkHeaders)
      packetChunkHeaders[packetChunkHeaderIndex] = getRandomInt(0, 255);

    const randID = getRandomInt(0, 255);
    const hewwoBuffer = new Uint8Array(8+packetChunkHeaders.length);
    
    hewwoBuffer[0] = packetTypes.HEADER_0;
    hewwoBuffer[1] = packetTypes.HEADER_1;
    hewwoBuffer[2] = packetTypes.PACKET_BEGIN;
    hewwoBuffer[3] = randID;
    
    hewwoBuffer[packetChunkHeaders.length+4] = packetTypes.PACKET_DELIMITER_0;
    hewwoBuffer[packetChunkHeaders.length+5] = packetTypes.PACKET_DELIMITER_1;
    hewwoBuffer[packetChunkHeaders.length+6] = packetTypes.PACKET_DELIMITER_2;
    hewwoBuffer[packetChunkHeaders.length+7] = packetTypes.PACKET_DELIMITER_3;

    hewwoBuffer.set(packetChunkHeaders, 4);
    packets.push(Uint8Array.from(hewwoBuffer));

    if (packet.length < this.chunkSize) {
      const dataPacket = createDataBasePacket(packet.length);
      dataPacket[3] = randID;
      dataPacket[4] = packetChunkHeaders[0];
      
      dataPacket.set(packet, 5);

      hewwoBuffer[2] = packetTypes.PACKET_END;
      packets.push(Uint8Array.from(dataPacket));
      packets.push(Uint8Array.from(hewwoBuffer));

      return packets;
    }

    const dataPacket = createDataBasePacket(this.chunkSize);
    dataPacket[3] = randID;

    // TODO: Implement this garbage
    // This could also be done a better way
    let currentActualPos = 0;
    let iterationCnt = 0;

    for (var i = 0; i < packet.length; i++) {
      currentActualPos++;

      const calcCurrentPos = (iterationCnt * this.chunkSize) - iterationCnt;
      const remainingData = packet.length - calcCurrentPos;

      // Check if the remainder of (i / chunkSize) is 0, meaning it can go evenly into it.
      // Also check if the remaining data is not less than the chunk size. We have a special
      // approach for that.
      if (i % this.chunkSize == 0 && remainingData > this.chunkSize) {
        currentActualPos = 0;

        const slicedData = packet.slice(
          calcCurrentPos + iterationCnt,
          calcCurrentPos + iterationCnt + this.chunkSize
        );

        dataPacket[4] = packetChunkHeaders[iterationCnt]; 
        dataPacket.set(slicedData, 5);

        packets.push(Uint8Array.from(dataPacket));
        iterationCnt += 1;
      }
    }

    if (currentActualPos != 0) {
      const calcCurrentPos = (iterationCnt * this.chunkSize) - (iterationCnt);

      if (calcCurrentPos > packet.length)
        throw new Error("Current position greater than encrypted data length");

      const slicedData = packet.slice(
        calcCurrentPos + iterationCnt,
        packet.length-1
      );

      // Rebuild a temp array with our more exact information
      const dataPacket = createDataBasePacket(slicedData.length);
      dataPacket[3] = randID;
      dataPacket[4] = packetChunkHeaders[packetChunkHeaders.length-1];

      dataPacket.set(slicedData, 5);
      packets.push(Uint8Array.from(dataPacket));
    }

    // Time for cleanup
    hewwoBuffer[2] = packetTypes.PACKET_END;
    packets.push(Uint8Array.from(hewwoBuffer));

    return packets;
  }

  async dechunk(chunkedPacket) {
    const splitData = splitUint8Array(chunkedPacket, [
      packetTypes.PACKET_DELIMITER_0,
      packetTypes.PACKET_DELIMITER_1,
      packetTypes.PACKET_DELIMITER_2,
      packetTypes.PACKET_DELIMITER_3
    ]);

    let returnData;
    
    for (const data of splitData) {
      if (data[0] != packetTypes.HEADER_0 || data[1] != packetTypes.HEADER_1) continue;

      if (data[2] == packetTypes.PACKET_BEGIN) {
        const packetPosData = data.slice(4, data.length);
        
        this.chunkedPackets[data[3]] = {
          packets: {},
          packetPosData: packetPosData
        };

        continue;
      } else if (data[2] == packetTypes.PACKET_TRANSMISSION) {
        // Attempt to fetch the current packet pheonix entry
        const packetPheonixEntryIndex = Object.keys(this.chunkedPackets).find(
          (i) => i == data[3]
        );

        if (!packetPheonixEntryIndex) {
          console.error(
            "WARNING: Invalid packet pheonix ID (recieved %s)",
            data[3]
          );
          continue;
        }

        const chunkAllignmentPos = data[4];

        const packetPheonixEntry = this.chunkedPackets[packetPheonixEntryIndex];
        const mappedArray = data.slice(5, data.length);

        if (packetPheonixEntry.packetPosData.indexOf(chunkAllignmentPos) == -1) {
          throw new Error("Failed to find packet allignment element");
        }

        packetPheonixEntry.packets[chunkAllignmentPos] = mappedArray;
      } else if (data[2] == packetTypes.PACKET_END) {
        const packetPheonixEntryIndex = Object.keys(this.chunkedPackets).find(
          (i) => i == data[3]
        );
        
        if (!packetPheonixEntryIndex) {
          console.error(
            "WARNING: Invalid packet pheonix ID recieved (not allocated using packet ID 0x00)"
          );
          continue;
        }

        const packetPheonixEntry = this.chunkedPackets[packetPheonixEntryIndex];
        let totalLenCalc = 0;

        while (Object.keys(packetPheonixEntry.packets).length != packetPheonixEntry.packetPosData.length) {
          await new Promise((i) => setTimeout(i, 10));
        }

        for (const packetEntryIndex of Object.keys(packetPheonixEntry.packets)) 
          totalLenCalc += packetPheonixEntry.packets[packetEntryIndex].length;
        const packetReconstructed = new Uint8Array(totalLenCalc);

        let currentMapPos = 0;

        for (const packetPosition of packetPheonixEntry.packetPosData) {
          const packetEntry = packetPheonixEntry.packets[packetPosition];

          packetReconstructed.set(packetEntry, currentMapPos);
          currentMapPos += packetEntry.length;
        }

        delete this.chunkedPackets[packetPheonixEntryIndex];
        returnData = packetReconstructed;

        continue;
      }
    }

    return returnData;
  }
}
