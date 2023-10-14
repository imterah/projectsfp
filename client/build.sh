#!/bin/bash
set -x
docker stop projectsfp
docker rm projectsfp
docker image rm projectsfp
docker build -t projectsfp .
docker create --name projectsfp --mount source=projectsfp-data,target=/files/data --env-file=".env" -p 8000:8000 projectsfp