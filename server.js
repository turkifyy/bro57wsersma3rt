/**
 * Smart Browser v4.6 — Server
 * TikTok Entertainment Browser
 * Railway Deployment
 */
'use strict';

const express = require('express');
const axios   = require('axios');
const cors    = require('cors');
const path    = require('path');
const https   = require('https');
const http    = require('http');
const iconv   = require('iconv-lite');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Agents ──────────────────────────────────────────
const httpsAgent = new https.Agent({
  rejectUnauthorized: false,
  keepAlive: true,
  timeout: 20000,
});
const httpAgent = new http.Agent({ keepAlive: true, timeout: 20000 });

// ── User-Agent rotation ──────────────────────────────
const UA_POOL = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (X11; Linux x86_64; rv:124.0) Gecko/20100101 Firefox/124.0',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Mobile/15E148 Safari/604.1',
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
];
let uaIdx = 0;
const nextUA = () => UA_POOL[uaIdx++ % UA_POOL.length];

// ── Headers to strip ────────────────────────────────
const STRIP = new Set([
  'x-frame-options','content-security-policy-report-only',
  'strict-transport-security','x-content-type-options',
  'cross-origin-opener-policy','cross-origin-embedder-policy',
  'cross-origin-resource-policy','permissions-policy',
  'x-xss-protection','report-to','nel',
]);

function cleanHeaders(h) {
  const out = {};
  for (const [k, v] of Object.entries(h || {})) {
    const lk = k.toLowerCase();
    if (STRIP.has(lk)) continue;
    if (lk === 'content-security-policy') {
      out[k] = "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *; frame-ancestors *; connect-src *;";
      continue;
    }
    out[k] = v;
  }
  out['access-control-allow-origin']  = '*';
  out['access-control-allow-methods'] = 'GET,POST,PUT,DELETE,OPTIONS,HEAD';
  out['access-control-allow-headers'] = '*';
  return out;
}

// ── URL encode/decode ────────────────────────────────
const enc = (u) => Buffer.from(u).toString('base64url');
const dec = (s) => { try { return Buffer.from(s, 'base64url').toString(); } catch { return null; } };

// ── Smart fetcher with retry ─────────────────────────
async function smartFetch(url, opts = {}) {
  const errors = [];
  for (let i = 0; i < 3; i++) {
    try {
      return await axios({
        method: opts.method || 'GET',
        url,
        timeout: 18000,
        maxRedirects: 10,
        responseType: 'arraybuffer',
        httpsAgent, httpAgent,
        validateStatus: () => true,
        headers: {
          'User-Agent':      nextUA(),
          'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9,ar;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Cache-Control':   'no-cache',
          'Pragma':          'no-cache',
          'Sec-Fetch-Dest':  'document',
          'Sec-Fetch-Mode':  'navigate',
          'Sec-Fetch-Site':  'none',
          ...(opts.headers || {}),
        },
        decompress: true,
      });
    } catch (e) {
      errors.push(e.message);
      if (i < 2) await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error(errors.join(' | '));
}

// ── HTML rewriter ────────────────────────────────────
function rewriteHTML(html, base, proxyBase) {
  const toRes = (href, isNav) => {
    if (!href || href.startsWith('data:') || href.startsWith('blob:') ||
        href.startsWith('javascript:') || href.startsWith('#') ||
        href.startsWith('mailto:') || href.startsWith('tel:')) return href;
    try {
      const abs = new URL(href.trim(), base).href;
      return isNav
        ? `${proxyBase}/browse/${enc(abs)}`
        : `${proxyBase}/res/${enc(abs)}`;
    } catch { return href; }
  };

  html = html.replace(/<a(\s[^>]*?)href\s*=\s*(['"])(.*?)\2/gi,
    (m,pre,q,h) => `<a${pre}href=${q}${toRes(h,true)}${q}`);
  html = html.replace(/<img(\s[^>]*?)src\s*=\s*(['"])(.*?)\2/gi,
    (m,pre,q,s) => `<img${pre}src=${q}${toRes(s,false)}${q}`);
  html = html.replace(/<script(\s[^>]*?)src\s*=\s*(['"])(.*?)\2/gi,
    (m,pre,q,s) => `<script${pre}src=${q}${toRes(s,false)}${q}`);
  html = html.replace(/<link(\s[^>]*?)href\s*=\s*(['"])(.*?)\2/gi,
    (m,pre,q,h) => `<link${pre}href=${q}${toRes(h,false)}${q}`);
  html = html.replace(/<form(\s[^>]*?)action\s*=\s*(['"])(.*?)\2/gi,
    (m,pre,q,a) => `<form${pre}action=${q}${toRes(a,true)}${q}`);
  html = html.replace(/<base[^>]*>/gi, '');

  // Inject interceptor
  const inj = `<script>
(function(){
  const PB='${proxyBase}';
  function px(u){
    if(!u||u.startsWith('data:')||u.startsWith('blob:')) return u;
    try{ const a=new URL(u,location.href).href;
      return PB+'/res/'+btoa(unescape(encodeURIComponent(a))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=/g,'');
    }catch(e){return u;}
  }
  const OX=window.XMLHttpRequest;
  function PX(){const x=new OX();const o=x.open.bind(x);x.open=function(m,u,...a){return o(m,px(u),...a);};return x;}
  PX.prototype=OX.prototype; window.XMLHttpRequest=PX;
  const oF=window.fetch;
  window.fetch=function(u,o){if(typeof u==='string')u=px(u);return oF(u,o);};
  if(window.WebSocket){
    const oW=window.WebSocket;
    window.WebSocket=function(u,p){
      try{const a=new URL(u);
        const nu=PB.replace('http','ws')+'/ws/'+btoa(unescape(encodeURIComponent(u))).replace(/\\+/g,'-').replace(/\\//g,'_').replace(/=/g,'');
        return new oW(nu,p);
      }catch(e){return new oW(u,p);}
    };
  }
})();
</script>`;
  html = html.replace(/<head>/i, '<head>' + inj);
  return html;
}

// ── CSS rewriter ─────────────────────────────────────
function rewriteCSS(css, base, proxyBase) {
  return css.replace(/url\s*\(\s*(['"]?)(.+?)\1\s*\)/gi, (m, q, u) => {
    if (u.startsWith('data:')) return m;
    try {
      const abs = new URL(u.trim(), base).href;
      return `url(${q}${proxyBase}/res/${enc(abs)}${q})`;
    } catch { return m; }
  });
}

// ── Middlewares ──────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use((req, res, next) => {
  res.removeHeader('X-Frame-Options');
  res.setHeader('Content-Security-Policy',
    "default-src * 'unsafe-inline' 'unsafe-eval' data: blob:; frame-src *; frame-ancestors *;");
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// ── /browse/:enc — main page proxy ──────────────────
app.get('/browse/:encoded', async (req, res) => {
  const url = dec(req.params.encoded);
  if (!url) return res.status(400).send('Bad URL');
  const base = `${req.protocol}://${req.get('host')}`;
  try {
    const r  = await smartFetch(url);
    const ct = (r.headers['content-type'] || '').toLowerCase();
    const ch = cleanHeaders(r.headers);
    Object.entries(ch).forEach(([k,v]) => { try { res.setHeader(k,v); } catch {} });
    res.status(r.status);
    if (ct.includes('text/html')) {
      let html = iconv.decode(Buffer.from(r.data), 'utf-8');
      html = rewriteHTML(html, url, base);
      res.setHeader('content-type','text/html; charset=utf-8');
      return res.send(html);
    }
    res.send(Buffer.from(r.data));
  } catch (e) {
    res.status(502).send(errorPage(url, e.message));
  }
});

// ── /res/:enc — resources (img, js, css, fonts) ──────
app.get('/res/:encoded', async (req, res) => {
  const url = dec(req.params.encoded);
  if (!url) return res.status(400).end();
  const base = `${req.protocol}://${req.get('host')}`;
  try {
    const r  = await smartFetch(url);
    const ct = (r.headers['content-type'] || '').toLowerCase();
    const ch = cleanHeaders(r.headers);
    Object.entries(ch).forEach(([k,v]) => { try { res.setHeader(k,v); } catch {} });
    res.status(r.status);
    if (ct.includes('text/css')) {
      let css = iconv.decode(Buffer.from(r.data), 'utf-8');
      css = rewriteCSS(css, url, base);
      res.setHeader('content-type','text/css; charset=utf-8');
      return res.send(css);
    }
    res.send(Buffer.from(r.data));
  } catch (e) {
    res.status(502).end();
  }
});

// ── /api/status ──────────────────────────────────────
app.get('/api/status', (req, res) => {
  res.json({ ok: true, version: '4.6.0',
    host: req.get('host'), timestamp: new Date().toISOString() });
});

// ── Error page ───────────────────────────────────────
function errorPage(url, msg) {
  return `<!DOCTYPE html><html lang="ar" dir="rtl">
<head><meta charset="utf-8"><style>
body{font-family:sans-serif;background:#07070c;color:#eef0f8;
  display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
.box{background:#14141e;border:1px solid rgba(255,255,255,0.1);border-radius:16px;
  padding:28px;max-width:420px;text-align:center;}
h2{color:#ef4444;margin-bottom:10px;font-size:18px;}
p{color:#5e6080;font-size:12px;line-height:1.7;margin-bottom:10px;}
code{color:#4f8ef7;font-size:10px;word-break:break-all;display:block;
  background:#0e0e15;padding:8px;border-radius:6px;margin:8px 0;}
button{margin-top:12px;padding:8px 22px;border-radius:8px;
  border:1px solid rgba(255,255,255,0.15);background:#1a1a26;
  color:#eef0f8;cursor:pointer;font-size:13px;transition:all .2s;}
button:hover{border-color:#4f8ef7;color:#4f8ef7;}
</style></head><body>
<div class="box">
  <h2>⚠️ تعذّر الاتصال</h2>
  <p>${msg}</p>
  <code>${url}</code>
  <button onclick="history.back()">← رجوع</button>
  <button onclick="location.reload()" style="margin-left:8px">⟳ إعادة</button>
</div></body></html>`;
}

// ── Static ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));
app.get('*', (req, res) =>
  res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Smart Browser v4.6 — port ${PORT}`);
});
