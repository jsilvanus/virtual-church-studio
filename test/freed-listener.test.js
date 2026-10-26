import { test } from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import { parseArgs, startListener } from '../src/freed-listener.js';
import { encodeFreeD } from '../src/freed.js';

test('parseArgs reads flags and env, flags win', () => {
  assert.deepEqual(parseArgs([], {}), { port: 40001, host: '0.0.0.0' });
  assert.deepEqual(parseArgs([], { FREED_PORT: '5000', FREED_HOST: '127.0.0.1' }), { port: 5000, host: '127.0.0.1' });
  assert.equal(parseArgs(['--port', '6000'], { FREED_PORT: '5000' }).port, 6000);
  assert.throws(() => parseArgs(['--port', '99999'], {}), /invalid port/);
});

test('listener logs valid packets and counts bad ones', async () => {
  const lines = [];
  const warns = [];
  const log = { log: (m) => lines.push(m), warn: (m) => warns.push(m) };
  const socket = startListener({ port: 0, host: '127.0.0.1' }, log);
  await new Promise((resolve) => socket.once('listening', resolve));
  const { port } = socket.address();

  const sender = dgram.createSocket('udp4');
  sender.send(encodeFreeD({ cameraId: 3, pan: 5, zoom: 1234 }), port, '127.0.0.1');
  sender.send(Buffer.alloc(10), port, '127.0.0.1');
  await new Promise((resolve) => setTimeout(resolve, 150));
  sender.close();
  socket.close();

  assert.ok(lines.some((l) => l.includes('cam=3') && l.includes('zoom=1234')));
  assert.equal(warns.length, 1);
  assert.match(warns[0], /bad packet/);
});
