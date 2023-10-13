# Project SFP
## Simple Forward Port
Simple Forward Port lets you effectively do port forwarding across multiple networks.
## Folder Structure
Both of these are Node.JS projects:  
  - `client`: This is the UI. It's role is to send the traffic to the server when requested.
  - `server`: This informs the `client` on when connections are happening, and to facilitate connections itself.
## Docker installation
1. Go into one of the projects directories.
2. If on the client, create the initial .env file, with the username and password set: `INIT_USERNAME=username` and `INIT_PASSWORD=password`
3. If on the server, copy the base config file and edit it to your needs.
4. Build the docker image: `docker build -t projectsfp .`
5. Create the docker container: `docker create <args> passyfire`. If you need `.env` for the client, add `--env-file=".env"`. If you want native networking (recommended for the server), add `--network="host"`. Else, add: `-p 8000:8000 -p 8080:8080`