#!/bin/bash
set -e  # Exit on any error

# Log everything to /var/log/user-data.log
exec > >(tee /var/log/user-data.log|logger -t user-data -s 2>/dev/console) 2>&1

echo "=== Starting EC2 User Data setup ==="

# 1. Update system packages
echo "=== Updating system packages ==="
apt update && apt upgrade -y

# 2. Install Git
echo "=== Installing Git ==="
apt install git -y

# 3. Install Node.js 20 LTS
echo "=== Installing Node.js 20 ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install nodejs -y

# 4. Install Docker and Docker Compose
echo "=== Installing Docker ==="
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh
usermod -aG docker ubuntu
systemctl start docker
systemctl enable docker

# 5. Install PM2 globally
echo "=== Installing PM2 ==="
npm install -g pm2

echo "=== EC2 User Data setup complete! ==="
echo "Next steps:"
echo "1. SSH into the instance: ssh -i your-key.pem ubuntu@$(curl -s http://169.254.169.254/latest/meta-data/public-hostname)"
echo "2. Clone your repository"
echo "3. Set up .env file"
echo "4. Run docker compose up -d"
echo "5. Run npm run prisma:generate && npm run prisma:deploy && npm run build"
echo "6. Start bot and worker with PM2"
