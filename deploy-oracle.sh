#!/bin/bash
# ==============================================================================
# Oracle Cloud Always Free 24/7 Automated Deployment Script
# Project: Binomo AI Signal Analyzer
# Repository: https://github.com/itzzpikun/binomo-ai-signal-analyzer
# ==============================================================================

set -e

echo "🚀 Starting 1-Click Setup on Oracle Cloud..."

# 1. System Updates & Essential Packages
echo "📦 Installing system dependencies..."
sudo apt update -y
sudo apt install -y curl git python3 python3-pip python3-venv nginx ufw iptables-persistent

# 2. Install Node.js 20 LTS (if not installed)
if ! command -v node &> /dev/null || [[ $(node -v | cut -d'.' -f1 | sed 's/v//') -lt 18 ]]; then
    echo "📦 Installing Node.js 20 LTS..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
fi

echo "✅ Node version: $(node -v)"
echo "✅ Python version: $(python3 --version)"

# 3. Install PM2 (Process Manager for 24/7 Uptime)
sudo npm install -g pm2

# 4. Clone or pull latest code
REPO_DIR="$HOME/binomo-ai-signal-analyzer"
if [ ! -d "$REPO_DIR" ]; then
    echo "📥 Cloning repository..."
    git clone https://github.com/itzzpikun/binomo-ai-signal-analyzer.git "$REPO_DIR"
else
    echo "🔄 Pulling latest updates..."
    cd "$REPO_DIR" && git pull origin main
fi

cd "$REPO_DIR"

# 5. Setup Python AI Engine
echo "🐍 Setting up Python AI Engine..."
cd "$REPO_DIR/ai-engine"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 6. Setup Frontend Build
echo "⚛️ Building Frontend static production files..."
cd "$REPO_DIR/frontend"
npm install
npm run build

# 7. Setup Backend
echo "⚡ Building Backend Express server..."
cd "$REPO_DIR/backend"
npm install
npm run build

# Create backend .env
cat <<EOF > "$REPO_DIR/backend/.env"
NODE_ENV=production
PORT=5001
AI_ENGINE_URL=http://127.0.0.1:8000
TWELVE_DATA_API_KEY=2722ed98484d448f912b7019c92676ae
EOF

# 8. Configure PM2 for Auto-Start & 24/7 Uptime
echo "⚙️ Configuring PM2 process manager..."
pm2 delete all || true

# Start AI Engine
cd "$REPO_DIR/ai-engine"
pm2 start ./venv/bin/python3 --name "ai-engine" -- app.py

# Start Backend Server (which also serves the frontend build)
cd "$REPO_DIR/backend"
pm2 start npm --name "backend" -- run start

# Save PM2 process list to restart automatically on reboot
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u $USER --hp $HOME || true

# 9. Configure Nginx Reverse Proxy
echo "🌐 Configuring Nginx reverse proxy..."
sudo rm -f /etc/nginx/sites-enabled/default
cat <<EOF | sudo tee /etc/nginx/sites-available/binomo-analyzer
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/binomo-analyzer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
sudo systemctl enable nginx

# 10. Open Oracle Cloud Linux Firewall Ports (Oracle iptables defaults block port 80/443)
echo "🔓 Configuring firewall for HTTP port 80..."
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save || true

PUBLIC_IP=$(curl -s ifconfig.me || echo "<YOUR_ORACLE_IP>")

echo ""
echo "=============================================================================="
echo "🎉 DEPLOYMENT COMPLETE! 24/7 SERVER IS LIVE!"
echo "=============================================================================="
echo "👉 Open in your phone or browser:"
echo "   http://$PUBLIC_IP"
echo ""
echo "PM2 Status:"
pm2 status
echo "=============================================================================="
