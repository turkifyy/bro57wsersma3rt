#!/bin/bash
# ══════════════════════════════════════════════════════════
#  entrypoint.sh
#  1. يشغّل Android Emulator (noVNC)
#  2. ينتظر اكتمال التشغيل
#  3. يحمّل TikTok APK ويثبّته تلقائياً
#  4. يشغّل Frontend Node.js
# ══════════════════════════════════════════════════════════

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${CYAN}[$(date +%H:%M:%S)]${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }

log "══════════════════════════════════════"
log "  TikTok Android Emulator v1.0"
log "  Google Pixel 7 — Android 13"
log "══════════════════════════════════════"

# ── 1. تشغيل Node.js frontend في الخلفية ──────────────
log "تشغيل Frontend على منفذ 3000..."
cd /app && node server.js &
NODE_PID=$!
ok "Frontend يعمل (PID: $NODE_PID)"

# ── 2. تشغيل Android Emulator ─────────────────────────
log "تشغيل Android 13 Emulator..."
/root/start.sh &
EMULATOR_PID=$!
ok "Emulator بدأ (PID: $EMULATOR_PID)"

# ── 3. انتظار جاهزية الـ emulator ──────────────────────
log "انتظار تهيئة Android (2-3 دقائق)..."

MAX_WAIT=300   # 5 دقائق كحد أقصى
WAITED=0
READY=false

while [ $WAITED -lt $MAX_WAIT ]; do
  # فحص noVNC
  if curl -sf http://localhost:6080 > /dev/null 2>&1; then
    ok "noVNC جاهز ✓"
    READY=true
    break
  fi
  sleep 5
  WAITED=$((WAITED + 5))
  log "انتظار... ${WAITED}s / ${MAX_WAIT}s"
done

if [ "$READY" = "false" ]; then
  warn "noVNC لم يبدأ خلال ${MAX_WAIT}s — متابعة على أي حال"
fi

# ── 4. انتظار ADB ────────────────────────────────────
log "انتظار ADB device..."
ADB_WAIT=0
ADB_MAX=180

while [ $ADB_WAIT -lt $ADB_MAX ]; do
  DEVICES=$(adb devices 2>/dev/null | grep -v "List" | grep "device$" | wc -l)
  if [ "$DEVICES" -gt "0" ]; then
    ok "ADB device متصل ✓"
    break
  fi
  sleep 5
  ADB_WAIT=$((ADB_WAIT + 5))
done

if [ $ADB_WAIT -ge $ADB_MAX ]; then
  warn "ADB لم يتصل — سنحاول تثبيت APK لاحقاً"
else
  # انتظار إضافي لبوت Android كامل
  log "انتظار اكتمال تشغيل Android..."
  sleep 30

  # ── 5. تحميل وتثبيت TikTok APK ─────────────────────
  bash /scripts/install-tiktok.sh
fi

# ── 6. إبقاء العملية حية ──────────────────────────────
log "الجهاز جاهز! 🎉"
log "الواجهة: http://localhost:3000"
log "noVNC:    http://localhost:6080"

# مراقبة مستمرة — إعادة تثبيت APK إذا لزم
/scripts/monitor.sh &

# انتظر أي عملية
wait $EMULATOR_PID
