# 🎵 TikTok Android Emulator — Railway

## ⚡ كيف يعمل

```
Railway Container
├── Android 13 Emulator (Google Pixel 7)
├── TikTok APK (تثبيت تلقائي عبر ADB)
├── noVNC (بث الشاشة للمتصفح)
└── Node.js Frontend (الواجهة)
```

## 🚀 نشر على Railway

### 1. ضع TikTok APK
```bash
# ضع ملف tiktok.apk في مجلد /apk/
# تحميل من: apkpure.com → TikTok
```

### 2. ارفع على GitHub
```bash
git init && git add . && git commit -m "TikTok Emulator"
git push origin main
```

### 3. النشر
1. railway.app → New Project → GitHub repo
2. انتظر build (5-10 دقائق)
3. افتح الرابط

## ⚠️ حدود Railway المجاني

| المورد | الحد | هل يكفي؟ |
|--------|------|----------|
| RAM | 512MB | ❌ Android يحتاج 2GB+ |
| CPU | مشترك | ⚠️ بطيء |
| Storage | 1GB | ✅ |

## 💡 الحل الأمثل — Oracle Cloud (مجاني)
Oracle Free Tier A1: **4 CPU + 24GB RAM** — مثالي تماماً!
