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

    const randID = getRandomInt(0, 255);
    const hewwoBuffer = new Uint8Array(8);
    hewwoBuffer[0] = packetTypes.HEADER_0;
    hewwoBuffer[1] = packetTypes.HEADER_1;
    hewwoBuffer[2] = packetTypes.PACKET_BEGIN;
    
    hewwoBuffer[3] = randID;
    
    hewwoBuffer[4] = packetTypes.PACKET_DELIMITER_0;
    hewwoBuffer[5] = packetTypes.PACKET_DELIMITER_1;
    hewwoBuffer[6] = packetTypes.PACKET_DELIMITER_2;
    hewwoBuffer[7] = packetTypes.PACKET_DELIMITER_3;

    packets.push(Uint8Array.from(hewwoBuffer));

    if (packet.length < this.chunkSize) {
      const dataPacket = new Uint8Array(packet.length + 8);
      dataPacket[0] = packetTypes.HEADER_0;
      dataPacket[1] = packetTypes.HEADER_1;
      dataPacket[2] = packetTypes.PACKET_TRANSMISSION;
      
      dataPacket[3] = randID;

      dataPacket[packet.length+4] = packetTypes.PACKET_DELIMITER_0;
      dataPacket[packet.length+5] = packetTypes.PACKET_DELIMITER_1;
      dataPacket[packet.length+6] = packetTypes.PACKET_DELIMITER_2;
      dataPacket[packet.length+7] = packetTypes.PACKET_DELIMITER_3;
      
      dataPacket.set(packet, 4);

      hewwoBuffer[2] = packetTypes.PACKET_END;
      packets.push(Uint8Array.from(dataPacket));
      packets.push(Uint8Array.from(hewwoBuffer));

      return packets;
    }

    const dataPacket = new Uint8Array(this.chunkSize + 8);
    dataPacket[0] = packetTypes.HEADER_0;
    dataPacket[1] = packetTypes.HEADER_1;
    dataPacket[2] = packetTypes.PACKET_TRANSMISSION;
    dataPacket[3] = randID;

    dataPacket[this.chunkSize+4] = packetTypes.PACKET_DELIMITER_0;
    dataPacket[this.chunkSize+5] = packetTypes.PACKET_DELIMITER_1;
    dataPacket[this.chunkSize+6] = packetTypes.PACKET_DELIMITER_2;
    dataPacket[this.chunkSize+7] = packetTypes.PACKET_DELIMITER_3;

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

        dataPacket.set(slicedData, 4);
        packets.push(Uint8Array.from(dataPacket));
        iterationCnt += 1;
      }
    }

    if (currentActualPos != 0) {
      const calcCurrentPos = (iterationCnt * this.chunkSize) - (iterationCnt);
      const remainingData = packet.length - calcCurrentPos;

      if (calcCurrentPos > packet.length)
        throw new Error("Current position greater than encrypted data length");

      const slicedData = packet.slice(
        calcCurrentPos + iterationCnt,
        calcCurrentPos + remainingData + iterationCnt
      );

      // Rebuild a temp array with our more exact information
      // FIXME: I don't really like ` - iterationCnt`. Maybe look into this?
      const dataPacket = new Uint8Array((remainingData + 8 - iterationCnt) > 0 ? (remainingData + 8 - iterationCnt) : 0);
      dataPacket[0] = packetTypes.HEADER_0;
      dataPacket[1] = packetTypes.HEADER_1;
      dataPacket[2] = packetTypes.PACKET_TRANSMISSION;
      dataPacket[3] = randID;

      dataPacket[slicedData.length+4] = packetTypes.PACKET_DELIMITER_0;
      dataPacket[slicedData.length+5] = packetTypes.PACKET_DELIMITER_1;
      dataPacket[slicedData.length+6] = packetTypes.PACKET_DELIMITER_2;
      dataPacket[slicedData.length+7] = packetTypes.PACKET_DELIMITER_3;

      try {
        dataPacket.set(slicedData, 4);
      } catch (e) {
        console.error("This packet is hosed. FIXME!!"); // FIXME
        
        hewwoBuffer[2] = packetTypes.PACKET_END;
        packets.push(Uint8Array.from(hewwoBuffer));

        return packets;
      }
      packets.push(Uint8Array.from(dataPacket));
    }

    // Time for cleanup
    hewwoBuffer[2] = packetTypes.PACKET_END;
    packets.push(Uint8Array.from(hewwoBuffer));

    return packets;
  }

  dechunk(chunkedPacket) {
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
        this.chunkedPackets[data[3]] = [];
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

        const packetPheonixEntry = this.chunkedPackets[packetPheonixEntryIndex];
        const mappedArray = data.slice(4, data.length);

        packetPheonixEntry.push(mappedArray);
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

        for (const packetEntry of packetPheonixEntry) {
          totalLenCalc += packetEntry.length;
        }
        const packetReconstructed = new Uint8Array(totalLenCalc);

        // I love doing the equivalent of memmap(?). Mapping my beloved
        let currentMapPos = 0;
        
        for (const packetEntry of packetPheonixEntry) {
          packetReconstructed.set(packetEntry, currentMapPos);
          currentMapPos += packetEntry.length;
        }

        this.chunkedPackets[packetPheonixEntryIndex] = undefined;
        returnData = packetReconstructed;
        continue;
      }
    }

    return returnData;
  }
}
