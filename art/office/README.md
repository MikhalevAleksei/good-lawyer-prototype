# Office assets

The office follows the user's hand-drawn reference. The PDF itself is not redistributed.

- `build_office.py`: native Blender geometry, materials, interactive groups, camera and screen anchor. Run from the repository with Blender 4.5: `blender -b --python art/office/build_office.py`.
- `tripo-chair.glb`: the canonical, optimized input model generated for this project through Tripo Studio. The generation prompt and actual service/model are recorded alongside it.
- `source/models/office.blend`: editable scene, with required images packed.
- `source/models/office.glb`: browser-ready geometry, materials, profile picture and camera.
- `source/models/office-manifest.json`: bounds, coordinate system, anchor dimensions, provenance and triangle/byte counts.
- `source/models/office-preview.png`: rendered fallback, not the interactive 3D scene.

The laptop screen uses the independent `ScreenAnchor` transform. It has a local XY plane, normal toward +Z in glTF and unit scale. Its physical dimensions and 900 × 560 DOM dimensions are recorded in the manifest. The export step compensates for Blender's empty-axis conversion.

Folders and fountain pen are original Blender geometry. The pen has black lacquer, a gold nib and trim, and a separate cap; it has no brand logo. The lawyer portrait comes from the pre-existing game asset. The static phone face reads LINE / ONLINE; the actual balance is displayed in the live bank UI.

Three.js is pinned and stored locally under `source/vendor/three` with its original MIT license and npm integrity record. Runtime requests stay within the deployed static site. Blender and Tripo are production tools, not services called from a player's game.

Temporary downloads, browser data, credentials, signed URLs and Blender backups are excluded from the release. The canonical input and committed scene are sufficient for building the published website. Regenerate the scene only when changing its artwork; ordinary CI copies and checks the committed assets.

The phone DOM surface uses `phoneScreen` from the manifest: a local glTF XY plane at `[0, 0.86, 0.115]` in the authored `Phone` group, in front of the decorative face. Its world transform follows the Blender model. Focus cameras use each screen normal and up direction; no alternate 2D window is used while WebGL is available.
