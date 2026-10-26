# virtual-church-studio

Notes for a future virtual studio: 3D graphics that appear fixed in the church's live picture.

Status: idea stage. Nothing is built yet.

- [`docs/idea.md`](docs/idea.md): the idea, why the Pi cannot render it, and open questions.

## Prototype: two FreeD virtual cameras (three.js)

Status: prototype, not verified against real cameras, the render PC, or the ATEM.

- `src/freed.js`: parses FreeD D1 packets (29 bytes, checksum checked).
- `src/camera-mapping.js`: FreeD pose to three.js camera (mm to m, lens table, field of view). The lens table is a placeholder until calibration.
- `src/server.js`: one UDP listener per virtual camera (`FREED_PORT_1`, `FREED_PORT_2`) and a browser page over Server-Sent Events.
- `public/`: three.js scene with one floor label and two virtual cameras. Each camera gives a fill and a key output (white graphic on black).

Run:

```bash
npm install            # no runtime dependencies; three.js loads from unpkg in the browser
npm test
SIMULATE=1 npm start   # open http://localhost:8080/ with a synthetic FreeD sweep
```

Without `SIMULATE`, point each physical camera's FreeD output at this host's UDP ports (default 40001 and 40002). Values and conventions (port, mode, pan/tilt signs, position origin) are unverified until checked on the camera's FreeD page and on site.
