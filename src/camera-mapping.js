// Maps a FreeD pose to a three.js camera state. Pure (no three.js import),
// so it runs in Node tests and in the browser.
//
// Conventions (assumed, verify on site):
// - pan positive = turn right, tilt positive = tilt up, roll positive = clockwise
// - FreeD position is millimetres in the room's coordinate space; the scene uses metres
// - zoom is a raw count; the lens table maps it to a horizontal field of view
//
// The default lens table is a PLACEHOLDER built from the PTZ330 datasheet
// (67 deg wide, 2.3 deg tele). Its zoom raw values are invented. Replace it
// with a measured table from the calibration step.

export const DEFAULT_LENS_TABLE = [
  { zoom: 0, hfovDeg: 67 },
  { zoom: 65535, hfovDeg: 2.3 },
];

const DEG = Math.PI / 180;

/**
 * Horizontal field of view for a raw zoom value.
 * Interpolates tan(hfov/2), which is proportional to 1/focal length,
 * between the table points, and clamps outside the table.
 */
export function hfovFromZoom(zoomRaw, table = DEFAULT_LENS_TABLE) {
  const pts = [...table].sort((a, b) => a.zoom - b.zoom);
  if (zoomRaw <= pts[0].zoom) return pts[0].hfovDeg;
  const last = pts[pts.length - 1];
  if (zoomRaw >= last.zoom) return last.hfovDeg;
  for (let i = 1; i < pts.length; i += 1) {
    const a = pts[i - 1];
    const b = pts[i];
    if (zoomRaw <= b.zoom) {
      const t = (zoomRaw - a.zoom) / (b.zoom - a.zoom);
      const ta = Math.tan((a.hfovDeg * DEG) / 2);
      const tb = Math.tan((b.hfovDeg * DEG) / 2);
      const tn = ta + (tb - ta) * t;
      return (2 * Math.atan(tn)) / DEG;
    }
  }
  return last.hfovDeg;
}

/**
 * Camera state for a FreeD pose.
 * Returns position in metres, Euler angles in radians (order 'YXZ'),
 * and the vertical field of view for the given aspect ratio.
 */
export function poseToCameraState(pose, { aspect = 16 / 9, lensTable = DEFAULT_LENS_TABLE } = {}) {
  const hfovDeg = hfovFromZoom(pose.zoom, lensTable);
  const halfH = (hfovDeg * DEG) / 2;
  const vfovDeg = (2 * Math.atan(Math.tan(halfH) / aspect)) / DEG;
  return {
    position: { x: pose.x / 1000, y: pose.y / 1000, z: pose.z / 1000 },
    // three.js: positive y rotation turns left, so pan right is negative y.
    rotation: { x: pose.tilt * DEG, y: -pose.pan * DEG, z: pose.roll * DEG },
    order: 'YXZ',
    hfovDeg,
    vfovDeg,
  };
}
