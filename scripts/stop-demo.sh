#!/usr/bin/env bash
# stop-demo.sh — stops all services started by start-demo.sh.
# Run from the project root: ./scripts/stop-demo.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_FILE="$ROOT/scripts/.demo-pids"

DEMO_PORTS=(8082 8083 8084 8085 8086 8087 8088 3000)

red()   { echo -e "\033[0;31m$*\033[0m"; }
green() { echo -e "\033[0;32m$*\033[0m"; }
yellow(){ echo -e "\033[0;33m$*\033[0m"; }
blue()  { echo -e "\033[0;34m$*\033[0m"; }

echo ""
blue "=== Sterile Interaction Platform — Demo Stop ==="
echo ""

# ── stop by PID file ──────────────────────────────────────────────────────────

if [[ -f "$PID_FILE" ]]; then
  while IFS=' ' read -r name pid; do
    [[ -z "$pid" ]] && continue
    if kill -0 "$pid" 2>/dev/null; then
      echo "  Stopping $name (PID $pid)..."
      kill "$pid" 2>/dev/null || true
      # give it a moment to exit gracefully
      sleep 0.5
      kill -9 "$pid" 2>/dev/null || true
    else
      echo "  $name (PID $pid) already stopped"
    fi
  done < "$PID_FILE"
  rm -f "$PID_FILE"
  green "  PID file removed"
else
  yellow "  No PID file found at $PID_FILE"
fi

# ── force-kill any remaining processes on demo ports ─────────────────────────

echo ""
blue "→ Sweeping demo ports for remaining processes..."
for port in "${DEMO_PORTS[@]}"; do
  pids=$(lsof -ti :"$port" 2>/dev/null || true)
  if [[ -n "$pids" ]]; then
    yellow "  Force-killing remaining process on :$port (PIDs: $pids)"
    echo "$pids" | xargs kill -9 2>/dev/null || true
  fi
done

# ── RabbitMQ infra ────────────────────────────────────────────────────────────

echo ""
read -r -p "Stop RabbitMQ infra (docker compose)? [y/N] " STOP_RABBIT
if [[ "${STOP_RABBIT,,}" == "y" ]]; then
  docker compose -f "$ROOT/docker-compose.infra.yml" stop
  green "  RabbitMQ stopped"
else
  yellow "  RabbitMQ left running (stop manually: docker compose -f docker-compose.infra.yml stop)"
fi

echo ""
green "=== Demo stack stopped ==="
echo ""
