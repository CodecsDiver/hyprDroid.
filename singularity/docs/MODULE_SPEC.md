# Map module specification

LAB-00 is assembled from interchangeable modules so Blender assets can replace the placeholder primitives without touching
gameplay code.

## Grid

- One grid cell is `cell_size` metres (4 m for LAB-00). Modules occupy exactly one cell.
- Origin: the centre of the cell, on the floor surface (y = 0). Forward is -Z, up is +Y.
- The floor top is y = 0. Floor modules extend below it so tiles read as slabs.

## Collision and navigation

- Solid modules need collision on physics layer 1 ("world"). Actors collide with layer 1 only.
- Navigation is derived from the layout, not from the meshes: any symbol listed in the layout's `blocking_symbols`
  (LAB-00: `#` wall, `P` pillar, `C` crate cluster) leaves a hole of one full cell in the navigation mesh. If you add a solid
  module, add its symbol to `blocking_symbols` or enemies will path into it.
- Visibility: walls are 1.4 m so the isometric camera can see over them. Tall props should stay near the arena edge.

## Special scripts on module roots

- `HazardZone` (`scripts/core/hazard_zone.gd`): exported shape, radius or half extents, damage per second, slow, and an optional
  active/inactive cycle with warning phase. It builds its own flat visual; a Blender asset can sit beside it as a child.
- `ItemChest` (`scripts/core/item_chest.gd`): interactable, builds placeholder visuals only when it has no children.
- Both implement `register_with_session()`, which `MapBuilder` calls after instancing.

## Legend markers

`marker:player_start` and `marker:enemy_spawn` are not scenes; they only record cell centres. Enemy spawn markers should be
placed near the arena edge on open floor.

## Swapping to Blender assets

1. Export each module as a `.glb` or `.tscn` honouring the rules above.
2. Edit `data/modules/lab_modules.tres` so each module id points at the new scene.
3. Keep ids stable; layouts reference ids only. No code changes are needed.
