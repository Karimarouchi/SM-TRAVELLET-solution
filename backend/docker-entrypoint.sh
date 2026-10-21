#!/bin/sh
set -e
mkdir -p /app/uploads /app/logs
chown -R node:node /app/uploads /app/logs
exec su-exec node "$@"
