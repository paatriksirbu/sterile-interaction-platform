#!/usr/bin/env bash
# start-demo.sh — starts the full sterile-interaction-platform demo stack.
# Run from the project root: ./scripts/start-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOGS="$ROOT/logs"
PID_FILE="$ROOT/scripts/.demo-pids"
FRONTEND_DIR="$ROOT/frontend/web-client"
FRONTEND_PORT=3000

DEMO_PORTS=(8082 8083 8084 8085 8086 8087 8088 $FRONTEND_PORT)

declare -A SERVICES=(
  [gesture-service]="backend/gesture-service"
  [orchestrator-service]="backend/orchestrator-service"
  [session-service]="backend/session-service"
  [notifier-service]="backend/notifier-service"
  [resource-service]="backend/resource-service"
  [speech-service]="backend/speech-service"
  [annotation-service]="backend/annotation-service"
)


# ── helpers ──────────────────────────────────────────────────────────────────

red()   { echo -e "\033[0;31m$*\033[0m"; }
green() { echo -e "\033[0;32m$*\033[0m"; }
yellow(){ echo -e "\033[0;33m$*\033[0m"; }
blue()  { echo -e "\033[0;34m$*\033[0m"; }

die() { red "ERROR: $*"; exit 1; }

free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    yellow "  Freeing port $port (PIDs: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.5
  fi
}

wait_for_port() {
  local name=$1 port=$2 retries=30
  echo -n "  Waiting for $name on :$port "
  while ! nc -z localhost "$port" 2>/dev/null; do
    retries=$((retries - 1))
    [[ $retries -eq 0 ]] && { echo ""; red "  TIMEOUT waiting for $name"; return 1; }
    echo -n "."
    sleep 2
  done
  echo " ready"
}

start_service() {
  local name=$1
  local pom="$ROOT/${SERVICES[$name]}/pom.xml"
  [[ -f "$pom" ]] || die "pom.xml not found: $pom"
  mvn spring-boot:run -f "$pom" \
    > "$LOGS/${name}.log" 2>&1 &
  local pid=$!
  echo "$name $pid" >> "$PID_FILE"
  echo "  Started $name (PID $pid) → logs/${name}.log"
}

# ── preflight ─────────────────────────────────────────────────────────────────

echo ""
blue "=== Sterile Interaction Platform — Demo Start ==="
echo ""

command -v java  >/dev/null 2>&1 || die "Java not found. Install JDK 21+."
command -v mvn   >/dev/null 2>&1 || die "Maven not found."
command -v docker >/dev/null 2>&1 || die "Docker not found."

JAVA_VER=$(java -version 2>&1 | awk -F '"' '/version/ {print $2}' | cut -d. -f1)
[[ "$JAVA_VER" -ge 17 ]] 2>/dev/null || yellow "  Warning: Java $JAVA_VER detected — JDK 21 recommended"

echo "  Java:  $(java -version 2>&1 | head -1)"
echo "  Maven: $(mvn -version 2>&1 | head -1)"

# ── infra (RabbitMQ) ─────────────────────────────────────────────────────────

echo ""
blue "→ Starting RabbitMQ infra..."
docker compose -f "$ROOT/docker-compose.infra.yml" up -d
wait_for_port "RabbitMQ" 5672

# ── logs dir ─────────────────────────────────────────────────────────────────

mkdir -p "$LOGS"
: > "$PID_FILE"

# ── free ports ───────────────────────────────────────────────────────────────

echo ""
blue "→ Freeing demo ports..."
for p in "${DEMO_PORTS[@]}"; do free_port "$p"; done

# ── build ─────────────────────────────────────────────────────────────────────

echo ""
blue "→ Building shared module..."
mvn install -f "$ROOT/shared/surgical-shared-events/pom.xml" -DskipTests -q \
  || die "shared module build failed"
green "  shared module OK"

echo ""
blue "→ Building backend services..."
mvn install -f "$ROOT/backend/pom.xml" -DskipTests -q \
  || die "backend build failed"
green "  backend build OK"

# ── start services ────────────────────────────────────────────────────────────

echo ""
blue "→ Starting backend services..."
SERVICE_ORDER=(gesture-service orchestrator-service session-service notifier-service resource-service speech-service annotation-service)
for svc in "${SERVICE_ORDER[@]}"; do
  start_service "$svc"
  sleep 1
done

# ── wait for services ─────────────────────────────────────────────────────────

echo ""
blue "→ Waiting for services to accept connections..."
declare -A SERVICE_PORTS=(
  [gesture-service]=8082
  [orchestrator-service]=8083
  [session-service]=8084
  [notifier-service]=8085
  [resource-service]=8086
  [speech-service]=8087
  [annotation-service]=8088
)
for svc in "${SERVICE_ORDER[@]}"; do
  wait_for_port "$svc" "${SERVICE_PORTS[$svc]}" || true
done

# ── frontend static server ────────────────────────────────────────────────────

echo ""
blue "→ Starting frontend static server on :$FRONTEND_PORT..."
if command -v python3 >/dev/null 2>&1; then
  (cd "$FRONTEND_DIR" && python3 -m http.server $FRONTEND_PORT \
    > "$LOGS/frontend.log" 2>&1) &
  echo "frontend $!" >> "$PID_FILE"
  echo "  Started frontend server (PID $!) → logs/frontend.log"
elif command -v npx >/dev/null 2>&1; then
  (cd "$FRONTEND_DIR" && npx --yes serve -l $FRONTEND_PORT \
    > "$LOGS/frontend.log" 2>&1) &
  echo "frontend $!" >> "$PID_FILE"
  echo "  Started frontend server via npx serve (PID $!) → logs/frontend.log"
else
  yellow "  WARNING: python3 and npx not found — frontend server not started"
  yellow "  Serve $FRONTEND_DIR manually on port $FRONTEND_PORT"
fi

wait_for_port "frontend" $FRONTEND_PORT || true

# ── summary ───────────────────────────────────────────────────────────────────

echo ""
green "=== Demo stack is UP ==="
echo ""
echo "  Frontend:     http://localhost:3000/src/html/index.html"
echo "  Dashboard:    http://localhost:3000/src/html/dashboard.html"
echo "  RabbitMQ UI:  http://localhost:15672  (guest / guest)"
echo ""
echo "  PID file:     $PID_FILE"
echo "  Logs:         $LOGS/"
echo ""
echo "  Run ./scripts/check-demo.sh to verify all services."
echo "  Run ./scripts/stop-demo.sh  to shut everything down."
echo ""
