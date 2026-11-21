import {defineConfig} from "vite";
import {resolve} from "node:path";
import {generateSite, siteEntries, sitePlugin} from "./site/generate.js";

/** Port of the network game's WebSocket server (npm run server), see DEFAULT_SERVER_PORT */
const wsTarget = `ws://localhost:${process.env.SLAVIR_WS_PORT || 8090}`;

export default defineConfig(async ({mode}) => {
    // The docs and unit wiki pages are generated into src/docs/ and src/wiki/ first, see site/generate.ts
    await generateSite(__dirname);
    return {
        root: "src",
        // The repo's public/ folder is the build output, not a static-asset folder.
        publicDir: false,
        base: "./",
        define: {
            CANVAS_RENDERER: JSON.stringify(true),
            WEBGL_RENDERER: JSON.stringify(true),
        },
        // Regenerates the docs and wiki pages on the dev server when their sources change
        plugins: [sitePlugin(__dirname)],
        // JSX (only the network game lobby) is Preact's
        oxc: {
            jsx: {runtime: "automatic", importSource: "preact"},
        },
        server: {
            port: 8081,
            // The network game lobby connects to the WebSocket server (npm run server) through the page's own origin
            proxy: {"/ws": {target: wsTarget, ws: true}},
        },
        preview: {
            proxy: {"/ws": {target: wsTarget, ws: true}},
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
                    // Homepage, served at /
                    main: resolve(__dirname, "src/index.html"),
                    // The single player game, served at /play/
                    play: resolve(__dirname, "src/play/index.html"),
                    // Unit testing sandbox, served at /sandbox/
                    sandbox: resolve(__dirname, "src/sandbox/index.html"),
                    // Network game lobby, served at /networkgame/
                    networkgame: resolve(__dirname, "src/networkgame/index.html"),
                    // Generated docs and unit wiki, served at /docs/ and /wiki/
                    ...siteEntries(__dirname),
                },
            },
        },
    };
});
