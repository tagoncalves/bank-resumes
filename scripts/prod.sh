#!/usr/bin/env sh

set -eu

. "$(dirname -- "$0")/common.sh"

bootstrap_stack

echo "Compilando web..."
npm --prefix "$WEB_DIR" run build

start_parser_background --host 0.0.0.0 --port 8002

trap cleanup_parser EXIT INT TERM

wait_for_parser_health

echo "Iniciando web en modo producción..."
cd "$ROOT_DIR"
npm --prefix "$WEB_DIR" run start
