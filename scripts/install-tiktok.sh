#!/bin/bash
# ══════════════════════════════════════════════════════════
#  install-tiktok.sh
#  تحميل وتثبيت TikTok APK عبر ADB
#  مصادر متعددة للتنزيل مع fallback
# ══════════════════════════════════════════════════════════

GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m';  RED='\033[0;31m'; NC='\033[0m'

log()  { echo -e "${CYAN}[APK-Installer]${NC} $1"; }
ok()   { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
err()  { echo -e "${RED}✗${NC} $1"; }

APK_DIR="/tmp/apk"
APK_PATH="$APK_DIR/tiktok.apk"
TIKTOK_PKG="com.zhiliaoapp.musically"
MARKER="/tmp/.tiktok_installed"

mkdir -p "$APK_DIR"

# ── تحقق إذا TikTok مثبّت مسبقاً ───────────────────────
if [ -f "$MARKER" ]; then
  ok "TikTok مثبّت مسبقاً ✓"
  # تشغيله مباشرة
  adb shell am start -n "com.zhiliaoapp.musically/com.ss.android.ugc.aweme.splash.SplashActivity" 2>/dev/null || true
  exit 0
fi

# ── التحقق من وجود APK محلي أولاً ──────────────────────
if [ -f "/apk/tiktok.apk" ]; then
  log "APK محلي موجود → تثبيت مباشر"
  APK_PATH="/apk/tiktok.apk"
else
  # ── تحميل APK من مصادر متعددة ───────────────────────
  log "تحميل TikTok APK..."

  # المصادر مرتبة من الأوثق للأقل
  SOURCES=(
    "https://d.apkpure.com/b/APK/com.zhiliaoapp.musically?version=latest"
    "https://apkcombo.com/download/?package=com.zhiliaoapp.musically&type=apk"
    "https://apkpure.com/tiktok/com.zhiliaoapp.musically/download"
  )

  DOWNLOADED=false
  for src in "${SOURCES[@]}"; do
    log "جاري التحميل من: ${src:0:50}..."
    if wget -q --timeout=60 --tries=2 \
         --user-agent="Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36" \
         -O "$APK_PATH" "$src" 2>/dev/null; then
      # تحقق من صحة الملف
      SIZE=$(stat -c%s "$APK_PATH" 2>/dev/null || echo 0)
      if [ "$SIZE" -gt 1000000 ]; then  # أكبر من 1MB
        ok "تم التحميل! الحجم: $(numfmt --to=iec $SIZE)"
        DOWNLOADED=true
        break
      else
        warn "الملف صغير جداً (${SIZE} bytes) — مصدر آخر"
        rm -f "$APK_PATH"
      fi
    else
      warn "فشل التحميل من هذا المصدر"
    fi
  done

  if [ "$DOWNLOADED" = "false" ]; then
    err "فشل تحميل TikTok APK من جميع المصادر"
    err "الحل: ضع tiktok.apk يدوياً في مجلد /apk/"
    exit 1
  fi
fi

# ── التحقق من صحة APK ────────────────────────────────
log "التحقق من صحة APK..."
if command -v aapt &>/dev/null; then
  PKG=$(aapt dump badging "$APK_PATH" 2>/dev/null | grep "package: name" | head -1)
  log "معلومات الحزمة: $PKG"
fi

# ── تثبيت APK عبر ADB ─────────────────────────────────
log "تثبيت TikTok على الجهاز..."
log "هذا قد يستغرق 30-60 ثانية..."

# تجربة التثبيت مع retry
INSTALLED=false
for attempt in 1 2 3; do
  log "محاولة التثبيت #${attempt}..."

  RESULT=$(adb install -r -g "$APK_PATH" 2>&1)

  if echo "$RESULT" | grep -q "Success"; then
    ok "✅ TikTok مثبّت بنجاح!"
    INSTALLED=true
    touch "$MARKER"
    break
  else
    warn "المحاولة #${attempt} فشلت: $RESULT"
    sleep 10
  fi
done

if [ "$INSTALLED" = "false" ]; then
  err "فشل تثبيت TikTok بعد 3 محاولات"
  err "الخطأ: $RESULT"
  exit 1
fi

# ── تشغيل TikTok تلقائياً ────────────────────────────
log "تشغيل TikTok تلقائياً..."
sleep 3

# تشغيل TikTok
adb shell monkey -p "$TIKTOK_PKG" -c android.intent.category.LAUNCHER 1 2>/dev/null || \
adb shell am start -n "$TIKTOK_PKG/com.ss.android.ugc.aweme.splash.SplashActivity" 2>/dev/null || \
adb shell am start -a android.intent.action.MAIN -c android.intent.category.LAUNCHER "$TIKTOK_PKG" 2>/dev/null

# منع قفل الشاشة
adb shell settings put system screen_off_timeout 2147483647 2>/dev/null || true
adb shell svc power stayon true 2>/dev/null || true

ok "🎵 TikTok يعمل على الجهاز!"
