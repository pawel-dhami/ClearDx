import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  // ml/ holds the Python training pipeline (and its virtualenv), not app code.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "ml/**"]),
]);
