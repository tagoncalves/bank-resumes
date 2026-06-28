#!/usr/bin/env sh

set -eu

. "$(dirname -- "$0")/common.sh"

bootstrap_stack
start_parser_background --port 8002

trap cleanup_parser EXIT INT TERM

wait_for_parser_health

echo "Iniciando web..."
cd "$ROOT_DIR"
npm --prefix "$WEB_DIR" run dev
