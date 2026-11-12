#!/usr/bin/env bash
# Sets up a fresh Ubuntu 24.04 DigitalOcean droplet to run the CoSpotle server:
#   - the server (this repo) on port 1337, kept running by systemd
#   - Caddy in front of it: https://api.spotlegame.co.uk/api/... -> CoSpotle,
#     with the HTTPS certificate fetched and renewed automatically
#
# Run as root on the droplet:
#   curl -fsSL https://raw.githubusercontent.com/joao12021996/simple-node-api/master/droplet-setup.sh | bash
# Run it again any time to update the server to the latest code.
set -euo pipefail

DOMAIN="api.spotlegame.co.uk"
REPO="https://github.com/joao12021996/simple-node-api.git"
APP_DIR="/opt/cospotle"

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get install -y curl git ufw debian-keyring debian-archive-keyring apt-transport-https gnupg unattended-upgrades

# --- CoSpotle server -------------------------------------------------------
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
if [ -d "$APP_DIR/.git" ]; then git -C "$APP_DIR" pull; else git clone "$REPO" "$APP_DIR"; fi
(cd "$APP_DIR" && npm ci --omit=dev)

cat > /etc/systemd/system/cospotle.service <<EOF
[Unit]
Description=CoSpotle server
After=network.target

[Service]
WorkingDirectory=$APP_DIR
ExecStart=/usr/bin/node server.js
Environment=PORT=1337
Restart=always
DynamicUser=yes

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable cospotle
systemctl restart cospotle

# --- Caddy (HTTPS) ---------------------------------------------------------
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
cat > /etc/caddy/Caddyfile <<EOF
$DOMAIN {
  # Spotle calls https://$DOMAIN/api/<route>; the server's routes have no /api
  handle_path /api/* {
    reverse_proxy localhost:1337
  }
  respond 404
}
EOF
systemctl reload caddy || systemctl restart caddy

# --- Firewall --------------------------------------------------------------
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo
echo "Done. Check: curl https://$DOMAIN/api/onlineplayers"
