# WARNING
THIS IS NOT FINAL. Anything here will likely not be implemented as-is.
# Notes
* Everything (incl. packet transmission) uses public/private key authentication.
# Client
## Pairing
* Connects to an HTTP server running on SFP to ask it if it can pair.
* If successful, it will connect to a different endpoint and give it a public key, and then save the public and private key to a database.
## Port Transmission
* After the server starts/pairing succeeds, it sends a list of ports it should proxy over WebSockets, and the server should validate that those are not up. 
## On Connect Transmission
* After the server tells the client that there was a connection established, we open a TCP/UDP connection to somewhere, which is also going to be end to end encrypted.
## Actual Connection and Data Transmission
* Whenever the server sends data, with headers (detailed below), it gets forwarded without the headers, as well as decrypted.
  - DGram has a header before every request, telling it what client its for
  - Regular TCP/IP has a header before it is initiated.
# Server
## Pairing
* When it recieves a pairing request, it asks the user in the console if it would like to accept, if the IP is not blacklisted or whitelisted.
  - The user could also just put it in an auto acceptance list. It behave likes whitelisting except it is automatically accepted.
  - If those checks pass, return `true`.
* When it recieves an actual pair HTTP request, we save the public key, generate a public and private key, and give it the public key, while saving a private key.
## Port Transmission
* The server should have a WebSocket server listening. On data recieve, it should detect if the port is up, and if it is, the server should tell the server that an error occured.
## On Connect Transmission
* When the server detects that there was a connection/dgram request to the port, it notifies the client over that WebSockets connection.