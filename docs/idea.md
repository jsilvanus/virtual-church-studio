# Idea: virtual studio graphics for the church

Status: idea only. No plan, no decisions, nothing built.

## The idea

Put 3D graphics into the church's live picture so that they appear fixed in the room. A name label could stand on the floor next to a speaker, and it would stay there when the camera pans, tilts or zooms.

## Why the Pi cannot do it

The Raspberry Pi in the stack (see `pimatrix`, `picontrol`) is fine for switching, capture and 2D overlays. It cannot render real-time 3D that matches a moving camera. The rendering would run on a separate GPU PC with a real-time engine: Unreal Engine, Unity or Vizrt.

## What the camera has to provide

- The PTZ330 cameras have a FreeD setting (per the coordinator's note; not yet checked against the camera manual). FreeD sends pan, tilt and zoom (PTZ) data over the network to the render engine.
- The engine uses that data to move a virtual camera so the 3D graphics line up with the real picture.

## What the engine needs

- **Camera calibration.** The real camera's position and lens behaviour have to be known, so the virtual camera matches it.
- **A lens table.** Zoom and focus values mapped to the real field of view, so the graphics keep their size and place at each zoom level.
- **Delay.** FreeD data arrives faster than the video passes through the encoder and the mixer. The FreeD data has to be delayed by the same amount, or the graphics will lag behind the picture when the camera moves.

## Where pimatrix fits

`pimatrix` would supply the camera streams to the render engine. It is not yet known whether the engine can take a stream directly from the Pi or needs a separate feed.

## A possible first test

Keep it small:

1. Use one camera with a fixed position (no pan, tilt or zoom changes).
2. Place one floor-anchored name label in the render engine.
3. Check that the label stays put in the picture.

A static camera needs no FreeD delay and no lens table, so this test checks the rendering and the calibration only.

## Open questions

- Does the PTZ330 FreeD output work as described, and on which port and format?
- Which render engine fits the church's budget and the GPU PC?
- How much calibration work is needed for each camera position?
- Whether the lens table can be built once and reused.

## Notes (2026-10-26)

- Juha asked for this idea to be recorded in this repo. Still no plan.
- FreeD on the PTZ330: our keskuskirkko hardware notes (`docs/hardware/aver-ptz330.md`) do not mention FreeD. Juha saw a FreeD setting on the camera's web page, so it probably exists in the firmware. Not yet checked against AVer's documents.
- The same notes list VISCA position inquiries over IP (`PT_PosInq`, `CAM_ZoomPosInq`). They could report pan, tilt and zoom, but they are not FreeD.
