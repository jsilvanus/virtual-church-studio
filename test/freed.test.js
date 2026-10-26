import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFreeD, encodeFreeD, FREED_PACKET_LENGTH } from '../src/freed.js';

test('round-trips pan, tilt, position and zoom', () => {
  const packet = encodeFreeD({ cameraId: 2, pan: -12.5, tilt: 4.25, x: 1200, y: -300.5, z: 1650, zoom: 40000 });
  assert.equal(packet.length, FREED_PACKET_LENGTH);
  const pose = parseFreeD(packet);
  assert.equal(pose.cameraId, 2);
  assert.ok(Math.abs(pose.pan - -12.5) < 0.001);
  assert.ok(Math.abs(pose.tilt - 4.25) < 0.001);
  assert.ok(Math.abs(pose.x - 1200) < 0.02);
  assert.ok(Math.abs(pose.y - -300.5) < 0.02);
  assert.ok(Math.abs(pose.z - 1650) < 0.02);
  assert.equal(pose.zoom, 40000);
});

test('rejects a bad checksum', () => {
  const packet = encodeFreeD({ pan: 1 });
  packet[28] ^= 0x01;
  assert.throws(() => parseFreeD(packet), /checksum/);
});

test('rejects the wrong length and message type', () => {
  assert.throws(() => parseFreeD(Buffer.alloc(10)), /29 bytes/);
  const packet = encodeFreeD({});
  packet[0] = 0xd2;
  packet[28] = 0; // checksum is checked after the type, so this still fails on type
  assert.throws(() => parseFreeD(packet), /message type/);
});
