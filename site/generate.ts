import fs from "node:fs";
import path from "node:path";
import type {Plugin} from "vite";
import {renderDocs} from "./docs.js";
import {loadGameData} from "./gameData.js";
import {renderWiki} from "./wiki.js";

/**
 * Static site generator for the docs and the unit wiki.
 *
 * - src/docs/: one page per Markdown file (README, roadmap, docs/*.md)
 * - src/wiki/: one page per unit, from the live unit stats in src/entities
 *
 * Both folders are generated (and git ignored); vite.config.ts runs this before every dev server start and build, and
 * adds the pages as build entries so Vite bundles their styles, script and images like any other page.
 */

/** Generated folders, relative to src/ */
const OUTPUT = ["docs", "wiki"];

/** Writes `pages` into `dir`, removes pages no longer generated, and leaves unchanged files alone */
function writePages(dir: string, pages: Map<string, string>): boolean {
    fs.mkdirSync(dir, {recursive: true});
    let changed = false;
    for (const name of fs.readdirSync(dir)) {
        if (name.endsWith(".html") && !pages.has(name)) {
            fs.rmSync(path.join(dir, name));
            changed = true;
        }
    }
    for (const [name, html] of pages) {
        const file = path.join(dir, name);
        if (fs.existsSync(file) && fs.readFileSync(file, "utf8") === html) continue;
        fs.writeFileSync(file, html);
        changed = true;
    }
    return changed;
}

/**
 * Generates every page.
 * @returns whether any file changed
 */
export async function generateSite(repoRoot: string): Promise<boolean> {
    const src = path.join(repoRoot, "src");
    const docsChanged = writePages(path.join(src, "docs"), renderDocs(repoRoot));
    const wikiChanged = writePages(path.join(src, "wiki"), renderWiki(await loadGameData(repoRoot)));
    return docsChanged || wikiChanged;
}

/** Build entries for every generated page, keyed like the other entries in vite.config.ts */
export function siteEntries(repoRoot: string): Record<string, string> {
    const entries: Record<string, string> = {};
    for (const folder of OUTPUT) {
        const dir = path.join(repoRoot, "src", folder);
        if (!fs.existsSync(dir)) continue;
        for (const name of fs.readdirSync(dir).filter(file => file.endsWith(".html"))) {
            entries[`${folder}/${path.basename(name, ".html")}`] = path.join(dir, name);
        }
    }
    return entries;
}

/** Dev server: regenerates the pages when a doc or a unit's source changes, then reloads the browser */
export function sitePlugin(repoRoot: string): Plugin {
    const watched = (file: string) => {
        const relative = path.relative(repoRoot, file).replace(/\\/g, "/");
        if (OUTPUT.some(folder => relative.startsWith(`src/${folder}/`))) return false;
        return /^(docs\/.*|README|roadmap)\.md$/.test(relative) || relative.startsWith("src/entities/") || relative.startsWith("site/");
    };
    return {
        name: "slavir-site",
        apply: "serve",
        configureServer(server) {
            server.watcher.add([path.join(repoRoot, "docs"), path.join(repoRoot, "README.md"), path.join(repoRoot, "roadmap.md")]);
            let running: Promise<void> | undefined;
            const regenerate = (file: string) => {
                if (!watched(file) || running) return;
                running = generateSite(repoRoot)
                    .then(changed => {
                        if (changed) server.ws.send({type: "full-reload"});
                    })
                    .catch(error => server.config.logger.error(`[site] ${error.stack ?? error}`))
                    .finally(() => {
                        running = undefined;
                    });
            };
            server.watcher.on("change", regenerate);
            server.watcher.on("add", regenerate);
            server.watcher.on("unlink", regenerate);
        },
    };
}
