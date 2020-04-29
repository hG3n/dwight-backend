#!/usr/bin/env bash
echo "Starting deployment"
echo "  Building..."
tsc

USER=pi
HOST=192.168.178.100
PATH=/home/pi/dwight/backend

echo "  Deploying archive"
/usr/bin/scp -r build/ $USER@$HOST:$PATH
/usr/bin/scp -r config/ $USER@$HOST:$PATH

