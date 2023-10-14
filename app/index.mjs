import axios from "npm:axios";

const username = prompt("Username:");
const password = prompt("Password:");

const endpointPath = prompt("Client endpoint URL:");
const tokenData = await axios.post(endpointPath + "/api/v1/login", {
  username,
  password
});

const token = tokenData.data.token;
console.log("Logged in.");

async function listOpenConnections() {
  const connList = await axios.post(endpointPath + "/api/v1/getAllOpenConnections", {
    token
  });

  console.log("----- Open Connections -----\nconnType serverIP serverPort clientIP clientPort");
  for (const entry of connList.data.openConnections) {
    console.log(entry.type, entry.serverIP, entry.serverPort, entry.clientIP, entry.clientPort);
  }

  if (connList.data.sessionList) {
    console.log("\n\n----- Sessions -----");
    console.log("username ip");
    for (const session of connList.data.sessionList) {
      console.log(session.username, session.ip);
    }
  }
}

while (true) {
  const shellInputRaw = prompt(">");
  const shellInput = shellInputRaw.split(" ");

  switch (shellInput[0]) {
    default: {
      console.log("Unknown command. Type 'help' for help.")
      continue;
    }
    
    case "": {
      continue;
    }

    case "help": {
      continue;
    }

    case "exit": {
      Deno.exit(0);
      continue;
    }

    case "connectionSpy": {
      while (true) {
        console.clear();
        console.log("Getting open connection lists...");
        await listOpenConnections();

        console.log("----------------------------------");
        console.log("Refreshing every 3s");
        await new Promise((i) => setTimeout(i, 3000));
      }
    }

    case "listOpenConnections": {
      await listOpenConnections();
      continue;
    }

    case "add": {
      const protocol = prompt("Tunnel protocol [TCP/UDP]:");
      
      const ipRaw = prompt("IP:");
      const ip = ipRaw ?? "127.0.0.1";

      const port = prompt("Port:");
      
      const destPortRaw = prompt("Destination port:");
      const destPort = destPortRaw ?? port;

      await axios.post(endpointPath + "/api/v1/add", {
        token,

        protocol,
        ip,
        port,
        destPort
      });

      console.log("Successfully added tunnel.");
    }
  }
}