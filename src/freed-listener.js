// Small FreeD D1 listener for a camera's FreeD output (for example on kirkonpi).
// Logs a line only when a camera's pose changes (rounded) and a summary every 10 s,
// so a steady 60 packets/s feed does not fill the log. It sends nothing back.
//
// Usage:
//   node src/freed-listener.js [--port 40000] [--host 0.0.0.0]
//   Env: FREED_PORT, FREED_HOST (flags win over env)

import dgram from 'node:dgram';
import { parseFreeD } from './freed.js';

export function parseArgs(argv, env = process.env) {
  const opts = {
    port: Number(env.FREED_PORT ?? 40000),
    host: env.FREED_HOST ?? '0.0.0.0',
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--port') opts.port = Number(argv[++i]);
    else if (argv[i] === '--host') opts.host = argv[++i];
  }
  if (!Number.isInteger(opts.port) || opts.port < 1 || opts.port > 65535) {
    throw new Error(`invalid port: ${opts.port}`);
  }
  return opts;
}

// Key of the values that matter for a log line. Angles rounded to 0.1 degree,
// position to 1 mm, zoom and focus as raw counts.
function poseKey(p) {
  return [p.pan, p.tilt, p.roll, p.x, p.y, p.z].map((v, i) => (i < 3 ? Math.round(v * 10) : Math.round(v))).join(',')
    + `|${p.zoom}|${p.focus}`;
}

export function startListener({ port, host }, log = console) {
  const stats = { packets: 0, bad: 0, cameras: new Map(), sources: new Map() };
  const socket = dgram.createSocket('udp4');

  socket.on('message', (msg, rinfo) => {
    const source = `${rinfo.address}:${rinfo.port}`;
    let pose;
    try {
      pose = parseFreeD(msg);
    } catch (err) {
      stats.bad += 1;
      log.warn(`bad packet from=${source} length=${msg.length}: ${err.message}`);
      return;
    }
    stats.packets += 1;
    stats.sources.set(source, (stats.sources.get(source) ?? 0) + 1);
    const cam = stats.cameras.get(pose.cameraId) ?? { count: 0, key: null, last: null };
    cam.count += 1;
    cam.last = pose;
    const key = poseKey(pose);
    if (key !== cam.key) {
      cam.key = key;
      log.log(
        `${new Date().toISOString()} cam=${pose.cameraId} from=${source} ` +
          `pan=${pose.pan.toFixed(2)} tilt=${pose.tilt.toFixed(2)} roll=${pose.roll.toFixed(2)} ` +
          `x=${pose.x.toFixed(1)} y=${pose.y.toFixed(1)} z=${pose.z.toFixed(1)} ` +
          `zoom=${pose.zoom} focus=${pose.focus}`,
      );
    }
    stats.cameras.set(pose.cameraId, cam);
  });

  const summary = setInterval(() => {
    const cams = [...stats.cameras].map(([id, c]) => `${id}:${c.count}`).join(' ') || 'none';
    const sources = [...stats.sources].map(([s, n]) => `${s} (${n})`).join(', ') || 'none';
    log.log(`summary: packets=${stats.packets} bad=${stats.bad} per-camera=[${cams}] sources=${sources}`);
    stats.packets = 0;
    stats.bad = 0;
    stats.cameras.forEach((c) => { c.count = 0; });
    stats.sources.clear();
  }, 10000);
  summary.unref();

  socket.bind(port, host, () => {
    log.log(`listening for FreeD on UDP ${host}:${port}`);
  });
  return socket;
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  startListener(parseArgs(process.argv.slice(2)));
}
