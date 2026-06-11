import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Local agent worktrees are nested in-repo and are not committed; never lint them.
    ".claude/**",
  ]),
  {
    // Ratchet: these newer react-hooks rules flag pre-existing patterns
    // (localStorage hydration / load-on-mount effects, and Date.now() in
    // Server Components — a false positive for RSC). Surfaced as warnings so
    // they stay visible without blocking CI; tracked for a dedicated refactor.
    rules: {
      "react-hooks/purity": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
