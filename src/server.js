// Prototype server: listens for FreeD D1 on one UDP port per virtual camera,
// and streams the parsed poses to the browser over Server-Sent Events.
// The browser renders the 3D scene and produces the fill and key outputs.
//
// Env:
//   PORT            HTTP port (default 8080)
//   FREED_PORT      UDP port both cameras send to (default 40000)
//   FREED_CAMERA_IDS  camera id to virtual camera map (default "101=cam1,102=cam2")
//   SIMULATE=1      also send a slow synthetic FreeD sweep to the port (for a dry run)

import http from 'node:http';
import dgram from 'node:dgram';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { parseFreeD, encodeFreeD } from './freed.js';
import { routeCameraId, parseCameraIds } from './camera-routing.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');

const config = {
  httpPort: Number(process.env.PORT ?? 8080),
  udpPort: Number(process.env.FREED_PORT ?? 40000),
  cameraIds: parseCameraIds(process.env.FREED_CAMERA_IDS),
};
const cameraNames = [...new Set(Object.values(config.cameraIds))];

const clients = new Set();
const latest = {};

function broadcast(event) {
  const line = `data: ${JSON.stringify(event)}\n\n`;
  for (const res of clients) res.write(line);
}

function startListener() {
  const socket = dgram.createSocket('udp4');
  socket.on('message', (msg, rinfo) => {
    let pose;
    try {
      pose = parseFreeD(msg);
    } catch (err) {
      console.warn(`dropped packet from ${rinfo.address}: ${err.message}`);
      return;
    }
    const name = routeCameraId(pose.cameraId, config.cameraIds);
    if (!name) return; // not one of our cameras
    const event = { cam: name, from: rinfo.address, pose, at: Date.now() };
    latest[name] = event;
    broadcast(event);
  });
  socket.bind(config.udpPort, () => console.log(`FreeD on UDP ${config.udpPort}`));
  return socket;
}

function startSimulator() {
  const sender = dgram.createSocket('udp4');
  const ids = Object.keys(config.cameraIds).map(Number);
  let t = 0;
  setInterval(() => {
    t += 0.05;
    ids.forEach((cameraId, i) => {
      const packet = encodeFreeD({
        cameraId,
        pan: 8 * Math.sin(t + i),
        tilt: 3 * Math.sin(t / 2),
        x: 500 * i,
        y: 0,
        z: -3000,
        zoom: 20000 + 15000 * Math.sin(t / 3),
      });
      sender.send(packet, config.udpPort, '127.0.0.1');
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
    res.end(JSON.stringify({ udpPort: config.udpPort, cameras: cameraNames }));
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

startListener();
if (process.env.SIMULATE === '1') startSimulator();
server.listen(config.httpPort, () => console.log(`open http://localhost:${config.httpPort}/`));
