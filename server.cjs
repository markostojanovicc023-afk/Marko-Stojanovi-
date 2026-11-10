const http = require('http');
const fs = require('fs');
const path = require('path');

function stripHttpOptions(val) {
  if (!val || typeof val !== "object") return val;
  if (Array.isArray(val)) return val.map(stripHttpOptions);
  const out = {};
  for (const [k, v] of Object.entries(val)) {
    if (
      k === "httpOptions" ||
      k === "http_options" ||
      k === "__proto__" ||
      k === "constructor" ||
      k === "prototype" ||
      k === "cachedContent" ||
      k === "cached_content" ||
      k === "fileSearch" ||
      k === "file_search" ||
      k === "corpora" ||
      k === "semanticRetriever" ||
      k === "semantic_retriever"
    ) continue;
    if ((k === "fileData" || k === "file_data") && v && typeof v === "object") {
      const rawU = v.fileUri ?? v.file_uri;
      const u = typeof rawU === "string" ? rawU.trim() : "";
      if (!/^https:\/\/(?:www\.|m\.)?(?:youtube\.com|youtu\.be)\//i.test(u)) continue;
    }
    out[k] = stripHttpOptions(v);
  }
  return out;
}


const PORT = process.env.PORT || 3000;
const MAX_BODY_BYTES = 10 * 1024 * 1024;
// Models the bundled frontend (assets/*.js) requests, plus the default text model.
const ALLOWED_MODELS = new Set([
  'gemini-3-flash-preview',
  'gemini-2.5-flash-image',
]);

function rejectTooLarge(req, res, errorBody) {
  res.statusCode = 413;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Connection', 'close');
  // Destroy the request once the 413 has been flushed so the rest of the upload is dropped.
  res.end(JSON.stringify(errorBody('Request body too large.')), () => req.destroy());
}

/**
 * Reads the request body with a MAX_BODY_BYTES cap. Resolves to null (after replying) on overflow
 * or read failure so one oversized POST cannot exhaust instance memory.
 */
function readBodyCapped(req, res, errorBody) {
  return new Promise((resolve) => {
    let done = false;
    const finish = (value) => {
      if (done) return;
      done = true;
      resolve(value);
    };
    const declared = Number(req.headers['content-length'] || 0);
    if (declared > MAX_BODY_BYTES) {
      rejectTooLarge(req, res, errorBody);
      finish(null);
      return;
    }
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      if (done) return;
      total += chunk.length;
      if (total > MAX_BODY_BYTES) {
        req.pause();
        rejectTooLarge(req, res, errorBody);
        finish(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => finish(Buffer.concat(chunks)));
    req.on('error', (err) => {
      console.error('Request body read failed:', err);
      if (!done && !res.headersSent) {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(errorBody('Failed to read request body.')));
      }
      finish(null);
    });
    req.on('close', () => finish(null));
  });
}

const DIST_DIR = path.resolve(__dirname, 'dist');
const ROOT = fs.existsSync(DIST_DIR) ? DIST_DIR : __dirname;
const BLOCKED_STATIC_NAMES = new Set([
  'server.cjs', 'server.cjs.map', 'server.js', 'server.ts', 'server.mjs',
  'package.json', 'package-lock.json', 'tsconfig.json',
  '.env', '.env.local', '.env.production'
]);

// Comprehensive MIME type mapping
// Zero-dependency replacement for 'mime-types'
const MIME_TYPES = {
  // Text / Web Standard
  '.html': 'text/html',
  '.htm': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.map': 'application/json',
  '.xml': 'application/xml',

  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.tiff': 'image/tiff',
  '.exr': 'image/x-exr',
  '.hdr': 'image/vnd.radiance',

  // Video / Audio
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.ogv': 'video/ogg',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',

  // Fonts
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.eot': 'application/vnd.ms-fontobject',

  // 3D Models / CAD
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.usdz': 'model/vnd.usdz+zip',
  '.obj': 'model/obj',
  '.mtl': 'model/mtl',
  '.stl': 'model/stl',

  // Documents / Data
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.wasm': 'application/wasm',
};

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, 'http://localhost');
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(requestUrl.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain' });
    res.end('Bad Request');
    return;
  }
  if (decodedPath === '/api/health') {
    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify({ status: 'ok', hasKey: Boolean(process.env.GEMINI_API_KEY || process.env.API_KEY) }));
    return;
  }

  if (decodedPath === '/api/generate-content' && req.method === 'POST') {
    const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
    if (!apiKey) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured.' }));
      return;
    }
    const rawBody = await readBodyCapped(req, res, (message) => ({ error: message }));
    if (rawBody === null) return;
    let bodyObj;
    try {
      bodyObj = stripHttpOptions(JSON.parse(rawBody.toString('utf-8') || '{}'));
    } catch (err) {
      console.error('Invalid JSON on /api/generate-content:', err);
      bodyObj = null;
    }
    if (!bodyObj || typeof bodyObj !== 'object') {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid JSON request body.' }));
      return;
    }
    const rawModel = String(bodyObj.model || 'gemini-3-flash-preview').replace(/^models\//, '');
    const model = rawModel === 'gemini-2.5-flash' ? 'gemini-3-flash-preview' : rawModel;
    if (!ALLOWED_MODELS.has(model)) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'Invalid model name.' }));
      return;
    }
    const contents = typeof bodyObj.contents === 'string'
      ? [{ parts: [{ text: bodyObj.contents }] }]
      : Array.isArray(bodyObj.contents) ? bodyObj.contents : [bodyObj.contents];
    const upstreamUrl = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    try {
      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({ contents, generationConfig: bodyObj.config }),
        redirect: 'error',
      });
      const data = await upstream.json();
      const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
      res.statusCode = upstream.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ ...data, text }));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: e.message || String(e) }));
    }
    return;
  }

  if (decodedPath.startsWith('/api/gemini-proxy/')) {
    if (req.method !== 'POST') {
      res.statusCode = 405;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Method not allowed on /api/gemini-proxy.' } }));
      return;
    }
    const apiKey = (process.env.GEMINI_API_KEY || process.env.API_KEY || '').trim();
    if (!apiKey) {
      res.statusCode = 503;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'GEMINI_API_KEY is not configured.' } }));
      return;
    }
    const targetSubpath = decodedPath.slice('/api/gemini-proxy/'.length).replace('models/gemini-2.5-flash:', 'models/gemini-3-flash-preview:');
    const proxyMatch = /^(v1beta|v1alpha)\/models\/([a-zA-Z0-9._-]{1,64}):(generateContent|streamGenerateContent|predict|embedContent|countTokens)$/.exec(targetSubpath);
    if (!proxyMatch || decodedPath.includes('..')) {
      res.statusCode = 403;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Endpoint not allowed on /api/gemini-proxy.' } }));
      return;
    }
    if (!ALLOWED_MODELS.has(proxyMatch[2])) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Model not allowed on /api/gemini-proxy.' } }));
      return;
    }
    const altQuery = requestUrl.searchParams.get('alt') === 'sse' ? '?alt=sse' : '';
    const upstreamUrl = `https://generativelanguage.googleapis.com/${proxyMatch[1]}/models/${encodeURIComponent(proxyMatch[2])}:${proxyMatch[3]}${altQuery}`;
    const rawBody = await readBodyCapped(req, res, (message) => ({ error: { message } }));
    if (rawBody === null) return;
    let sanitizedBody;
    try {
      const parsedBody = stripHttpOptions(JSON.parse(rawBody.toString('utf-8') || '{}'));
      sanitizedBody = JSON.stringify(parsedBody);
    } catch {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: 'Invalid JSON request body.' } }));
      return;
    }
    try {
      const headers = { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey };
      const upstream = await fetch(upstreamUrl, {
        method: 'POST',
        headers,
        body: sanitizedBody,
        redirect: 'error',
      });
      res.statusCode = upstream.status;
      const ct = upstream.headers.get('content-type');
      if (ct) res.setHeader('Content-Type', ct);
      const ab = await upstream.arrayBuffer();
      res.end(Buffer.from(ab));
    } catch (e) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: { message: e.message || String(e) } }));
    }
    return;
  }
  if (/^\/assets\/[a-zA-Z0-9._/-]+\.mp3$/.test(decodedPath) && !decodedPath.includes('..')) {
    try {
      const upstream = await fetch(`https://night-reader-57e64c69-853813963450.us-west1.run.app${decodedPath}`, { redirect: 'error' });
      if (upstream.ok) {
        res.statusCode = 200;
        res.setHeader('Content-Type', upstream.headers.get('content-type') || 'audio/mpeg');
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        const ab = await upstream.arrayBuffer();
        res.end(Buffer.from(ab));
        return;
      }
    } catch (e) {
      console.error('MP3 proxy error:', e);
    }
  }
  const pathSegments = decodedPath.split('/').filter(Boolean);
  if (
    pathSegments.some((seg) => seg.startsWith('.') || seg === 'node_modules') ||
    (pathSegments.length > 0 && BLOCKED_STATIC_NAMES.has(pathSegments[pathSegments.length - 1].toLowerCase()))
  ) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }
  const absolutePath = path.resolve(ROOT, '.' + (decodedPath.startsWith('/') ? decodedPath : '/' + decodedPath));

  // Trying to access outside the folder
  if (absolutePath !== ROOT && !absolutePath.startsWith(ROOT + path.sep)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  const getStats = async (p) => {
    try {
      const stats = await fs.promises.stat(p);
      return stats.isFile() ? stats : null;
    } catch {
      return null;
    }
  };

  const serveFile = (filePath, stats, statusCode = 200) => {
    const ext = path.extname(filePath).toLowerCase();

    // Default to binary stream if unknown type
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', contentType);
    if (ext === '.svg') {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox");
    }

    // --- Caching Logic ---
    const mtime = stats.mtime.toUTCString();
    res.setHeader('Last-Modified', mtime);

    // Handle 304 Not Modified
    if (req.headers['if-modified-since'] === mtime) {
      res.statusCode = 304;
      res.end();
      return;
    }

    // Cache-Control Headers
    if (ext === '.html' || ext === '.htm') {
      // HTML: Always validate with server to see if new deployment exists
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    } else {
      // Assets: Cache for 1 year (Immutable)
      // Assumes build tools (Vite/Next) use hashed filenames for assets
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }

    res.statusCode = statusCode;

    const stream = fs.createReadStream(filePath);
    stream.on('error', (err) => {
      console.error('Stream error:', err);
      res.statusCode = 500;
      res.end();
    });
    stream.pipe(res);
  };

  try {
    // --- Resolution Strategy ---

    // 1. Exact Match (e.g. /style.css, /logo.png)
    let stats = await getStats(absolutePath);
    if (stats) return serveFile(absolutePath, stats);

    // 2. HTML Extension (Next.js Export: /about -> /about.html)
    const htmlPath = absolutePath + '.html';
    stats = await getStats(htmlPath);
    if (stats) return serveFile(htmlPath, stats);

    // 3. Directory Index (Standard Web: /blog -> /blog/index.html)
    const dirIndexPath = path.join(absolutePath, 'index.html');
    stats = await getStats(dirIndexPath);
    if (stats) return serveFile(dirIndexPath, stats);

    // 4. Missing File
    // If the URL has an extension at this point return 404.
    if (path.extname(absolutePath)) {
      res.statusCode = 404;
      res.end('Not Found');
      return;
    }

    // 5. Custom 404 (Next.js Exports)
    const custom404Path = path.join(ROOT, '404.html');
    stats = await getStats(custom404Path);
    if (stats) return serveFile(custom404Path, stats, 404);

    // 6. SPA Fallback
    const spaIndexPath = path.join(ROOT, 'index.html');
    stats = await getStats(spaIndexPath);
    if (stats) return serveFile(spaIndexPath, stats, 200);

    // 7. Hard 404
    res.statusCode = 404;
    res.end('Not Found');
  } catch (err) {
    console.error('Server error:', err);
    res.statusCode = 500;
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`Static Shim running on http://localhost:${PORT}`);
});
