#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# push-to-pc.sh — transfer this project from the Arena sandbox to your PC
#                 through agent_bridge (github.com/cid0980/agent_bridge)
#
# Usage:
#   export BRIDGE_URL="https://<your-tunnel>.trycloudflare.com"
#   export BRIDGE_TOKEN="<token>"
#   export BRIDGE_DEST="$HOME/dev/class-teacher-app"     # optional
#   ./scripts/push-to-pc.sh [--dry-run]
#
# Method: the project is tarred + base64'd here, sent through /shell/run as a
# single quoted command, and decoded on your PC. No file-upload endpoint needed,
# so it works on v1/v2/v3 of the bridge alike.
#
# SAFETY:
#   • Read-only until the final decode step, which only writes inside $BRIDGE_DEST.
#   • Refuses to run if $BRIDGE_DEST exists and is non-empty (pass --force).
#   • Never uses sudo. Never touches anything outside $BRIDGE_DEST.
#   • --dry-run shows every command it *would* send and sends nothing.
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DRY_RUN=0; FORCE=0
for a in "$@"; do
  case "$a" in
    --dry-run) DRY_RUN=1 ;;
    --force)   FORCE=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

: "${BRIDGE_URL:?set BRIDGE_URL — e.g. export BRIDGE_URL=https://xxxx.trycloudflare.com}"
: "${BRIDGE_TOKEN:?set BRIDGE_TOKEN}"
BRIDGE_DEST="${BRIDGE_DEST:-$HOME/dev/class-teacher-app}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
H_TOKEN="X-Bridge-Token: ${BRIDGE_TOKEN}"
H_JSON="Content-Type: application/json"

send() { # send <json-body> <endpoint>
  curl -fsS -m "${BRIDGE_TIMEOUT:-120}" -X POST "${BRIDGE_URL}${2:-/shell/run}" \
       -H "$H_TOKEN" -H "$H_JSON" -d "$1"
}

echo "──────────────────────────────────────────────"
echo " bridge : ${BRIDGE_URL}"
echo " dest   : ${BRIDGE_DEST}"
echo " dry-run: $((DRY_RUN))    force: $((FORCE))"
echo "──────────────────────────────────────────────"

# 0 ── prove the link, read-only ─────────────────────────────────────────────
echo "▸ checking link…"
if (( DRY_RUN )); then
  echo "  [dry-run] GET /status"
else
  curl -fsS -m 30 "${BRIDGE_URL}/status" -H "$H_TOKEN" \
    | jq '{version, uptime_s, session, wayland, tunnel_url, disk_free_gb, jobs_running, ydotoold, firefox}' 2>/dev/null \
    || { echo "  /status unavailable — trying /system-info"; \
         curl -fsS -m 30 "${BRIDGE_URL}/system-info" -H "$H_TOKEN" | jq '{os, machine, cpu_cores, python, uptime_hours, ram, disk}' ; }
fi

# 1 ── build the payload locally ─────────────────────────────────────────────
echo "▸ packing project…"
PAYLOAD="$(cd "$ROOT" && tar czf - \
  --exclude=node_modules --exclude=.git --exclude=dist --exclude=.firebase \
  --exclude='.env' --exclude='.env.local' --exclude='.env.*.local' --exclude='.env.production' \
  . | base64 -w0)"
BYTES=${#PAYLOAD}
echo "  base64 payload: ${BYTES} bytes"

if (( BYTES > 900000 )); then
  echo "⚠ payload is large; /shell/run may truncate. Use /files/upload instead:" >&2
  echo "  curl -X POST \"\$BRIDGE_URL/files/upload\" -H \"\$H_TOKEN\" \\" >&2
  echo "       -F \"path=\$HOME/class-teacher-app.tar.gz\" -F \"file=@/tmp/cta.tar.gz\"" >&2
  exit 3
fi

# 2 ── guard: refuse to clobber an existing non-empty dir ────────────────────
GUARD="if [ -d \"$BRIDGE_DEST\" ] && [ -n \"\$(ls -A \"$BRIDGE_DEST\" 2>/dev/null)\" ]; then echo NONEMPTY; else echo OK; fi"
echo "▸ checking destination is safe to write…"
if (( DRY_RUN )); then
  echo "  [dry-run] $GUARD"
else
  RES="$(send "$(jq -n --arg c "$GUARD" '{command:$c}')")"
  OUT="$(jq -r '.output // ""' <<<"$RES")"
  printf '%s\n' "$OUT" | tail -n 2
  if grep -qx 'NONEMPTY' <<<"$OUT" && (( ! FORCE )); then
    echo "✋ $BRIDGE_DEST already exists and is not empty." >&2
    echo "   Re-run with --force to overwrite, or set BRIDGE_DEST to a fresh path." >&2
    exit 4
  fi
fi

# 3 ── transfer + decode ─────────────────────────────────────────────────────
CMD="mkdir -p \"$BRIDGE_DEST\" && printf '%s' '$PAYLOAD' | base64 -d | tar xzf - -C \"$BRIDGE_DEST\" && echo TRANSFER_OK && find \"$BRIDGE_DEST\" -maxdepth 2 -not -path '*/node_modules*' | sort"
echo "▸ transferring…"
if (( DRY_RUN )); then
  echo "  [dry-run] would send ${#CMD} bytes to /shell/run:"
  echo "  mkdir -p \"$BRIDGE_DEST\" && printf '%s' '<${BYTES} bytes of base64>' | base64 -d | tar xzf - -C \"$BRIDGE_DEST\" && echo TRANSFER_OK && find …"
else
  RES="$(send "$(jq -n --arg c "$CMD" '{command:$c}')")"
  OUT="$(jq -r '.output // ""' <<<"$RES")"
  printf '%s\n' "$OUT" | tail -n 18
  grep -qx 'TRANSFER_OK' <<<"$OUT" \
    && echo "✅ project is on your PC at ${BRIDGE_DEST}" \
    || { echo "❌ transfer did not confirm — response: $RES" >&2; exit 5; }
fi

# 4 ── what she does next ────────────────────────────────────────────────────
cat <<NEXT_STEPS

──────────────────────────────────────────────
 next steps on your PC
──────────────────────────────────────────────
  cd ${BRIDGE_DEST}
  cp .env.example .env          # MESSAGING_ENABLED stays false for now
  npm install
  npm run dev                   # frontend + backend

 ⚠ Read docs/03-deployment-and-operations.md §2 before creating the Firebase
   project: it must be owned by the teacher's Google account.

 🔒 When we're done: rotate the bridge token and kill the tunnel.
NEXT_STEPS
