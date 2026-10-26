// FreeD D1 packet parser (29 bytes, one UDP datagram per update).
// Layout and checksum follow the common FreeD D1 description. Unverified
// against the PTZ330 firmware: check each field on the camera's FreeD page.

export const FREED_PACKET_LENGTH = 29;
const MESSAGE_TYPE_D1 = 0xd1;

function signed24(buf, offset) {
  const value = (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
  return value & 0x800000 ? value - 0x1000000 : value;
}

function unsigned24(buf, offset) {
  return (buf[offset] << 16) | (buf[offset + 1] << 8) | buf[offset + 2];
}

export function freedChecksum(buf) {
  let sum = 0;
  for (let i = 0; i < FREED_PACKET_LENGTH - 1; i += 1) sum += buf[i];
  return (0x40 - sum) & 0xff;
}

/**
 * Parse one D1 packet.
 * Angles are degrees, position is millimetres, zoom and focus are raw counts.
 * Throws on a wrong length, message type or checksum.
 */
export function parseFreeD(input) {
  const buf = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (buf.length !== FREED_PACKET_LENGTH) {
    throw new Error(`FreeD packet must be ${FREED_PACKET_LENGTH} bytes, got ${buf.length}`);
  }
  if (buf[0] !== MESSAGE_TYPE_D1) {
    throw new Error(`unexpected FreeD message type 0x${buf[0].toString(16)}`);
  }
  if (buf[28] !== freedChecksum(buf)) {
    throw new Error('FreeD checksum mismatch');
  }
  return {
    cameraId: buf[1],
    pan: signed24(buf, 2) / 32768,
    tilt: signed24(buf, 5) / 32768,
    roll: signed24(buf, 8) / 32768,
    x: signed24(buf, 11) / 64,
    y: signed24(buf, 14) / 64,
    z: signed24(buf, 17) / 64,
    zoom: unsigned24(buf, 20),
    focus: unsigned24(buf, 23),
  };
}

/** Build a D1 packet. Used by the tests and by the simulator. */
export function encodeFreeD({ cameraId = 1, pan = 0, tilt = 0, roll = 0, x = 0, y = 0, z = 0, zoom = 0, focus = 0 }) {
  const buf = Buffer.alloc(FREED_PACKET_LENGTH);
  buf[0] = MESSAGE_TYPE_D1;
  buf[1] = cameraId;
  const put24 = (offset, value) => {
    const v = Math.round(value) & 0xffffff;
    buf[offset] = (v >> 16) & 0xff;
    buf[offset + 1] = (v >> 8) & 0xff;
    buf[offset + 2] = v & 0xff;
  };
  put24(2, pan * 32768);
  put24(5, tilt * 32768);
  put24(8, roll * 32768);
  put24(11, x * 64);
  put24(14, y * 64);
  put24(17, z * 64);
  put24(20, zoom);
  put24(23, focus);
  buf[28] = freedChecksum(buf);
  return buf;
}
