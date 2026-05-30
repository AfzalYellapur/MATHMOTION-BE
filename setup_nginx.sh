set -e

DOMAIN_NAME="mathmotion.in" # e.g., api.yourdomain.com
EMAIL_ADDRESS="afzy.278@gmail.com" # Required for Let's Encrypt recovery
APP_PORT="4000" # As defined in your src/index.ts

echo "========================================="
echo " Setting up NGINX Reverse Proxy...       "
echo "========================================="

# 1. Install Nginx and Certbot
echo "-> Installing Nginx and Certbot..."
apt-get install -y nginx certbot python3-certbot-nginx

# 2. Configure Firewall (Optional but recommended)
echo "-> Configuring UFW firewall for Nginx..."
ufw allow 'Nginx Full' || true

# 3. Create Nginx Configuration
echo "-> Creating Nginx server block..."
cat > /etc/nginx/sites-available/mathmotion-be <<EOF
server {
    listen 80;
    server_name $DOMAIN_NAME;

    location / {
        proxy_pass http://localhost:$APP_PORT;
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

# 4. Enable Configuration
echo "-> Enabling Nginx site..."
ln -sf /etc/nginx/sites-available/mathmotion-be /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 5. Test and Restart Nginx
echo "-> Testing Nginx config and restarting..."
nginx -t
systemctl restart nginx

# 6. Apply Let's Encrypt SSL (Only if it's a real domain, skip if using IP)
if [[ "$DOMAIN_NAME" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "-> Skipping SSL Setup because $DOMAIN_NAME is an IP address."
else
    echo "-> Requesting SSL Certificate for $DOMAIN_NAME..."
    certbot --nginx -d $DOMAIN_NAME --non-interactive --agree-tos -m $EMAIL_ADDRESS --redirect
fi

echo "========================================="
echo " NGINX Setup Complete!                   "
echo "========================================="
