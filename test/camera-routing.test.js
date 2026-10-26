import { test } from 'node:test';
import assert from 'node:assert/strict';
import { routeCameraId, parseCameraIds, DEFAULT_CAMERA_IDS } from '../src/camera-routing.js';

test('default ids route to cam1 and cam2, unknown ids to null', () => {
  assert.equal(routeCameraId(101), 'cam1');
  assert.equal(routeCameraId(102), 'cam2');
  assert.equal(routeCameraId(7), null);
});

test('parseCameraIds reads the env form and rejects bad entries', () => {
  assert.deepEqual(parseCameraIds(''), DEFAULT_CAMERA_IDS);
  assert.deepEqual(parseCameraIds('5=a, 6=b'), { 5: 'a', 6: 'b' });
  assert.throws(() => parseCameraIds('300=x'), /invalid/);
  assert.throws(() => parseCameraIds('101'), /invalid/);
});
