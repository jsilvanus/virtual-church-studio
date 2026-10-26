// Small FreeD D1 listener for a camera's FreeD output (for example on kirkonpi).
// It prints one line per valid packet and a summary every 10 seconds.
// It sends nothing back and does not drive any camera.
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

export function startListener({ port, host }, log = console) {
  const stats = { packets: 0, bad: 0, sources: new Map(), cameras: new Set() };
  const socket = dgram.createSocket('udp4');

  socket.on('message', (msg, rinfo) => {
    const source = `${rinfo.address}:${rinfo.port}`;
    try {
      const pose = parseFreeD(msg);
      stats.packets += 1;
      stats.cameras.add(pose.cameraId);
      stats.sources.set(source, (stats.sources.get(source) ?? 0) + 1);
      log.log(
        `${new Date().toISOString()} cam=${pose.cameraId} from=${source} ` +
          `pan=${pose.pan.toFixed(2)} tilt=${pose.tilt.toFixed(2)} roll=${pose.roll.toFixed(2)} ` +
          `x=${pose.x.toFixed(1)} y=${pose.y.toFixed(1)} z=${pose.z.toFixed(1)} ` +
          `zoom=${pose.zoom} focus=${pose.focus}`,
      );
    } catch (err) {
      stats.bad += 1;
      log.warn(`${new Date().toISOString()} bad packet from=${source} length=${msg.length}: ${err.message}`);
    }
  });

  const summary = setInterval(() => {
    const sources = [...stats.sources].map(([s, n]) => `${s} (${n})`).join(', ') || 'none';
    log.log(
      `summary: packets=${stats.packets} bad=${stats.bad} ` +
        `camera ids=[${[...stats.cameras].join(',')}] sources=${sources}`,
    );
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
