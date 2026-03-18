#!/bin/bash
# ══════════════════════════════════════════════════════════
#  monitor.sh — يراقب TikTok ويعيد تشغيله إذا أُغلق
# ══════════════════════════════════════════════════════════

TIKTOK_PKG="com.zhiliaoapp.musically"
CHECK_INTERVAL=30

while true; do
  sleep $CHECK_INTERVAL

  # تحقق إذا TikTok يعمل
  RUNNING=$(adb shell "ps | grep $TIKTOK_PKG" 2>/dev/null | wc -l)

  if [ "$RUNNING" -eq "0" ]; then
    echo "[Monitor] TikTok أُغلق — إعادة تشغيل..."
    adb shell monkey -p "$TIKTOK_PKG" -c android.intent.category.LAUNCHER 1 2>/dev/null || true
    sleep 5
  fi

  # منع قفل الشاشة
  adb shell svc power stayon true 2>/dev/null || true
done
