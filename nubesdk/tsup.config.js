import { defineConfig } from "tsup";

// URL pública do backend (Railway) que serve os endpoints /storefront/* e
// /widget/*. Injetada no bundle em build-time via esbuild `define`.
// Override: NUBE_API_BASE=... npm run build
const API_BASE = process.env.NUBE_API_BASE || "https://api.fixyou.nuvempro.com";

// Mesmo setup do storefront-nube do Alugue Mais: JSX nativo (nube-sdk-jsx),
// bundle único ESM minificado. Saída: dist/main.min.js → backend/public/nubesdk.min.js
// (servido em /widget/app.js e registrado no Portal de Parceiros).
export default defineConfig({
  entry: ["src/main.tsx"],
  format: ["esm"],
  target: "esnext",
  clean: true,
  minify: true,
  bundle: true,
  sourcemap: false,
  splitting: false,
  skipNodeModulesBundle: false,
  define: {
    NUBE_API_BASE: JSON.stringify(API_BASE),
  },
  esbuildOptions(options) {
    options.alias = {
      "@tiendanube/nube-sdk-jsx/dist/jsx-runtime":
        "@tiendanube/nube-sdk-jsx/jsx-runtime",
    };
  },
  outExtension: ({ options }) => ({ js: options.minify ? ".min.js" : ".js" }),
});
