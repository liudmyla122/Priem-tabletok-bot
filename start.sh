#!/bin/bash
# Start both server and worker
node dist/index.js &
node dist/scheduler/worker.js &
wait
