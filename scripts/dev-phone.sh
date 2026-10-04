#!/usr/bin/env bash
# Dev server over HTTPS on the local network, so a phone on the same Wi-Fi can use its camera
# (browsers only allow camera access on HTTPS pages). Self-signed cert: accept the warning once
# per device. Dev only — never use this to serve real client data outside the clinic network.
set -euo pipefail
# Exposing the dev server to the network is only safe with demo data. Refuse unless mock mode is on
# (env or .env), or DEV_PHONE_ALLOW_REAL_DB=1 is set deliberately.
if [[ "${LOCAL_MOCK:-}" != "true" ]] && ! grep -qE '^LOCAL_MOCK=["'"'"']?true' .env 2>/dev/null; then
  if [[ "${DEV_PHONE_ALLOW_REAL_DB:-}" != "1" ]]; then
    echo "Refusing: LOCAL_MOCK is not true, so this would expose real client data on the local network." >&2
    echo "Run with LOCAL_MOCK=true, or set DEV_PHONE_ALLOW_REAL_DB=1 if you really mean it." >&2
    exit 1
  fi
fi
PORT="${PORT:-3000}"
IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || hostname -I 2>/dev/null | awk '{print $1}')"
mkdir -p certificates
openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
  -keyout certificates/dev-key.pem -out certificates/dev-cert.pem \
  -subj "/CN=yoga-dev" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:${IP}" >/dev/null 2>&1
echo ""
echo "  On your phone (same Wi-Fi) open:  https://${IP}:${PORT}"
echo "  On this Mac:                      https://localhost:${PORT}"
echo "  Accept the certificate warning once on each device."
echo ""
exec npx next dev --experimental-https \
  --experimental-https-key certificates/dev-key.pem \
  --experimental-https-cert certificates/dev-cert.pem \
  -H 0.0.0.0 -p "$PORT"
