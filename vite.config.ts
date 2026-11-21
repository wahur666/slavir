import {defineConfig} from "vite";
import {resolve} from "node:path";

export default defineConfig(({mode}) => ({
    root: "src",
    // The repo's public/ folder is the build output, not a static-asset folder.
    publicDir: false,
    base: "./",
    define: {
        CANVAS_RENDERER: JSON.stringify(true),
        WEBGL_RENDERER: JSON.stringify(true),
    },
    server: {
        port: 8081,
    },
    build: {
        outDir: resolve(__dirname, "public"),
        emptyOutDir: true,
        // Keep every asset as a separate file, like webpack's asset/resource.
        assetsInlineLimit: 0,
        sourcemap: mode !== "production",
        minify: mode === "production",
        chunkSizeWarningLimit: 2000,
        rollupOptions: {
            input: {
                main: resolve(__dirname, "src/index.html"),
                // Unit testing sandbox, served at /sandbox/
                sandbox: resolve(__dirname, "src/sandbox/index.html"),
            },
        },
    },
}));
