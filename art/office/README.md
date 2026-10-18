# Office assets

The office follows the user's hand-drawn reference. The reference PDF is not redistributed.

## Rebuilding the scene

Run Blender 4.5 from the repository root:

```sh
blender -b --python art/office/build_office.py
```

The builder uses the canonical, optimized `tripo-*.glb` inputs in this folder. It checks each file against its JSON sidecar's `optimizedSHA256` before importing it. A missing optional model leaves that object's native Blender fallback; an existing model with invalid provenance fails the build. The release checker requires all six new furniture models and the previously generated chair.

Outputs are `source/models/office.blend`, `office.glb`, `office-manifest.json`, and `office-preview.png`. The Blender scene contains packed images and remains editable. The GLB contains embedded textures, named interaction groups and a camera. The PNG is a rendered fallback; it is not the interactive scene. Ordinary CI copies and checks these committed outputs rather than running Blender.

## Generated models and original geometry

| Canonical input | Interactive group | Placement |
| --- | --- | --- |
| `tripo-desk.glb` | `Desk` | Wide walnut desk; the separate leather desk pad is preserved. |
| `tripo-laptop.glb` | `Laptop` | Generated casing with a Blender-finished work deck, individual keys, trackpad, trim and planar screen. |
| `tripo-lamp.glb` | `BankersLamp` | Emerald and brass banker's lamp to the left of the laptop. |
| `tripo-archive.glb` | `Bookshelf` | Archive cabinet in the existing left-wall slot. |
| `tripo-phone.glb` | `Phone` | Generated device body, with a clean Blender-finished portrait screen. |
| `tripo-cactus.glb` | `Cactus` | Small potted cactus behind the phone. |
| `tripo-chair.glb` | `TripoChair` | Existing tufted green leather chair, retained in its approved pose. |

Each generated model has a prompt and a JSON provenance record identifying the actual Tripo service/model, generation ID, original download SHA-256, optimized SHA-256, geometry counts, texture dimensions and optimization date. The lamp's generated mesh is refinished with brass and calm dark green enamel to remove purple and blue artifacts in its original texture; the canonical Tripo input still retains the original generated PBR images. The scene manifest's `tripoAssets` array includes the six new models only after successful import. The existing chair retains its separate `tripo` record for compatibility.

The room, wall panels, framed map, mirror, folders, desk pad, fountain pen, portrait frame and small desk accessories are original procedural Blender geometry. The two folders remain separate objects with papers, labels and clasps. The unbranded fountain pen has black lacquer, a gold nib and trim, and a separate cap. The lawyer portrait uses the pre-existing game image.

## Optimizing a Tripo download

Keep the original download outside the repository, then create the canonical input with:

```sh
blender -b --python art/office/optimize_tripo_asset.py -- \
  --input /path/to/original.glb \
  --output art/office/tripo-desk.glb \
  --metadata art/office/tripo-desk.json \
  --asset desk --triangles 18000 --texture-size 512
```

The script leaves the original file untouched. It performs collapse decimation, resizes embedded PBR textures by role, reloads the encoded reduced images to prevent accidental 4K texture reuse, exports a self-contained GLB and records both source hashes. `optimize_tripo_chair.py` retains the original chair's reproducible optimization workflow. No original multi-million-triangle downloads are required by the scene builder or release.

## Live screen contracts

The laptop uses the independent `ScreenAnchor`: unit scale, no parent, a local XY plane with its normal facing +Z in glTF. Its physical size is 4.45 × 2.7688888889 and its DOM size is 900 × 560. The export step compensates for Blender's empty-axis conversion. The generated laptop's lid is aligned behind that exact surface. Manual Blender finishing adds a planar work deck, separate keycaps, a trackpad and bevelled display trim over the retained Tripo casing to remove dents in the generated hard surfaces. Split normals are recomputed after fitting all six models. The screen anchor and camera composition are preserved.

The phone uses `phoneScreen` from the manifest: a local glTF XY plane at `[0, 0.86, 0.115]` in the authored `Phone` group, physical size 0.72 × 1.49 and DOM width 320. The root's established tilt is preserved. The generated body is fitted behind the rectangular live interface. The static fallback face reads LINE / ONLINE; account balances appear only in the live bank UI. Focus cameras use each screen's normal and up direction.

Named roots and `labelAnchors` support hover labels for the desk, lamp, cactus, chair and game interactions. The manifest records the coordinate conversion from Blender Z-up `(x, y, z)` to glTF Y-up `(x, z, -y)`.

## Runtime and release

Three.js is pinned locally under `source/vendor/three`, with its MIT license and npm integrity record. Runtime requests stay within the deployed static site. Blender and Tripo are production tools, not services called from the player's game.

Temporary downloads, browser data, credentials, signed URLs and Blender backups are excluded from the release. Canonical input models, provenance, builder code and packed output scene are committed before publication. The browser scene budget is below 10 MB and 200,000 triangles; its actual metrics are recorded in the manifest.
