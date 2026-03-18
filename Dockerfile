# ╔══════════════════════════════════════════════════════════╗
# ║  TikTok Android Emulator — Railway Deployment           ║
# ║  Base: budtmo/docker-android:emulator_13.0              ║
# ║  Auto-installs TikTok APK on first boot                 ║
# ╚══════════════════════════════════════════════════════════╝

FROM budtmo/docker-android:emulator_13.0

# ── Labels ────────────────────────────────────────────────
LABEL maintainer="tiktok-emulator"
LABEL version="1.0.0"
LABEL description="Android 13 Google Pixel 7 — TikTok Auto Install"

# ── Environment ───────────────────────────────────────────
ENV EMULATOR_DEVICE="Google Pixel 7"
ENV WEB_VNC=true
ENV WEB_VNC_PORT=6080
ENV APPIUM=false
ENV RELAXED_SECURITY=true
ENV SCREEN_WIDTH=1080
ENV SCREEN_HEIGHT=2400
ENV SCREEN_DENSITY=420

# ── Install wget, curl, nodejs ────────────────────────────
USER root
RUN apt-get update -qq && \
    apt-get install -y --no-install-recommends \
      wget curl ca-certificates nodejs npm && \
    apt-get clean && rm -rf /var/lib/apt/lists/*

# ── Copy scripts ──────────────────────────────────────────
COPY scripts/ /scripts/
RUN chmod +x /scripts/*.sh

# ── Copy frontend ─────────────────────────────────────────
COPY public/ /app/public/
COPY server.js /app/server.js
COPY package.json /app/package.json

# ── Install Node deps ─────────────────────────────────────
WORKDIR /app
RUN npm install --production --silent

# ── Expose ports ──────────────────────────────────────────
# 6080 = noVNC (شاشة Android)
# 3000 = Frontend Node.js
EXPOSE 6080 3000

# ── Entrypoint ────────────────────────────────────────────
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

CMD ["/entrypoint.sh"]
