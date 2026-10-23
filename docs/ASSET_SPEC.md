# Asset specification

Everything replaceable is listed in **`src/assets/manifest.ts`**. A manifest entry whose `source` is `null` means *not
provided yet*: the app uses a procedural placeholder (3D) or a synthesised sound (audio). Nothing in the repository is final artwork.

| Asset | Status today |
|---|---|
| 3D house / objects | **Placeholder primitives** (`src/scene/placeholders.ts`) |
| Animation clips | None (a small procedural "pulse" on selection is used) |
| Sound effects (16 ids) | **Synthesised** (ported from the originals); no samples supplied |
| Mood loops (rain, gentle, sleep, reunion, cuddly) | **Not provided**: silent until you add files |
| Textures, UI images | None (placeholder colours; ♥ glyph instead of a logo) |
| Sticker art, room song, notes, originals | Real, **private** — baked into your private build by `npm run build:private` |

## Sources

```ts
{ kind: 'public',  path: '/assets/3d/house.glb' }                 // served from public/assets — only for art that is fine to be public
{ kind: 'private', fileId: '<uuid of a file stored in the in-page backend>' }
```

Private sources use a stored file id (see `uploadFile` in `src/data/files.ts`). **GLB models are not an allowed file kind**: ship the GLB as a
`public` asset next to the HTML file's source (the room geometry is not sensitive; note a single-file build inlines assets), or add a `model`
kind to `server/routes/files.ts` (`FILE_RULES` and `server/sniff.ts`) first.

## 3D environment (Blender → GLB)

You can supply **one house GLB** (`models.house`) and/or **individual object GLBs** (`models.objects.<id>`, placed at the
position in the registry). Anything still missing falls back to a placeholder, object by object, so assets can be swapped in gradually.

- Export glTF 2.0 binary (`.glb`), **+Y up**, 1 unit = 1 metre, apply transforms, one scene.
- The room is about **4.6 m wide × 3.4 m deep × 2.5 m high**, floor centred on the origin, back wall at −Z, left wall at −X.
  The orthographic camera looks from the +X/+Z corner (offset ≈ (4.2, 3.7, 5.2)). Walls facing the camera should be open or cut away.
- If your scale differs, set `models.house.scale`, `offset`, `rotationY` instead of re-exporting.

### Interactive objects — the naming contract

Name the **top-level node** of each interactive object exactly as below (or give it a custom property `signal_id` with that
value, which exports as glTF `extras` and wins over the name). Blender's `.001` suffix on duplicates is tolerated.
The node's origin should be at its base. It may contain any number of child meshes; the whole subtree is the clickable object.

| Node name (`id`) | What it opens | Placeholder at (x, y, z) |
|---|---|---|
| `obj_rose_pot` | Love Ping (the rose grows with bond) | 1.55, 0, 0.55 |
| `obj_guitar` | Listening Together | −1.55, 0, −0.8 |
| `obj_garden_window` | Mood Garden | 1.35, 1.35, −1.66 |
| `obj_date_jar` | Date Jar | −0.5, 0, 0.85 |
| `obj_letter_desk` | Hidden Notes | −2.0, 0, 0.35 |
| `obj_spell_table` | Vee's Spell Table | 0.35, 0, −0.75 |
| `obj_wall_heart` | Love Universe | −0.5, 1.7, −1.66 |
| `obj_memory_shelf` | Memory Vault | −2.15, 1.35, −0.9 |
| `obj_mischief_box` | Mischief Mode | 0.7, 0, 1.0 |
| `obj_time_chest` | Time Capsule | −1.7, 0, 1.0 |
| `obj_ceiling_lamp` | toggles the lamp (no panel) | 0, 2.08, −0.1 |

To add or rebind an object, edit **only** `src/registry/interactionRegistry.ts` (id, label, behaviour, camera preset, highlight colour,
whether hidden notes can be pinned to it). Tests fail if ids collide or a panel is unbound.

### Optional well-known nodes (driven by the app if present)

| Node | Effect |
|---|---|
| `rose_bloom` | scales with the rose stage (0–5) |
| `rose_aura` | glow mesh pulsing with bond and mood (use a transparent emissive material) |
| `garden_anchor` | empty at the planter's soil: shared garden plants are parented here (≈ 1.3 m × 0.25 m) |
| `lamp_bulb` / `lamp_halo` | emissive bulb and halo mesh that follow the lamp state |

Mesh names `floor`, `wall_back`, `wall_left`, `rug` can be re-textured from `manifest.textures.<name>`.

### Materials, hit areas, highlighting

- Standard glTF PBR materials. Selection highlight is an emissive tint; the app clones materials per interactive object, so shared materials are fine.
- A generous invisible hit box is added around every object for touch; you do not need to model one.
- Real geometry always beats another object's hit box, so overlap is safe.

### Animation clips

Clip names are yours. Bind them in the manifest — no code change:

```ts
animations: [
  { clip: 'guitar_strum', objectId: 'obj_guitar', trigger: 'select', loop: false },
  { clip: 'rose_sway',    objectId: 'obj_rose_pot', trigger: 'idle', loop: true },
  { clip: 'envelope_bob', objectId: 'obj_letter_desk', trigger: 'unread-note', loop: true },
]
```
Triggers: `idle` (always), `select` (when opened), `hover`, `unread-note` (while an unread note is pinned there). Unknown objects or duplicate bindings are reported by `validateManifest`.

### Budgets (guidance)

≤ 150 k triangles for the whole room, ≤ 150 draw calls, textures ≤ 2048 px (KTX2/WebP not yet supported — use PNG/JPEG inside the GLB),
GLB ≤ 8 MB. Draco: set `models.house.draco = true`, copy `node_modules/three/examples/jsm/libs/draco/` to `public/draco/`, and extend the CSP
with `worker-src 'self' blob:` and `'wasm-unsafe-eval'` in `script-src` (not enabled by default). Meshopt compression is not wired up.

## Audio

Formats: `.ogg`/`.mp3`, mono or stereo, normalised, ≤ 2 s for effects. Set `volume` (0–1) per asset.

- **Sound effects** (`manifest.sfx`): `ui`, `nav`, `open`, `close`, `select`, `confirm`, `love`, `pop`, `guitar`, `glass`, `rose`, `zoom`, `rotate`, `snap`, `toggle`, `stage`.
  Until a sample is provided each plays its synthesised version.
- **Mood loops** (`manifest.music.ambient`): `rain` (I miss you), `gentle` (be gentle), `sleep` (bedtime), `reunion` (about to be in your arms), `cuddly`.
  Seamless loops, 1–4 min. Exactly one plays at a time with a cross-fade; mood loops replace the room song (the original behaviour).
  The originals referenced files named `soft-rain-honeybee-loop.mp3`, `be-gentle-with-me-loop.mp3`, `going-to-sleep-loop.mp3`,
  `about-to-be-in-your-arms-loop.mp3`, `feeling-cuddly-loop.mp3`; they were not part of the supplied sources.
- **Music**: songs are user content uploaded in the app (Listening Together), stored privately. Nothing licensed is bundled.

## Images and textures

`manifest.images.logo` (public; alt text required) replaces the ♥ on the sign-in screen. `manifest.textures.<nodeName>` sets the colour map
of the mesh with that name (`colorSpace: 'srgb'` for colour, `'linear'` for data).

## Verifying a new asset

1. `npm run dev`, open `/#/scene-preview` (no backend needed): every object should light up when tapped, weather/lighting should look right.
2. The browser console lists anything missing or failing (`[scene] …`, `[manifest] …`). A GLB that fails to load degrades to placeholders.
3. `npm test` re-checks the registry/manifest contracts.
