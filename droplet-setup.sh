#!/usr/bin/env bash
# Sets up a fresh Ubuntu 24.04 DigitalOcean droplet as:
#   1. the CoSpotle server (this repo), on port 1337, kept running by systemd
#   2. Caddy in front of it: https://api.spotlegame.co.uk/api/... -> CoSpotle,
#      with the HTTPS certificate fetched and renewed automatically
#   3. a personal WireGuard VPN, so all your traffic can go out through the droplet
#
# Run as root on the droplet:
#   curl -fsSL https://raw.githubusercontent.com/joao12021996/simple-node-api/master/droplet-setup.sh | bash
# Run it again later to add another VPN device:  bash droplet-setup.sh add-device <name>
set -euo pipefail

DOMAIN="api.spotlegame.co.uk"
REPO="https://github.com/joao12021996/simple-node-api.git"
APP_DIR="/opt/cospotle"
WG_PORT=51820
WG_NET="10.8.0"

add_device() {
  local name="$1"
  local n=$(( $(ls /etc/wireguard/clients/*.conf 2>/dev/null | wc -l) + 2 ))
  local priv pub
  priv=$(wg genkey); pub=$(echo "$priv" | wg pubkey)
  wg set wg0 peer "$pub" allowed-ips "$WG_NET.$n/32"
  printf '\n[Peer]\n# %s\nPublicKey = %s\nAllowedIPs = %s.%s/32\n' "$name" "$pub" "$WG_NET" "$n" >> /etc/wireguard/wg0.conf
  cat > "/etc/wireguard/clients/$name.conf" <<EOF
[Interface]
PrivateKey = $priv
Address = $WG_NET.$n/32
DNS = 1.1.1.1, 9.9.9.9

[Peer]
PublicKey = $(cat /etc/wireguard/server.pub)
Endpoint = $(curl -fsS4 https://ifconfig.me):$WG_PORT
AllowedIPs = 0.0.0.0/0, ::/0
PersistentKeepalive = 25
EOF
  echo "=== VPN device '$name' (scan with the WireGuard app) ==="
  qrencode -t ansiutf8 < "/etc/wireguard/clients/$name.conf"
  echo "Config file for a computer: /etc/wireguard/clients/$name.conf"
}

if [ "${1:-}" = "add-device" ]; then add_device "${2:?give the device a name}"; exit 0; fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get -y upgrade
apt-get install -y curl git ufw wireguard qrencode debian-keyring debian-archive-keyring apt-transport-https gnupg unattended-upgrades

# --- 1. CoSpotle -----------------------------------------------------------
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
systemctl enable --now cospotle
systemctl restart cospotle

# --- 2. Caddy (HTTPS) ------------------------------------------------------
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

# --- 3. WireGuard VPN ------------------------------------------------------
echo 'net.ipv4.ip_forward=1' > /etc/sysctl.d/99-wireguard.conf
echo 'net.ipv6.conf.all.forwarding=1' >> /etc/sysctl.d/99-wireguard.conf
sysctl --system >/dev/null
mkdir -p /etc/wireguard/clients
chmod 700 /etc/wireguard
if [ ! -f /etc/wireguard/wg0.conf ]; then
  IFACE=$(ip -4 route show default | awk '{print $5; exit}')
  wg genkey > /etc/wireguard/server.key
  wg pubkey < /etc/wireguard/server.key > /etc/wireguard/server.pub
  chmod 600 /etc/wireguard/server.key
  cat > /etc/wireguard/wg0.conf <<EOF
[Interface]
Address = $WG_NET.1/24
ListenPort = $WG_PORT
PrivateKey = $(cat /etc/wireguard/server.key)
PostUp = iptables -t nat -A POSTROUTING -s $WG_NET.0/24 -o $IFACE -j MASQUERADE; iptables -A FORWARD -i wg0 -j ACCEPT; iptables -A FORWARD -o wg0 -j ACCEPT
PostDown = iptables -t nat -D POSTROUTING -s $WG_NET.0/24 -o $IFACE -j MASQUERADE; iptables -D FORWARD -i wg0 -j ACCEPT; iptables -D FORWARD -o wg0 -j ACCEPT
EOF
  chmod 600 /etc/wireguard/wg0.conf
  systemctl enable --now wg-quick@wg0
fi

# --- Firewall --------------------------------------------------------------
sed -i 's/^DEFAULT_FORWARD_POLICY=.*/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow $WG_PORT/udp
ufw --force enable

[ -f /etc/wireguard/clients/phone.conf ] || add_device phone

echo
echo "Done. CoSpotle check: curl https://$DOMAIN/api/onlineplayers"
echo "Add a VPN device:     bash $APP_DIR/droplet-setup.sh add-device laptop"
