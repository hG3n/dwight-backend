#!/usr/bin/env bash
# tsc && npm start

tsc-watch --onSuccess 'node ./build/server.js' --onFailure "terminal-notifier -title 'Error' -message 'Error during build' "


