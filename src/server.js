// Prototype server: listens for FreeD D1 on one UDP port per virtual camera,
// and streams the parsed poses to the browser over Server-Sent Events.
// The browser renders the 3D scene and produces the fill and key outputs.
//
// Env:
//   PORT            HTTP port (default 8080)
//   FREED_PORT_1    UDP port for virtual camera 1 (default 40001)
//   FREED_PORT_2    UDP port for virtual camera 2 (default 40002)
//   SIMULATE=1      also send a slow synthetic FreeD sweep to both ports (for a dry run)

import http from 'node:http';
import dgram from 'node:dgram';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseFreeD, encodeFreeD } from './freed.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const config = {
  httpPort: Number(process.env.PORT ?? 8080),
  cameras: [
    { id: 'cam1', udpPort: Number(process.env.FREED_PORT_1 ?? 40001) },
    { id: 'cam2', udpPort: Number(process.env.FREED_PORT_2 ?? 40002) },
  ],
};

const clients = new Set();
const latest = {};

function broadcast(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(line);
}

function startListener(cam) {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (msg, rinfo) => {
    let pose;
    try {
      pose = parseFreeD(msg);
    } catch (err) {
      console.warn(`[${cam.id}] dropped packet from ${rinfo.address}: ${err.message}`);
      return;
    }
    const event = { cam: cam.id, from: rinfo.address, pose, at: Date.now() };
    latest[cam.id] = event;
    broadcast(event);
  });
  socket.bind(cam.udpPort, () => console.log(`[${cam.id}] FreeD on UDP ${cam.udpPort}`));
  return socket;
}

function startSimulator() {
  const sender = dgram.createSocket('udp4');
  let t = 0;
  setInterval(() => {
    t += 0.05;
    config.cameras.forEach((cam, i) => {
      const packet = encodeFreeD({
        cameraId: i + 1,
        pan: 8 * Math.sin(t + i),
        tilt: 3 * Math.sin(t / 2),
        x: 500 * i,
        y: 0,
        z: -3000,
        zoom: 20000 + 15000 * Math.sin(t / 3),
      });
      sender.send(packet, cam.udpPort, '127.0.0.1');
    });
  }, 40);
}

const staticFiles = {
  '/': ['public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['public/app.js', 'text/javascript; charset=utf-8'],
  '/camera-mapping.js': ['src/camera-mapping.js', 'text/javascript; charset=utf-8'],
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname === '/config') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ cameras: config.cameras.map(({ id, udpPort }) => ({ id, udpPort })) }));
    return;
  }
  if (url.pathname === '/events') {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' });
    res.write(`data: ${JSON.stringify({ hello: true, latest })}\n\n`);
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  const entry = staticFiles[url.pathname];
  if (!entry) {
    res.writeHead(404).end('not found');
    return;
  }
  try {
    const body = await readFile(path.join(root, entry[0]));
    res.writeHead(200, { 'content-type': entry[1] });
    res.end(body);
  } catch {
    res.writeHead(500).end('missing file');
  }
});

config.cameras.forEach(startListener);
if (process.env.SIMULATE === '1') startSimulator();
server.listen(config.httpPort, () => console.log(`open http://localhost:${config.httpPort}/`));
