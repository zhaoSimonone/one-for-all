#!/bin/bash
# Backward-compatible entrypoint. Use deploy-full.sh for the actual deployment.
set -e
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
exec "$SCRIPT_DIR/deploy-full.sh"
