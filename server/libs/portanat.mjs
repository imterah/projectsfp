import dgram from "node:dgram";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function splitUint8Array(uint8Array, delimiters, count = Infinity) {
  const result = [];
  let startIndex = 0;

  for (let i = 0; i < uint8Array.length; i++) {
    // Check if the requested count is greater than the current chunk size.
    if (result.length-1 > count) break;

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

// Port address translation
export class Patter {
  constructor(serverIP, serverPort, connMode = "udp4") {
    this.sockets = {};
    this.connMode = connMode;

    this.ip = serverIP;
    this.port = serverPort;
  }

  #getSocketData(ip, port) {
    if (!this.sockets[port]) this.init(ip, port);
    let socket = this.sockets[port];
    let tryCnt = 1;

    while (socket.ip != ip) {
      console.error("IP differs but port is the same! Initiating PAT...");
      socket = this.sockets[port+tryCnt];

      if (!this.sockets[port+1]) this.init(ip, port);
      tryCnt++;
    }

    return socket;
  }

  sendOnBehalfOfIP(msg, ip, port) {
    const { socket } = this.#getSocketData(ip, port);
    socket.send(msg, this.ip, this.port);
  }

  init(ip, port) {
    if (this.sockets[port]) return false;

    this.sockets[port] = {
      ip,
      socket: dgram.createSocket("udp4")
    }

    return true;
  }

  subscribeOnMessageFor(ip, port, callback) {
    const { socket } = this.#getSocketData(ip, port);
    socket.on("message", callback);
  }
}

export function encodeUDPWrappedPacket(ip, port, msg) {
  const encodedIP = encoder.encode(ip);
  const encodedPort = encoder.encode(port);

  const newUint = new Uint8Array(encodedIP.length+encodedPort.length+msg.length+4);

  newUint[encodedIP.length+0] = 0xFF;
  newUint[encodedIP.length+1] = 0xFF;
  newUint[encodedIP.length+encodedPort.length+2] = 0xFF;
  newUint[encodedIP.length+encodedPort.length+3] = 0xFF;

  newUint.set(encodedIP, 0);
  newUint.set(encodedPort, encodedIP.length+2);
  
  newUint.set(msg, encodedIP.length+encodedPort.length+4);

  return newUint;
}

export function decodeUDPWrappedPacket(msg) {
  const udpWrappedSplitPacket = splitUint8Array(msg, [
    0xFF,
    0xFF
  ], 2);

  return {
    ip: decoder.decode(udpWrappedSplitPacket[0]),
    port: parseInt(decoder.decode(udpWrappedSplitPacket[1])),

    msg: udpWrappedSplitPacket[2],
  }
}