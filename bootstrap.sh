#!/bin/bash
# ==============================================================================
# OmniGrid Baseline Bootstrap Script v6.0 (Zero Trust Standard)
# Standar: Docker Engine + omnigrid-net + Cloudflare Tunnel + Secure SSH
# ==============================================================================

set -eo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

if [[ $EUID -ne 0 ]]; then
   echo -e "${RED}❌ Script ini harus dijalankan sebagai root. Gunakan: sudo bash $0${NC}"
   exit 1
fi

echo -e "\n${CYAN}====================================================${NC}"
echo -e "${CYAN}🚀 MEMULAI INISIASI HOST BASELINE OMNIGRID${NC}"
echo -e "${CYAN}====================================================${NC}\n"

# ---------------------------------------------------------
# 1. IDENTITAS & WAKTU
# ---------------------------------------------------------
echo -e "${BLUE}[1/7]${NC} 🕰️  Mengatur Timezone ke Asia/Jakarta..."
if command -v timedatectl &>/dev/null; then
    timedatectl set-timezone Asia/Jakarta || true
fi
echo -e "      ✅ Hostname terdeteksi: ${GREEN}$(hostname)${NC}"

# ---------------------------------------------------------
# 2. UPDATE REPOSITORY & DEPENDENSI DASAR
# ---------------------------------------------------------
echo -e "${BLUE}[2/7]${NC} 📦 Memperbarui package repository dan dependensi dasar..."
if [ -x "$(command -v apt-get)" ]; then
    export DEBIAN_FRONTEND=noninteractive
    
    # Tunggu background package lock jika sistem sedang update di background
    while fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1 || fuser /var/lib/apt/lists/lock >/dev/null 2>&1; do
        echo -e "      ${YELLOW}⏳ Menunggu background update sistem selesai...${NC}"
        sleep 5
    done
    
    apt-get update -y
    apt-get install -y --no-install-recommends curl wget git jq ca-certificates ufw
elif [ -x "$(command -v dnf)" ]; then
    dnf update -y
    dnf install -y curl wget git jq ca-certificates
elif [ -x "$(command -v pacman)" ]; then
    pacman -Sy --noconfirm curl wget git jq ca-certificates
fi

# ---------------------------------------------------------
# 3. PASTIKAN PORT SSH (22) TETAP AKTIF & DIIZINKAN
# ---------------------------------------------------------
echo -e "${BLUE}[3/7]${NC} 🔑 Memastikan akses SSH (Port 22) tetap aman & terbuka..."
if command -v systemctl &>/dev/null; then
    if systemctl list-unit-files | grep -q "sshd.service"; then
        systemctl enable sshd --now 2>/dev/null || true
    elif systemctl list-unit-files | grep -q "ssh.service"; then
        systemctl enable ssh --now 2>/dev/null || true
    fi
fi

# Jika UFW aktif, pastikan port 22 diizinkan agar operator tidak terkunci
if command -v ufw &>/dev/null; then
    if ufw status | grep -q "Status: active"; then
        ufw allow 22/tcp comment 'OmniGrid SSH Access' >/dev/null 2>&1 || true
        echo -e "      ✅ Firewall UFW: Rule Port 22/tcp diizinkan."
    fi
fi

# ---------------------------------------------------------
# 4. INSTALASI DOCKER ENGINE & LOG ROTATION
# ---------------------------------------------------------
echo -e "${BLUE}[4/7]${NC} 🐳 Memeriksa instalasi Docker Engine..."
if ! command -v docker &> /dev/null; then
    echo -e "      ⏳ Menginstal Docker melalui official installation script..."
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
else
    echo -e "      ✅ Docker Engine sudah terpasang ($(docker --version | cut -d',' -f1))."
fi

echo -e "      🛡️  Menerapkan konfigurasi log rotation Docker daemon..."
mkdir -p /etc/docker
DAEMON_JSON="/etc/docker/daemon.json"

if [ ! -f "$DAEMON_JSON" ] || [ ! -s "$DAEMON_JSON" ]; then
    cat <<EOF > "$DAEMON_JSON"
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  }
}
EOF
else
    # Jika daemon.json sudah ada, perbarui opsi log menggunakan jq secara aman
    if command -v jq &>/dev/null; then
        TMP_JSON=$(mktemp)
        jq '. + {"log-driver": "json-file", "log-opts": {"max-size": "10m", "max-file": "3"}}' "$DAEMON_JSON" > "$TMP_JSON" 2>/dev/null && mv "$TMP_JSON" "$DAEMON_JSON" || true
    fi
fi

# Restart docker untuk memuat config daemon jika berjalan via systemd
if command -v systemctl &>/dev/null; then
    systemctl restart docker || true
fi

# ---------------------------------------------------------
# 5. DOCKER NETWORK OMNIGRID (ISOLASI & DISCOVERY BOUNDARY)
# ---------------------------------------------------------
echo -e "${BLUE}[5/7]${NC} 🌐 Memeriksa Docker Network 'omnigrid-net'..."
if ! docker network ls --format '{{.Name}}' | grep -Eq "^omnigrid-net$"; then
    docker network create omnigrid-net
    echo -e "      ✅ Docker network ${GREEN}omnigrid-net${NC} berhasil dibuat."
else
    echo -e "      ✅ Docker network ${GREEN}omnigrid-net${NC} sudah aktif."
fi

# ---------------------------------------------------------
# 6. STRUKTUR DIREKTORI STANDAR & CLOUDFLARE TUNNEL
# ---------------------------------------------------------
echo -e "${BLUE}[6/7]${NC} 📂 Menyiapkan direktori standar di /opt..."
# Hanya buat folder standar yang sah (bebas sampah)
mkdir -p /opt/omnigrid /opt/cloudflared

# Template compose standar untuk service baru
cat > /opt/omnigrid/docker-compose.template.yml << 'EOF'
services:
  # ----------------------------------------------------
  # SERVICE 1: APLIKASI UTAMA (Web/API/Bot)
  # ----------------------------------------------------
  app-utama:
    # Gunakan 'image:' jika mengambil dari Docker Hub
    # image: nama-image:latest
    # ATAU gunakan 'build:' jika men-compile dari source code lokal
    build: .
    
    # WAJIB: Nama unik agar mudah dipanggil oleh Cloudflare Tunnel
    container_name: NAMA_APP_ANDA
    
    # WAJIB: Agar otomatis nyala jika server di-restart
    restart: unless-stopped
    
    # OPSIONAL TAPI PENTING: File variabel rahasia
    env_file:
      - .env
      
    # OPSIONAL: Untuk menyimpan data permanen (database/upload)
    # volumes:
    #   - ./data:/app/data
    
    # WAJIB: Sambungan ke LAN Virtual OmniGrid
    networks:
      - omnigrid-net

# ----------------------------------------------------
# DEKLARASI JARINGAN GLOBAL (WAJIB)
# ----------------------------------------------------
networks:
  omnigrid-net:
    external: true
EOF
echo -e "      ✅ Template compose standar: ${GREEN}/opt/omnigrid/docker-compose.template.yml${NC}"

cat > /opt/cloudflared/docker-compose.yml << 'EOF'
services:
  cloudflared:
    image: cloudflare/cloudflared:latest
    container_name: cloudflared-tunnel
    restart: unless-stopped
    command: tunnel --no-autoupdate run
    environment:
      - TUNNEL_TOKEN=${TUNNEL_TOKEN}
    networks:
      - omnigrid-net

networks:
  omnigrid-net:
    external: true
EOF

if [ ! -f /opt/cloudflared/.env ]; then
    cat > /opt/cloudflared/.env << 'EOF'
TUNNEL_TOKEN=PASTE_TOKEN_CLOUDFLARE_ANDA_DI_SINI
EOF
    chmod 600 /opt/cloudflared/.env
    echo -e "      ⚠️  File ${YELLOW}/opt/cloudflared/.env${NC} telah dibuat."
else
    echo -e "      ✅ File ${GREEN}/opt/cloudflared/.env${NC} sudah ada (tidak ditimpa)."
fi

# Atur kepemilikan direktori jika dijalankan dengan sudo
if [ -n "$SUDO_USER" ] && [ "$SUDO_USER" != "root" ]; then
    chown -R "$SUDO_USER:$SUDO_USER" /opt/omnigrid /opt/cloudflared 2>/dev/null || true
fi

# ---------------------------------------------------------
# 7. RINGKASAN & INSTRUKSI OPERASIONAL
# ---------------------------------------------------------
echo -e "\n${GREEN}====================================================${NC}"
echo -e "${GREEN}🎉 [SUKSES] Host $(hostname) telah sesuai Standar OmniGrid!${NC}"
echo -e "${GREEN}====================================================${NC}\n"

echo -e "${CYAN}📌 Langkah Operasional Selanjutnya:${NC}"
echo -e "  1. Masukkan Cloudflare Tunnel Token:"
echo -e "     ${YELLOW}nano /opt/cloudflared/.env${NC}"
echo -e "  2. Jalankan Cloudflare Tunnel:"
echo -e "     ${YELLOW}cd /opt/cloudflared && docker compose up -d${NC}"
echo -e "  3. Daftarkan Host ini ke OmniGrid Control Plane:"
echo -e "     Buka OmniGrid Dashboard -> Menu ${BLUE}Nodes${NC} -> Tambahkan IP/Host ini dengan user SSH & Port 22."
echo -e "  4. Standar Menjalankan Service Baru:"
echo -e "     Template compose: ${GREEN}/opt/omnigrid/docker-compose.template.yml${NC}"
echo -e "     Contoh: ${YELLOW}mkdir -p /opt/my-app && cp /opt/omnigrid/docker-compose.template.yml /opt/my-app/docker-compose.yml${NC}"
echo -e "     Pastikan service terhubung ke network ${GREEN}omnigrid-net${NC} (external: true)."
echo -e "     Publish domain di Cloudflare Zero Trust diarahkan ke: ${YELLOW}http://<container_name>:<port>${NC}\n"
