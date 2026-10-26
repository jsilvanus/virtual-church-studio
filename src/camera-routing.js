// Routes FreeD camera ids to virtual cameras. Both physical cameras send to one
// port; the FreeD camera id in each packet says which camera it is.
// Ids confirmed on site: 101 = cam1, 102 = cam2.

export const DEFAULT_CAMERA_IDS = { 101: 'cam1', 102: 'cam2' };

export function routeCameraId(cameraId, map = DEFAULT_CAMERA_IDS) {
  return Object.hasOwn(map, cameraId) ? map[cameraId] : null;
}

// Parses FREED_CAMERA_IDS like "101=cam1,102=cam2". Empty or unset uses the default.
export function parseCameraIds(text) {
  if (!text) return { ...DEFAULT_CAMERA_IDS };
  const map = {};
  for (const pair of text.split(',')) {
    const [id, name] = pair.split('=').map((s) => s.trim());
    const num = Number(id);
    if (!Number.isInteger(num) || num < 0 || num > 255 || !name) {
      throw new Error(`invalid FREED_CAMERA_IDS entry: "${pair}"`);
    }
    map[num] = name;
  }
  return map;
}
