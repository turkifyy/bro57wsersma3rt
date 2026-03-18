/**
 * server.js — TikTok Android Emulator Frontend
 * يخدم الواجهة ويعيد توجيه noVNC stream
 */
'use strict';

const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors    = require('cors');
const axios   = require('axios');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// noVNC يعمل على نفس الـ container
const VNC_HOST = process.env.VNC_HOST || 'localhost';
const VNC_PORT = process.env.VNC_PORT || '6080';

app.use(cors({ origin: '*' }));
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *; frame-ancestors *;");
  next();
});

// ── Proxy noVNC stream ────────────────────────────────
app.use('/novnc', createProxyMiddleware({
  target: `http://${VNC_HOST}:${VNC_PORT}`,
  changeOrigin: true,
  pathRewrite: { '^/novnc': '' },
  ws: true,
  on: {
    proxyRes: (proxyRes) => {
      delete proxyRes.headers['x-frame-options'];
      proxyRes.headers['access-control-allow-origin'] = '*';
    },
    error: (err, req, res) => {
      console.error('noVNC proxy error:', err.message);
    }
  }
}));

// ── WebSocket proxy ───────────────────────────────────
app.use('/websockify', createProxyMiddleware({
  target: `ws://${VNC_HOST}:${VNC_PORT}`,
  changeOrigin: true,
  ws: true,
}));

// ── API: حالة الجهاز ──────────────────────────────────
app.get('/api/status', async (req, res) => {
  const vnc_ok = await checkVNC();
  res.json({
    ok: true,
    version: '1.0.0',
    vnc: vnc_ok,
    vnc_url: `http://${req.get('host')}/novnc/vnc.html?autoconnect=true&reconnect=true`,
    host: req.get('host'),
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/vnc-check', async (req, res) => {
  const ok = await checkVNC();
  res.json({ ok, host: VNC_HOST, port: VNC_PORT });
});

async function checkVNC() {
  try {
    await axios.get(`http://${VNC_HOST}:${VNC_PORT}`, { timeout: 3000 });
    return true;
  } catch { return false; }
}

// ── Static frontend ───────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ TikTok Emulator Frontend — port ${PORT}`);
  console.log(`📺 noVNC proxy: /novnc → ${VNC_HOST}:${VNC_PORT}`);
});
