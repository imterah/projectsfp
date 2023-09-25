import { getRandomInt } from "./getRandomInt.mjs";

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
    const helloBuffer = new Uint8Array(8+packetChunkHeaders.length);
    const hewwoBuffer = new Uint8Array(8);
    
    helloBuffer[0] = packetTypes.HEADER_0;
    helloBuffer[1] = packetTypes.HEADER_1;
    helloBuffer[2] = packetTypes.PACKET_BEGIN;
    
    helloBuffer[3] = randID;

    helloBuffer.set(packetChunkHeaders, 4);
    
    helloBuffer[packetChunkHeaders.length+4] = packetTypes.PACKET_DELIMITER_0;
    helloBuffer[packetChunkHeaders.length+5] = packetTypes.PACKET_DELIMITER_1;
    helloBuffer[packetChunkHeaders.length+6] = packetTypes.PACKET_DELIMITER_2;
    helloBuffer[packetChunkHeaders.length+7] = packetTypes.PACKET_DELIMITER_3;

    // TODO: This crap needs optimizing.
    hewwoBuffer[0] = packetTypes.HEADER_0;
    hewwoBuffer[1] = packetTypes.HEADER_1;
    hewwoBuffer[2] = packetTypes.PACKET_BEGIN;
    
    hewwoBuffer[3] = randID;
    
    hewwoBuffer[4] = packetTypes.PACKET_DELIMITER_0;
    hewwoBuffer[5] = packetTypes.PACKET_DELIMITER_1;
    hewwoBuffer[6] = packetTypes.PACKET_DELIMITER_2;
    hewwoBuffer[7] = packetTypes.PACKET_DELIMITER_3;

    packets.push(Uint8Array.from(helloBuffer));

    if (packet.length < this.chunkSize) {
      const dataPacket = new Uint8Array(packet.length + 8);
      dataPacket[0] = packetTypes.HEADER_0;
      dataPacket[1] = packetTypes.HEADER_1;
      dataPacket[2] = packetTypes.PACKET_TRANSMISSION;
      
      dataPacket[3] = randID;
      dataPacket[4] = 0;

      dataPacket[packet.length+5] = packetTypes.PACKET_DELIMITER_0;
      dataPacket[packet.length+6] = packetTypes.PACKET_DELIMITER_1;
      dataPacket[packet.length+7] = packetTypes.PACKET_DELIMITER_2;
      dataPacket[packet.length+8] = packetTypes.PACKET_DELIMITER_3;
      
      dataPacket.set(packet, 5);

      hewwoBuffer[2] = packetTypes.PACKET_END;
      packets.push(Uint8Array.from(dataPacket));
      packets.push(Uint8Array.from(hewwoBuffer));

      return packets;
    }

    const dataPacket = new Uint8Array(this.chunkSize + 9);
    dataPacket[0] = packetTypes.HEADER_0;
    dataPacket[1] = packetTypes.HEADER_1;
    dataPacket[2] = packetTypes.PACKET_TRANSMISSION;
    
    dataPacket[3] = randID;
    dataPacket[4] = 0;

    dataPacket[this.chunkSize+5] = packetTypes.PACKET_DELIMITER_0;
    dataPacket[this.chunkSize+6] = packetTypes.PACKET_DELIMITER_1;
    dataPacket[this.chunkSize+7] = packetTypes.PACKET_DELIMITER_2;
    dataPacket[this.chunkSize+8] = packetTypes.PACKET_DELIMITER_3;

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
      const dataPacket = new Uint8Array(slicedData.length+9);
      dataPacket[0] = packetTypes.HEADER_0;
      dataPacket[1] = packetTypes.HEADER_1;
      dataPacket[2] = packetTypes.PACKET_TRANSMISSION;
      
      dataPacket[3] = randID;
      dataPacket[4] = packetChunkHeaders[packetChunkHeaders.length-1];

      dataPacket[slicedData.length+5] = packetTypes.PACKET_DELIMITER_0;
      dataPacket[slicedData.length+6] = packetTypes.PACKET_DELIMITER_1;
      dataPacket[slicedData.length+7] = packetTypes.PACKET_DELIMITER_2;
      dataPacket[slicedData.length+8] = packetTypes.PACKET_DELIMITER_3;

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
          console.log("Missing data -- waiting a bit...");
          await new Promise((i) => setTimeout(i, 1000));
        }

        for (const packetEntryIndex of Object.keys(packetPheonixEntry.packets)) 
          totalLenCalc += packetPheonixEntry.packets[packetEntryIndex].length;
        const packetReconstructed = new Uint8Array(totalLenCalc);

        // I love doing the equivalent of memmap(?). Mapping my beloved
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
