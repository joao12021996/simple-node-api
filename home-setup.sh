#!/usr/bin/env bash
# Sets up a home Linux PC (Ubuntu/Debian) to run the CoSpotle server in place of the droplet:
#   - the server (this repo) on localhost:1337, kept running by systemd
#   - Caddy on 127.0.0.1:8080 doing the same routing as on the droplet (no HTTPS here)
#   - a Cloudflare Tunnel that carries https://api.spotlegame.co.uk to that Caddy,
#     so no router ports are opened and Cloudflare handles the certificate
#
# Before running: create a tunnel in the Cloudflare dashboard
#   (Zero Trust > Networks > Tunnels > Create a tunnel > Cloudflared) and copy its token.
#
# Run as root on the PC:
#   curl -fsSL https://raw.githubusercontent.com/joao12021996/simple-node-api/master/home-setup.sh | sudo CF_TUNNEL_TOKEN=<token> bash
# Run it again any time (the token can be left out then) to update the server to the latest code.
# Then add the bb-bots relay with bb-bots/server/droplet-setup.sh, which works here unchanged.
set -euo pipefail

REPO="https://github.com/joao12021996/simple-node-api.git"
APP_DIR="/opt/cospotle"
CF_TUNNEL_TOKEN="${CF_TUNNEL_TOKEN:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this as root (sudo)." >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get install -y curl git ufw debian-keyring debian-archive-keyring apt-transport-https gnupg unattended-upgrades

# --- keep the PC awake and patched -------------------------------------------
systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target
dpkg-reconfigure -f noninteractive unattended-upgrades

# --- CoSpotle server -------------------------------------------------------
if ! command -v node >/dev/null; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
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

# --- Caddy (routing only; the tunnel brings traffic in) ----------------------
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update
  apt-get install -y caddy
fi
# other apps on this PC (e.g. the bb-bots relay) add their routes as files in sites.d
mkdir -p /etc/caddy/sites.d
cat > /etc/caddy/Caddyfile <<EOF
http://:8080 {
  bind 127.0.0.1
  import /etc/caddy/sites.d/*.caddy
  # Spotle calls https://api.spotlegame.co.uk/api/<route>; the server's routes have no /api
  handle_path /api/* {
    reverse_proxy localhost:1337
  }
  respond 404
}
EOF
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl reload caddy || systemctl restart caddy

# --- Cloudflare Tunnel ---------------------------------------------------------
if ! command -v cloudflared >/dev/null; then
  mkdir -p --mode=0755 /usr/share/keyrings
  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg -o /usr/share/keyrings/cloudflare-main.gpg
  echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" > /etc/apt/sources.list.d/cloudflared.list
  apt-get update
  apt-get install -y cloudflared
fi
if systemctl list-unit-files cloudflared.service >/dev/null 2>&1 && systemctl is-enabled --quiet cloudflared 2>/dev/null; then
  echo "cloudflared is already installed as a service; leaving it as is."
elif [ -n "$CF_TUNNEL_TOKEN" ]; then
  cloudflared service install "$CF_TUNNEL_TOKEN"
else
  echo "No CF_TUNNEL_TOKEN given and no tunnel service yet. Re-run with CF_TUNNEL_TOKEN=<token>." >&2
  exit 1
fi

# --- Firewall: nothing comes in except SSH from the home network --------------
ufw allow OpenSSH
ufw --force enable

echo
echo "Done. Local check: curl http://127.0.0.1:8080/api/onlineplayers"
echo "In the tunnel's Public Hostname settings, point your hostname at: HTTP  localhost:8080"
