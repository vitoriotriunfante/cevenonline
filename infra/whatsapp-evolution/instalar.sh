#!/usr/bin/env bash
# Instala o servidor de WhatsApp (Evolution API) numa maquina Ubuntu da Oracle Cloud (Always Free).
# Como usar (dentro da maquina, depois de entrar por SSH):
#   curl -fsSL https://raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/infra/whatsapp-evolution/instalar.sh | bash
# Pode rodar de novo sem medo: reaproveita a chave e a senha ja criadas.
# No fim cria o arquivo ~/evolution/resultado_para_o_claude.txt com o endereco e a chave (NAO mande o conteudo pelo chat).
set -euo pipefail

PASTA="$HOME/evolution"
RAW="https://raw.githubusercontent.com/vitoriotriunfante/cevenonline/main/infra/whatsapp-evolution"

echo "== 1/7 Atualizando a maquina e instalando o basico"
sudo apt-get update -y
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y curl ca-certificates openssl iptables-persistent

echo "== 2/7 Liberando as portas 80 e 443 no firewall da maquina"
sudo iptables -C INPUT -p tcp --dport 80 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport 80 -j ACCEPT
sudo iptables -C INPUT -p tcp --dport 443 -j ACCEPT 2>/dev/null || sudo iptables -I INPUT 1 -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save

echo "== 3/7 Memoria extra (so se a maquina for pequena)"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
if [ "$MEM_MB" -lt 3000 ] && [ ! -f /swapfile ]; then
  sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab >/dev/null
  echo "   criei 2 GB de memoria extra (a maquina tem ${MEM_MB} MB)"
fi

echo "== 4/7 Instalando o Docker"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sudo sh
fi
sudo systemctl enable --now docker

echo "== 5/7 Baixando a configuracao e criando as senhas desta maquina"
mkdir -p "$PASTA"
cd "$PASTA"
[ -f docker-compose.yml ] || curl -fsSL "$RAW/docker-compose.yml" -o docker-compose.yml
IP=$(curl -fsS -m 10 https://api.ipify.org || curl -fsS -m 10 https://ifconfig.me)
DOMINIO="$(echo "$IP" | tr . -).sslip.io"
if [ ! -f .env ]; then
  CHAVE=$(openssl rand -hex 24)
  SENHA_DB=$(openssl rand -hex 16)
  cat > .env <<EOF
POSTGRES_PASSWORD=$SENHA_DB
SERVER_URL=https://$DOMINIO
AUTHENTICATION_API_KEY=$CHAVE
AUTHENTICATION_EXPOSE_IN_FETCH_INSTANCES=true
DATABASE_PROVIDER=postgresql
DATABASE_CONNECTION_URI=postgresql://evolution:$SENHA_DB@postgres:5432/evolution?schema=public
DATABASE_CONNECTION_CLIENT_NAME=ceven
DATABASE_SAVE_DATA_INSTANCE=true
DATABASE_SAVE_DATA_NEW_MESSAGE=false
DATABASE_SAVE_MESSAGE_UPDATE=false
DATABASE_SAVE_DATA_CONTACTS=false
DATABASE_SAVE_DATA_CHATS=false
CACHE_REDIS_ENABLED=true
CACHE_REDIS_URI=redis://redis:6379/6
CACHE_REDIS_PREFIX_KEY=evolution
CACHE_REDIS_SAVE_INSTANCES=false
CACHE_LOCAL_ENABLED=false
CONFIG_SESSION_PHONE_CLIENT=CEVEN
CONFIG_SESSION_PHONE_NAME=Chrome
QRCODE_LIMIT=30
DEL_INSTANCE=false
LANGUAGE=pt-BR
EOF
  chmod 600 .env
else
  # reaproveita a chave e a senha; so atualiza o endereco caso o IP tenha mudado
  sed -i "s|^SERVER_URL=.*|SERVER_URL=https://$DOMINIO|" .env
fi
printf '%s {\n  reverse_proxy evolution-api:8080\n}\n' "$DOMINIO" > Caddyfile

echo "== 6/7 Ligando os servicos (a primeira vez baixa as imagens e demora uns minutos)"
sudo docker compose pull
sudo docker compose up -d

echo "== 7/7 Esperando o servidor responder em https://$DOMINIO (o certificado HTTPS pode levar ate 2 minutos)"
OK=0
for i in $(seq 1 40); do
  if curl -fsS -m 8 "https://$DOMINIO/" >/dev/null 2>&1; then OK=1; break; fi
  sleep 5
done

CHAVE_FINAL=$(grep '^AUTHENTICATION_API_KEY=' .env | cut -d= -f2-)
cat > resultado_para_o_claude.txt <<EOF
EVO_URL=https://$DOMINIO
EVO_KEY=$CHAVE_FINAL
EVO_INSTANCE=ceven-noc
EOF
chmod 600 resultado_para_o_claude.txt

echo
if [ "$OK" = "1" ]; then
  echo "PRONTO. O servidor de WhatsApp esta no ar em: https://$DOMINIO"
else
  echo "O servidor foi instalado, mas ainda nao respondeu em https://$DOMINIO."
  echo "Confira se as portas 80 e 443 estao liberadas no painel da Oracle (Security List) e rode este comando de novo."
fi
echo "Painel para conectar o WhatsApp: https://$DOMINIO/manager"
echo "Os dados de acesso estao em: $PASTA/resultado_para_o_claude.txt  (nao envie o conteudo pelo chat)"
