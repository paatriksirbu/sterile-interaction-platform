#!/usr/bin/env bash
# check-demo.sh — checks that all demo services are up and responsive.
# Run from the project root: ./scripts/check-demo.sh [--smoke]
# Pass --smoke to also send test payloads to gesture/annotation/speech endpoints.
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SMOKE=false
[[ "${1:-}" == "--smoke" ]] && SMOKE=true

PASS=0
FAIL=0

red()   { echo -e "\033[0;31m$*\033[0m"; }
green() { echo -e "\033[0;32m$*\033[0m"; }
yellow(){ echo -e "\033[0;33m$*\033[0m"; }
blue()  { echo -e "\033[0;34m$*\033[0m"; }

check_port() {
  local name=$1 port=$2
  if nc -z localhost "$port" 2>/dev/null; then
    green "  PASS  $name :$port — port open"
    PASS=$((PASS+1))
    return 0
  else
    red   "  FAIL  $name :$port — port closed"
    FAIL=$((FAIL+1))
    return 1
  fi
}

check_health() {
  local name=$1 url=$2
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 3 "$url" 2>/dev/null || echo "000")
  if [[ "$http_code" == "200" ]]; then
    green "  PASS  $name health → $url ($http_code)"
    PASS=$((PASS+1))
  else
    red   "  FAIL  $name health → $url ($http_code)"
    FAIL=$((FAIL+1))
  fi
}

check_orchestrator() {
  local pid_file="$ROOT/scripts/.demo-pids"
  local log_file="$ROOT/logs/orchestrator-service.log"
  local pid=""
  # find PID recorded for orchestrator-service
  if [[ -f "$pid_file" ]]; then
    pid=$(awk '/^orchestrator-service / {print $2}' "$pid_file" | tail -1)
  fi
  local pid_alive=false
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null && pid_alive=true
  local log_ok=false
  grep -q "Started OrchestratorServiceApplication" "$log_file" 2>/dev/null && log_ok=true

  if $pid_alive && $log_ok; then
    green "  PASS  orchestrator-service — PID $pid alive, log confirms started"
    PASS=$((PASS+1))
  elif $log_ok; then
    yellow "  WARN  orchestrator-service — log confirms started but PID $pid not found (may have been restarted)"
    PASS=$((PASS+1))
  else
    red   "  FAIL  orchestrator-service — PID not alive or 'Started OrchestratorServiceApplication' not in log"
    FAIL=$((FAIL+1))
  fi
}

smoke_post() {
  local name=$1 url=$2 payload=$3
  local http_code
  http_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    -X POST "$url" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/dev/null || echo "000")
  if [[ "$http_code" =~ ^2 ]]; then
    green "  PASS  $name smoke POST → $url ($http_code)"
    PASS=$((PASS+1))
  else
    red   "  FAIL  $name smoke POST → $url ($http_code)"
    FAIL=$((FAIL+1))
  fi
}

# ─────────────────────────────────────────────────────────────────────────────

echo ""
blue "=== Sterile Interaction Platform — Demo Health Check ==="
echo ""

# ── infrastructure ────────────────────────────────────────────────────────────

blue "── Infrastructure ──"
check_port  "RabbitMQ AMQP" 5672
check_port  "RabbitMQ UI  " 15672
check_port  "PostgreSQL    " 5432
echo ""

# ── backend services: port checks ─────────────────────────────────────────────

blue "── API Gateway ──"
check_port   "api-gateway        " 8080
check_health "api-gateway health " "http://localhost:8080/actuator/health"
echo ""

blue "── Backend services (port) ──"
check_port "gesture-service    " 8082
check_port "session-service    " 8084
check_port "notifier-service   " 8085
check_port "resource-service   " 8086
check_port "speech-service     " 8087
check_port "annotation-service " 8088
echo ""

blue "── orchestrator-service (RabbitMQ worker — no HTTP port) ──"
check_orchestrator
echo ""

# ── actuator health checks (services that expose it) ─────────────────────────

blue "── Actuator health endpoints ──"
check_health "session-service     " "http://localhost:8084/actuator/health"
check_health "resource-service    " "http://localhost:8086/actuator/health"
check_health "speech-service      " "http://localhost:8087/actuator/health"
check_health "annotation-service  " "http://localhost:8088/actuator/health"
echo ""

# ── frontend ──────────────────────────────────────────────────────────────────

blue "── Frontend ──"
check_port "frontend static server" 3000
check_health "dashboard.html      " "http://localhost:3000/src/html/dashboard.html"
check_health "index.html          " "http://localhost:3000/src/html/index.html"
check_health "viewer3d.html       " "http://localhost:3000/src/html/viewer3d.html"
check_health "surgical_plan.html  " "http://localhost:3000/src/html/surgical_plan.html"
check_health "live_feed.html      " "http://localhost:3000/src/html/live_feed.html"
echo ""

# ── smoke tests (optional) ────────────────────────────────────────────────────

if $SMOKE; then
  blue "── Smoke tests (--smoke) ──"

  GESTURE_SMOKE_SESSION="smoke-session-$$"

  smoke_post "gateway→gesture-service" \
    "http://localhost:8080/api/gestures" \
    "{\"sessionId\":\"$GESTURE_SMOKE_SESSION\",\"gestureType\":\"PINCH\",\"confidence\":0.95}"

  smoke_post "gesture-service (direct)" \
    "http://localhost:8082/api/gestures" \
    "{\"sessionId\":\"$GESTURE_SMOKE_SESSION\",\"gestureType\":\"PINCH\",\"confidence\":0.95}"

  # Allow a moment for the event pipeline to persist the session
  sleep 2

  # Verify the session was persisted and is retrievable via GET
  session_http=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
    "http://localhost:8084/api/sessions/$GESTURE_SMOKE_SESSION" 2>/dev/null || echo "000")
  if [[ "$session_http" == "200" ]]; then
    green "  PASS  session-service GET /api/sessions/$GESTURE_SMOKE_SESSION ($session_http) — session persisted in DB"
    PASS=$((PASS+1))
  else
    red   "  FAIL  session-service GET /api/sessions/$GESTURE_SMOKE_SESSION ($session_http) — session not found"
    FAIL=$((FAIL+1))
  fi

  # Also check list endpoint returns an array
  sessions_body=$(curl -s --max-time 5 "http://localhost:8084/api/sessions" 2>/dev/null || echo "[]")
  sessions_count=$(echo "$sessions_body" | grep -o '"sessionId"' | wc -l | tr -d ' ')
  if [[ "$sessions_count" -ge 1 ]]; then
    green "  PASS  session-service GET /api/sessions — found $sessions_count session(s)"
    PASS=$((PASS+1))
  else
    red   "  FAIL  session-service GET /api/sessions — 0 sessions returned"
    FAIL=$((FAIL+1))
  fi

  SMOKE_SESSION="check-demo-smoke-$$"
  smoke_post "annotation-service POST" \
    "http://localhost:8088/api/annotations" \
    "{\"sessionId\":\"$SMOKE_SESSION\",\"resourceId\":\"surgical-pdf-main\",\"annotationText\":\"smoke test\",\"viewerType\":\"PDF\"}"

  # GET annotations by sessionId — expect at least one result
  get_body=$(curl -s --max-time 5 \
    "http://localhost:8088/api/annotations?sessionId=$SMOKE_SESSION" 2>/dev/null || echo "[]")
  count=$(echo "$get_body" | grep -o '"id"' | wc -l | tr -d ' ')
  if [[ "$count" -ge 1 ]]; then
    green "  PASS  annotation-service GET → found $count annotation(s) for session $SMOKE_SESSION"
    PASS=$((PASS+1))
  else
    red   "  FAIL  annotation-service GET → 0 annotations for session $SMOKE_SESSION (DB persistence may be broken)"
    FAIL=$((FAIL+1))
  fi

  smoke_post "speech-service" \
    "http://localhost:8087/api/speech/transcriptions" \
    '{"sessionId":"smoke-session","recognizedText":"seleccionar","confidence":0.95}'

  echo ""
fi

# ── summary ───────────────────────────────────────────────────────────────────

TOTAL=$((PASS+FAIL))
echo "────────────────────────────────────"
if [[ $FAIL -eq 0 ]]; then
  green "ALL CHECKS PASSED ($PASS/$TOTAL)"
else
  red   "SOME CHECKS FAILED — $PASS passed, $FAIL failed out of $TOTAL"
  echo ""
  yellow "Troubleshooting:"
  yellow "  • Check logs/  for service startup errors"
  yellow "  • Run: ./scripts/start-demo.sh  to restart the stack"
  yellow "  • RabbitMQ must be up before any service starts"
fi
echo ""
