#!/bin/sh
# Start Redis in background
redis-server --daemonize yes --maxmemory 64mb --maxmemory-policy allkeys-lru

# Start Node.js backend
exec node dist/main
