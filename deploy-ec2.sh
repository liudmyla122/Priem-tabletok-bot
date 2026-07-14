#!/bin/bash
# Med Reminder Bot - EC2 Deployment Script
# Usage: ./deploy-ec2.sh <ec2-public-dns> <path-to-pem-file> <git-repo-url>

set -e

if [ $# -ne 3 ]; then
    echo "Usage: $0 <ec2-public-dns> <path-to-pem-file> <git-repo-url>"
    echo "Example: $0 ec2-xx-xx-xx-xx.us-east-1.compute.amazonaws.com ~/.ssh/my-key.pem https://github.com/username/med-reminder-bot.git"
    exit 1
fi

EC2_DNS=$1
PEM_FILE=$2
GIT_REPO=$3

echo "=== Deploying Med Reminder Bot to EC2 ==="
echo "EC2 DNS: $EC2_DNS"
echo "PEM file: $PEM_FILE"
echo "Git repo: $GIT_REPO"

# Copy .env file to EC2 (if exists locally)
if [ -f .env ]; then
    echo "=== Copying .env file to EC2 ==="
    scp -i "$PEM_FILE" .env ubuntu@$EC2_DNS:~/
fi

# Run deployment commands on EC2
echo "=== Running deployment commands on EC2 ==="
ssh -i "$PEM_FILE" ubuntu@$EC2_DNS << 'EOF'
set -e

# Wait a bit for User Data to finish (just in case)
echo "=== Waiting for initial setup to complete ==="
sleep 10

# Clone or pull the repo
if [ -d "med-reminder-bot" ]; then
    echo "=== Repository exists, pulling latest changes ==="
    cd med-reminder-bot
    git pull
else
    echo "=== Cloning repository ==="
    git clone $GIT_REPO med-reminder-bot
    cd med-reminder-bot
fi

# If .env was copied from local, move it to project dir
if [ -f ~/.env ]; then
    echo "=== Moving .env file to project directory ==="
    mv ~/.env .
fi

# Install npm dependencies
echo "=== Installing npm dependencies ==="
npm install

# Start Docker services (Postgres + Redis)
echo "=== Starting Docker services ==="
docker compose -f docker-compose.prod.yml up -d

# Wait for Postgres to be ready
echo "=== Waiting for Postgres to be ready ==="
sleep 10

# Run Prisma migrations
echo "=== Running Prisma migrations ==="
npm run prisma:generate
npm run prisma:deploy

# Build the project
echo "=== Building project ==="
npm run build

# Stop old PM2 processes if running
echo "=== Stopping old PM2 processes ==="
pm2 delete medbot-server 2>/dev/null || true
pm2 delete medbot-worker 2>/dev/null || true

# Start bot and worker with PM2
echo "=== Starting bot and worker with PM2 ==="
pm2 start dist/index.js --name medbot-server
pm2 start dist/scheduler/worker.js --name medbot-worker

# Save PM2 configuration
pm2 save

# Setup PM2 startup (if not already set up)
pm2 startup | tail -n 1 | bash || true

echo "=== Deployment complete! ==="
echo "Check status with: pm2 status"
echo "View logs with: pm2 logs"
EOF

echo "=== Done! Bot should be up and running. ==="
