import http from 'node:http';
import { readFile, stat, mkdir } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const toolDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolDir, '..', '..');
const sourceVideo = join(projectRoot, 'public', 'video', 'summit-hero-film.mp4');
const outputDir = join(projectRoot, 'output', 'video', 'manual-trims');
const port = 4350;

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.mp4': 'video/mp4',
  '.json': 'application/json; charset=utf-8',
};

const json = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': mime['.json'], 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
};

const serveFile = async (req, res, path) => {
  try {
    const info = await stat(path);
    const range = req.headers.range;
    if (range && extname(path) === '.mp4') {
      const [startText, endText] = range.replace(/bytes=/, '').split('-');
      const start = Number(startText);
      const end = endText ? Number(endText) : Math.min(start + 1024 * 1024, info.size - 1);
      res.writeHead(206, {
        'Content-Range': `bytes ${start}-${end}/${info.size}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': end - start + 1,
        'Content-Type': 'video/mp4',
        'Cache-Control': 'no-store',
      });
      createReadStream(path, { start, end }).pipe(res);
      return;
    }
    res.writeHead(200, {
      'Content-Type': mime[extname(path)] ?? 'application/octet-stream',
      'Content-Length': info.size,
      'Cache-Control': 'no-store',
    });
    createReadStream(path).pipe(res);
  } catch {
    res.writeHead(404);
    res.end('Not found');
  }
};

const runFfmpeg = (args) => new Promise((resolveRun, rejectRun) => {
  const child = spawn('ffmpeg', args, { windowsHide: true });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr += chunk.toString(); });
  child.on('error', rejectRun);
  child.on('close', code => code === 0 ? resolveRun() : rejectRun(new Error(stderr.slice(-1800))));
});

const parseBody = (req) => new Promise((resolveBody, rejectBody) => {
  let body = '';
  req.on('data', chunk => {
    body += chunk;
    if (body.length > 50_000) rejectBody(new Error('Request too large'));
  });
  req.on('end', () => {
    try { resolveBody(JSON.parse(body)); }
    catch { rejectBody(new Error('Invalid request')); }
  });
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    return serveFile(req, res, join(toolDir, 'index.html'));
  }
  if (req.method === 'GET' && url.pathname === '/source.mp4') {
    return serveFile(req, res, sourceVideo);
  }
  if (req.method === 'GET' && url.pathname.startsWith('/outputs/')) {
    const safeName = url.pathname.slice('/outputs/'.length).replace(/[^a-zA-Z0-9._-]/g, '');
    return serveFile(req, res, join(outputDir, safeName));
  }
  if (req.method === 'GET' && url.pathname === '/current-fades.mp4') {
    return serveFile(req, res, join(outputDir, 'summit-hero-remove-20260813-235903-crossfades.mp4'));
  }
  if (req.method === 'POST' && url.pathname === '/export') {
    try {
      const { start, end, duration, mode } = await parseBody(req);
      const inPoint = Number(start);
      const outPoint = Number(end);
      const total = Number(duration);
      if (![inPoint, outPoint, total].every(Number.isFinite)) throw new Error('Invalid timestamps');
      if (inPoint < 0 || outPoint <= inPoint || outPoint > total + 0.1) throw new Error('Choose a valid in and out range');
      if (!['keep', 'remove'].includes(mode)) throw new Error('Invalid export mode');

      await mkdir(outputDir, { recursive: true });
      const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
      const filename = `summit-hero-${mode}-${stamp}.mp4`;
      const destination = join(outputDir, filename);
      const common = ['-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-movflags', '+faststart'];

      if (mode === 'keep') {
        await runFfmpeg([
          '-hide_banner', '-loglevel', 'error', '-y',
          '-ss', inPoint.toFixed(3), '-to', outPoint.toFixed(3), '-i', sourceVideo,
          ...common, destination,
        ]);
      } else {
        if (inPoint <= 0.001) {
          await runFfmpeg([
            '-hide_banner', '-loglevel', 'error', '-y',
            '-ss', outPoint.toFixed(3), '-i', sourceVideo,
            ...common, destination,
          ]);
        } else if (outPoint >= total - 0.001) {
          await runFfmpeg([
            '-hide_banner', '-loglevel', 'error', '-y',
            '-to', inPoint.toFixed(3), '-i', sourceVideo,
            ...common, destination,
          ]);
        } else {
          const filter = `[0:v]trim=start=0:end=${inPoint.toFixed(3)},setpts=PTS-STARTPTS[first];` +
            `[0:v]trim=start=${outPoint.toFixed(3)},setpts=PTS-STARTPTS[second];` +
            `[first][second]xfade=transition=fade:duration=0.20:offset=${Math.max(0, inPoint - 0.20).toFixed(3)}[v]`;
          await runFfmpeg([
            '-hide_banner', '-loglevel', 'error', '-y', '-i', sourceVideo,
            '-filter_complex', filter, '-map', '[v]', ...common, destination,
          ]);
        }
      }

      json(res, 200, {
        ok: true,
        filename,
        path: destination,
        url: `/outputs/${filename}`,
      });
    } catch (error) {
      json(res, 400, { ok: false, error: error.message || 'Export failed' });
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(port, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${port}`;
  console.log(`Summit video trimmer: ${url}`);
  console.log(`Source: ${sourceVideo}`);
  spawn('cmd.exe', ['/c', 'start', '', url], { detached: true, windowsHide: true, stdio: 'ignore' }).unref();
});
