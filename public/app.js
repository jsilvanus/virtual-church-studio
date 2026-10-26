import * as THREE from 'three';
import { poseToCameraState } from '/camera-mapping.js';

const WIDTH = 960;
const HEIGHT = 540;
const statusEl = document.getElementById('status');

// Renderer for the offscreen pass. Each output is copied to its own visible canvas.
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setSize(WIDTH, HEIGHT, false);
renderer.setClearColor(0x000000, 1);

// One shared scene: a floor label fixed in the room, at 2 m in front of the origin.
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

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
scene.add(label);

// Two virtual cameras, one per physical camera. Each is driven by its own FreeD stream.
const cameras = {
  cam1: new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.05, 100),
  cam2: new THREE.PerspectiveCamera(60, WIDTH / HEIGHT, 0.05, 100),
};
const outputs = [
  { cam: 'cam1', kind: 'fill', canvas: document.getElementById('cam1-fill') },
  { cam: 'cam1', kind: 'key', canvas: document.getElementById('cam1-key') },
  { cam: 'cam2', kind: 'fill', canvas: document.getElementById('cam2-fill') },
  { cam: 'cam2', kind: 'key', canvas: document.getElementById('cam2-key') },
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

function renderAll() {
  for (const out of outputs) {
    label.material = out.kind === 'fill' ? fillMaterial : keyMaterial;
    renderer.render(scene, cameras[out.cam]);
    const ctx = out.canvas.getContext('2d');
    ctx.drawImage(renderer.domElement, 0, 0, out.canvas.width, out.canvas.height);
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
