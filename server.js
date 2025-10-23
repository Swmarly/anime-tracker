const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PUBLIC_DIR = path.join(__dirname, 'public');
const SAMPLE_PROFILE_PATH = path.join(__dirname, 'data', 'sample-profile.json');
const PORT = process.env.PORT || 3000;

function readFileSafe(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    return null;
  }
}

function sendJson(res, statusCode, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data)
  });
  res.end(data);
}

function serveStaticFile(req, res, pathname) {
  const requestedPath = pathname === '/' ? '/index.html' : pathname;
  let safePath;
  try {
    safePath = decodeURIComponent(requestedPath);
  } catch (error) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  const filePath = path.join(PUBLIC_DIR, path.normalize(safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml'
    }[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

function proxyRequest(targetUrl) {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(targetUrl);
      const client = urlObj.protocol === 'https:' ? https : http;

      const requestOptions = {
        protocol: urlObj.protocol,
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Referer': 'https://www.anime-planet.com/'
        }
      };

      const req = client.request(requestOptions, (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode || 500,
            headers: res.headers,
            body
          });
        });
      });

      req.on('error', (error) => reject(error));
      req.end();
    } catch (error) {
      reject(error);
    }
  });
}

const server = http.createServer(async (req, res) => {
  const requestUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = requestUrl.pathname;

  if (pathname === '/api/profile') {
    const username = requestUrl.searchParams.get('username') || 'Swmarly';
    const status = requestUrl.searchParams.get('status');
    const page = requestUrl.searchParams.get('page') || '1';

    try {
      let targetUrl;
      if (status) {
        targetUrl = `https://www.anime-planet.com/users/${encodeURIComponent(username)}/anime?ajax=1&status=${encodeURIComponent(status)}&page=${encodeURIComponent(page)}`;
      } else {
        targetUrl = `https://www.anime-planet.com/users/${encodeURIComponent(username)}/anime`;
      }

      const proxyResponse = await proxyRequest(targetUrl);

      if (proxyResponse.statusCode < 200 || proxyResponse.statusCode >= 300) {
        throw new Error(`Upstream responded with status ${proxyResponse.statusCode}`);
      }

      res.writeHead(200, {
        'Content-Type': 'application/json; charset=utf-8'
      });

      res.end(JSON.stringify({
        ok: true,
        statusCode: proxyResponse.statusCode,
        headers: proxyResponse.headers,
        body: proxyResponse.body.toString('utf-8'),
        source: 'remote'
      }));
    } catch (error) {
      const fallback = readFileSafe(SAMPLE_PROFILE_PATH);
      if (fallback) {
        sendJson(res, 200, {
          ok: false,
          statusCode: 503,
          error: error.message,
          source: 'sample',
          body: JSON.parse(fallback.toString('utf-8'))
        });
      } else {
        sendJson(res, 500, {
          ok: false,
          statusCode: 500,
          error: error.message,
          source: 'error'
        });
      }
    }
    return;
  }

  serveStaticFile(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
