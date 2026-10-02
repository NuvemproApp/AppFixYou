import { defineConfig } from "tsup";

// Mesma config do template oficial create-nube-app (minimal-ui): ESM minificado,
// com o @tiendanube/nube-sdk-ui embutido (noExternal). Saída: dist/main.min.js —
// é esse arquivo que vai pro backend (public/nubesdk.min.js) e cuja URL é
// registrada como o script do app no Portal de Parceiros.
export default defineConfig({
  entry: ["./src/main.ts"],
  clean: true,
  format: ["esm"],
  dts: false,
  outDir: "./dist",
  minify: true,
  sourcemap: false,
  noExternal: ["@tiendanube/nube-sdk-ui"],
  outExtension: ({ options }) => ({ js: options.minify ? ".min.js" : ".js" }),
});
