#!/bin/bash

# Install dependencies
apt-get update
apt-get install -y $(cat aptfile)

# Navigate into our directory and install Node.js dependencies
cd "$DEPLOYMENT_SOURCE"
npm install