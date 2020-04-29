#!/usr/bin/env bash
echo "Starting deployment"
echo "  Building..."
tsc

USER=root
HOST=children-of-gazimba.io
PATH=/home/hGen/servers/secure-login

echo "  Deploying archive"
/usr/bin/scp -r build/ $USER@$HOST:$PATH
/usr/bin/scp -r config/ $USER@$HOST:$PATH

