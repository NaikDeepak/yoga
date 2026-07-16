#!/bin/bash
# Starts the Next.js app connected to the Production Database

# Load variables from .env
set -a
source .env
set +a

if [ -z "$PROD_DATABASE_URL" ]; then
    echo "Error: PROD_DATABASE_URL is not set in .env"
    exit 1
fi

echo "Starting Next.js connected to Production Database..."
export DATABASE_URL=$PROD_DATABASE_URL
npx next dev
