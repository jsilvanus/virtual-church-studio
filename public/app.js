import * as THREE from 'three';
import { poseToCameraState } from '/camera-mapping.js';

const WIDTH = 960;
const HEIGHT = 540;
const statusEl = document.getElementById('status');

// Offscreen renderer. Every view is rendered here and copied to its own visible canvas.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(WIDTH, HEIGHT, false);
renderer.setClearColor(0x000000, 1);

// Scene graphics: a floor label fixed in the room, 2 m in front of the origin.
const graphics = new THREE.Group();
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
scene.add(graphics);

// Preview-only content (room grid, camera markers and frustums). It is hidden
// during the output passes, so fill and key stay clean.
const previewOnly = new THREE.Group();
scene.add(previewOnly);
previewOnly.add(new THREE.GridHelper(10, 20, 0x555555, 0x333333));

// Room architecture: placeholder until the iPhone scan is in. Preview views only,
// so it never reaches fill or key. Dimensions are assumed, not measured.
const room = new THREE.Group();
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(10, 10),
  new THREE.MeshBasicMaterial({ color: 0x2a2a28, side: THREE.DoubleSide }),
);
floor.rotation.x = -Math.PI / 2;
room.add(floor);
const walls = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(10, 4, 10)),
  new THREE.LineBasicMaterial({ color: 0x888880 }),
);
walls.position.y = 2;
room.add(walls);
previewOnly.add(room);

function makeLabelTexture(text) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 120px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const labelTex = makeLabelTexture('Puhuja');
const fillMaterial = new THREE.MeshBasicMaterial({ map: labelTex, transparent: true });
// Key: the same shape in white. Over black it becomes a matte (white = graphic on).
const keyMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, map: labelTex, transparent: true });
const label = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.3), fillMaterial);
label.rotation.x = -Math.PI / 2; // lies on the floor
label.position.set(0, 0.001, -2);
graphics.add(label);

// Two virtual cameras, one per physical camera, each driven by its own FreeD stream.
const cameras = {
  cam1: new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.05, 100),
  cam2: new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.05, 100),
};
// Frustum helpers show where each virtual camera is, in the preview views only.
const frustums = {
  cam1: new THREE.CameraHelper(cameras.cam1),
  cam2: new THREE.CameraHelper(cameras.cam2),
};
frustums.cam1.material.color.set(0x4fa3ff);
frustums.cam2.material.color.set(0xffb34f);
previewOnly.add(frustums.cam1, frustums.cam2);

// Operator view: a third camera that is not an output. A fixed wide view of the room
// so the operator can see the set and the virtual cameras in place.
const operatorCamera = new THREE.PerspectiveCamera(55, WIDTH / HEIGHT, 0.05, 100);
operatorCamera.position.set(0, 1.6, 4);
operatorCamera.lookAt(0, 0.5, -2);

// Top view: orthographic, looking straight down at the room (floor plan).
const topCamera = new THREE.OrthographicCamera(-5, 5, 2.8, -2.8, 0.1, 100);
topCamera.position.set(0, 20, 0);
topCamera.up.set(0, 0, -1); // screen up = away from the operator
topCamera.lookAt(0, 0, 0);

const outputs = [
  { cam: 'cam1', kind: 'fill', canvas: document.getElementById('cam1-fill'), output: true },
  { cam: 'cam1', kind: 'key', canvas: document.getElementById('cam1-key'), output: true },
  { cam: 'cam2', kind: 'fill', canvas: document.getElementById('cam2-fill'), output: true },
  { cam: 'cam2', kind: 'key', canvas: document.getElementById('cam2-key'), output: true },
  { cam: operatorCamera, kind: 'preview', canvas: document.getElementById('operator-view'), output: false },
  { cam: topCamera, kind: 'preview', canvas: document.getElementById('top-view'), output: false },
];

const lastPose = {};

function applyPose(event) {
  const cam = cameras[event.cam];
  if (!cam) return;
  const state = poseToCameraState(event.pose, { aspect: WIDTH / HEIGHT });
  cam.fov = state.vfovDeg;
  cam.updateProjectionMatrix();
  cam.position.set(state.position.x, state.position.y, state.position.z);
  cam.rotation.order = state.order;
  cam.rotation.set(state.rotation.x, state.rotation.y, state.rotation.z);
  lastPose[event.cam] = event;
}

function drawTo(canvas) {
  const ctx = canvas.getContext('2d');
  ctx.drawImage(renderer.domElement, 0, 0, canvas.width, canvas.height);
}

function renderAll() {
  frustums.cam1.update();
  frustums.cam2.update();

  // Output passes: graphics only, on black.
  previewOnly.visible = false;
  for (const out of outputs.filter((o) => o.output)) {
    label.material = out.kind === 'fill' ? fillMaterial : keyMaterial;
    renderer.render(scene, cameras[out.cam]);
    drawTo(out.canvas);
  }

  // Preview passes: operator and top views, with the room grid and camera markers.
  label.material = fillMaterial;
  previewOnly.visible = true;
  for (const out of outputs.filter((o) => !o.output)) {
    renderer.render(scene, out.cam);
    drawTo(out.canvas);
  }

  requestAnimationFrame(renderAll);
}

function describeStatus(connected) {
  const parts = Object.entries(lastPose).map(([cam, ev]) => {
    const age = ((Date.now() - ev.at) / 1000).toFixed(1);
    return `${cam}: pan ${ev.pose.pan.toFixed(1)}° tilt ${ev.pose.tilt.toFixed(1)}° zoom ${ev.pose.zoom} (${age}s ago)`;
  });
  statusEl.textContent = (connected ? 'FreeD connected. ' : 'No connection. ') + (parts.join(' · ') || 'waiting for FreeD');
}

const events = new EventSource('/events');
events.onopen = () => describeStatus(true);
events.onerror = () => describeStatus(false);
events.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.hello) {
    for (const ev of Object.values(data.latest ?? {})) applyPose(ev);
  } else {
    applyPose(data);
  }
  describeStatus(true);
};
setInterval(() => describeStatus(true), 1000);

renderAll();
