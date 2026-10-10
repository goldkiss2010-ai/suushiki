import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = Number(process.env.PORT || 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer from 1 to 65535.');
}
const routes = [
  ['/vendor/stone/', resolve(root, 'node_modules/@non-standardworld/stone-engine.js/dist')],
  ['/vendor/mathjax/', resolve(root, 'node_modules/mathjax')],
  ['/vendor/mathjax-newcm/', resolve(root, 'node_modules/@mathjax/mathjax-newcm-font')],
  ['/', resolve(root, 'public')],
];
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };

const server = createServer(async (request, response) => {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.writeHead(405, { Allow: 'GET, HEAD' }).end();
    return;
  }
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const [prefix, directory] = routes.find(([prefix]) => pathname.startsWith(prefix));
    const suffix = pathname === '/' ? 'index.html' : pathname.slice(prefix.length);
    const filename = resolve(directory, suffix);
    if (!filename.startsWith(directory + sep)) {
      response.writeHead(403).end('Forbidden');
      return;
    }
    const body = await readFile(filename);
    response.writeHead(200, {
      'Content-Type': (types[extname(filename)] || 'application/octet-stream') +
        (['.html', '.js', '.css', '.json', '.svg'].includes(extname(filename)) ? '; charset=utf-8' : ''),
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch (error) {
    response.writeHead(error instanceof URIError ? 400 : 404).end('Not found');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? `Port ${port} is busy. Set PORT to another port and retry.` : error.message);
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`SUUSHIKI: http://127.0.0.1:${port}`);
  console.log('Stop with Ctrl+C.');
});
