/**
 * Loads the body mesh produced by scripts/build-body-model.mjs
 * (public/models/body.json + body.bin). Model space: height 1, y = 0 at the top
 * of the head, body's left is +x, +z toward the viewer.
 */
export interface BodyMesh {
  /** xyz per vertex, model space */
  positions: Float32Array;
  /** 9 slot weights per vertex (0–255): head, neck, chest, abdomen, pelvis, armL, armR, legL, legR */
  weights: Uint8Array;
  /** picker region index per vertex (see REGION_INDEX) */
  regions: Uint8Array;
  triangles: Uint16Array;
  /** quad edges as index pairs: the wireframe */
  edges: Uint16Array;
}

interface Meta {
  offsets: Record<keyof BodyMesh, { offset: number; length: number }>;
}

let pending: Promise<BodyMesh> | null = null;

export function loadBodyMesh(): Promise<BodyMesh> {
  pending ??= (async () => {
    const [meta, bin] = await Promise.all([
      fetch("/models/body.json").then((r) => {
        if (!r.ok) throw new Error(`body.json ${r.status}`);
        return r.json() as Promise<Meta>;
      }),
      fetch("/models/body.bin").then((r) => {
        if (!r.ok) throw new Error(`body.bin ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);
    const o = meta.offsets;
    return {
      positions: new Float32Array(bin, o.positions.offset, o.positions.length),
      weights: new Uint8Array(bin, o.weights.offset, o.weights.length),
      regions: new Uint8Array(bin, o.regions.offset, o.regions.length),
      triangles: new Uint16Array(bin, o.triangles.offset, o.triangles.length),
      edges: new Uint16Array(bin, o.edges.offset, o.edges.length),
    };
  })();
  pending.catch(() => (pending = null)); // allow a retry after a failed load
  return pending;
}
