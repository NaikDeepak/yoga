#!/bin/bash
# Connects to the Production Database using psql
# Loads PROD_DATABASE_URL from the .env file

source .env

if [ -z "$PROD_DATABASE_URL" ]; then
    echo "Error: PROD_DATABASE_URL is not set in .env"
    exit 1
fi

echo "Connecting to Production Database..."
/opt/homebrew/opt/postgresql@18/bin/psql "$PROD_DATABASE_URL"
