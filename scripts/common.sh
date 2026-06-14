#!/usr/bin/env sh

set -eu

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PARSER_DIR="$ROOT_DIR/parser"
WEB_DIR="$ROOT_DIR/web"
PARSER_VENV="$PARSER_DIR/.venv"
PARSER_PYTHON="$PARSER_VENV/bin/python"

require_dir() {
  if [ ! -d "$1" ]; then
    echo "Falta el directorio $2"
    exit 1
  fi
}

resolve_system_python() {
  if command -v python3 >/dev/null 2>&1; then
    echo "python3"
    return
  fi

  if command -v python >/dev/null 2>&1; then
    echo "python"
    return
  fi

  echo ""
}

require_commands() {
  if ! command -v node >/dev/null 2>&1; then
    echo "No se encontró Node.js en PATH"
    exit 1
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "No se encontró npm en PATH"
    exit 1
  fi

  SYSTEM_PYTHON=$(resolve_system_python)
  if [ -z "$SYSTEM_PYTHON" ]; then
    echo "No se encontró Python 3.10+ en PATH"
    exit 1
  fi
}

ensure_parser_venv() {
  if [ ! -d "$PARSER_VENV" ]; then
    echo "Creando entorno virtual del parser..."
    "$SYSTEM_PYTHON" -m venv "$PARSER_VENV"
  fi
}

install_parser_deps() {
  echo "Instalando dependencias del parser..."
  "$PARSER_PYTHON" -m pip install -r "$PARSER_DIR/requirements.txt"
}

install_web_deps() {
  echo "Instalando dependencias de la web..."
  npm --prefix "$WEB_DIR" install
}

configure_env() {
  export DATABASE_URL="${DATABASE_URL:-file:./prisma/dev.db}"
  export PARSER_SERVICE_URL="${PARSER_SERVICE_URL:-http://localhost:8001}"
}

prepare_web_db() {
  echo "Sincronizando base de datos..."
  npm --prefix "$WEB_DIR" run db:push

  echo "Cargando seed inicial..."
  npm --prefix "$WEB_DIR" run db:seed
}

start_parser_background() {
  echo "Iniciando parser..."
  cd "$PARSER_DIR"
  "$PARSER_PYTHON" -m uvicorn main:app "$@" &
  PARSER_PID=$!
}

cleanup_parser() {
  if [ -n "${PARSER_PID:-}" ] && kill -0 "$PARSER_PID" >/dev/null 2>&1; then
    kill "$PARSER_PID" >/dev/null 2>&1 || true
  fi
}

wait_for_parser_health() {
  echo "Esperando healthcheck del parser..."
  i=0
  while [ "$i" -lt 30 ]; do
    if command -v curl >/dev/null 2>&1; then
      if curl -fsS "http://localhost:8001/health" >/dev/null 2>&1; then
        return
      fi
    else
      if "$PARSER_PYTHON" - <<'PY' >/dev/null 2>&1
from urllib.request import urlopen
urlopen("http://localhost:8001/health", timeout=2)
PY
      then
        return
      fi
    fi
    i=$((i + 1))
    sleep 1
  done

  echo "El parser no respondió en http://localhost:8001/health"
  exit 1
}

bootstrap_stack() {
  require_dir "$PARSER_DIR" "parser"
  require_dir "$WEB_DIR" "web"
  require_commands
  ensure_parser_venv
  install_parser_deps
  install_web_deps
  configure_env
  prepare_web_db
}
