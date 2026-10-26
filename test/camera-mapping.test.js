import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hfovFromZoom, poseToCameraState, DEFAULT_LENS_TABLE } from '../src/camera-mapping.js';

test('wide and tele ends of the lens table', () => {
  assert.equal(hfovFromZoom(0), 67);
  assert.equal(hfovFromZoom(65535), 2.3);
  assert.equal(hfovFromZoom(-5), 67);
  assert.equal(hfovFromZoom(99999), 2.3);
});

test('field of view narrows monotonically with zoom', () => {
  let prev = Infinity;
  for (let z = 0; z <= 65535; z += 4096) {
    const h = hfovFromZoom(z, DEFAULT_LENS_TABLE);
    assert.ok(h <= prev + 1e-9, `fov rose at zoom ${z}`);
    prev = h;
  }
});

test('pose converts mm to m and pan right to negative yaw', () => {
  const state = poseToCameraState({ pan: 10, tilt: 0, roll: 0, x: 1500, y: 0, z: -2000, zoom: 0 });
  assert.equal(state.position.x, 1.5);
  assert.equal(state.position.z, -2);
  assert.ok(Math.abs(state.rotation.y + 10 * Math.PI / 180) < 1e-9);
  assert.equal(state.order, 'YXZ');
});

test('vertical fov follows the aspect ratio', () => {
  const wide = poseToCameraState({ pan: 0, tilt: 0, roll: 0, x: 0, y: 0, z: 0, zoom: 0 }, { aspect: 16 / 9 });
  const square = poseToCameraState({ pan: 0, tilt: 0, roll: 0, x: 0, y: 0, z: 0, zoom: 0 }, { aspect: 1 });
  assert.ok(square.vfovDeg > wide.vfovDeg);
});
