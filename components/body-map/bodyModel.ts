import type { SpatialRegion } from "./types";

/**
 * Shared body coordinates. The body itself is a scanned mesh converted by
 * scripts/build-body-model.mjs (3D: public/models/body.*, 2D outline:
 * ./generated/body2d.json).
 *
 * Model space: x ∈ [-0.35, 0.35] (the body's left is +x, facing the viewer),
 * y ∈ [0, 1] from the top of the head to the soles, z = depth (+ toward the viewer).
 */
export type Vec3 = [number, number, number];

/** Surface areas that can glow independently (sided limbs so "left knee" lights only the left leg). */
export const SURFACE_SLOTS = ["head", "neck", "chest", "abdomen", "pelvis", "armL", "armR", "legL", "legR"] as const;
export type SurfaceSlot = (typeof SURFACE_SLOTS)[number];

/** Picker region per index stored in the mesh (body.bin "regions"). */
export const REGION_INDEX: SpatialRegion[] = ["head", "throat", "chest", "abdomen", "pelvis", "limbs"];
