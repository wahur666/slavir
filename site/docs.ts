import fs from "node:fs";
import path from "node:path";
import {Marked, type Tokens} from "marked";
import {GITHUB, escapeHtml, page} from "./layout.js";

/** A Markdown file turned into src/docs/<slug>.html */
export interface DocSource {
    /** Path relative to the repo root, forward slashes */
    file: string;
    slug: string;
    title: string;
    summary: string;
}

/** Sidebar order; any other docs/*.md follows, alphabetically */
const ORDER = ["README.md", "docs/architecture.md", "docs/replays.md", "docs/networkgame.md", "docs/network-protocol.md", "roadmap.md"];

const SUMMARIES: Record<string, string> = {
    "README.md": "Running it locally, the full rules, unit cap, cooldowns and commander power numbers.",
    "docs/architecture.md": "The scene loop, the systems container, players, buildings, units and the command hub.",
    "docs/replays.md": "How a match is recorded as commands and ticks, and the determinism rules that keep it in sync.",
    "docs/networkgame.md": "Running the lobby server, adding a networked AI, and how the browser and bot fit together.",
    "docs/network-protocol.md": "Every message with an example payload, plus a checklist for writing your own bot.",
    "roadmap.md": "What's done and what's planned, eventually.",
};

/** The Markdown files the docs section is built from */
export function findDocs(repoRoot: string): DocSource[] {
    const extra = fs
        .readdirSync(path.join(repoRoot, "docs"))
        .filter(name => name.endsWith(".md"))
        .map(name => `docs/${name}`)
        .filter(file => !ORDER.includes(file))
        .sort();
    return [...ORDER, ...extra]
        .filter(file => fs.existsSync(path.join(repoRoot, file)))
        .map(file => {
            const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
            const heading = source.match(/^#\s+(.+)$/m)?.[1].trim();
            const slug = file === "README.md" ? "overview" : path.basename(file, ".md");
            const title = file === "README.md" ? "Overview" : (heading ?? slug);
            const firstParagraph = source
                .split(/\r?\n\r?\n/)
                .find(block => block.trim() && !/^[#<`|-]/.test(block.trim()))
                ?.replace(/\s+/g, " ")
                .trim();
            return {file, slug, title, summary: SUMMARIES[file] ?? firstParagraph ?? ""};
        });
}

/** GitHub's heading anchors, so links like `#client--server-messages` keep working */
function slugger() {
    const seen = new Map<string, number>();
    return (text: string) => {
        const base = text
            .toLowerCase()
            .trim()
            .replace(/[^\p{L}\p{N}\s_-]/gu, "")
            .replace(/\s/g, "-");
        const count = seen.get(base) ?? 0;
        seen.set(base, count + 1);
        return count ? `${base}-${count}` : base;
    };
}

const decode = (html: string) =>
    html
        .replace(/<[^>]+>/g, "")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&");

const IMAGE = /\.(png|jpe?g|gif|svg|webp)$/i;

/**
 * Rewrites a link of a Markdown file: other docs become their generated page, images under src/ stay local (Vite
 * bundles them), any other repo file opens on GitHub.
 */
function rewriteHref(repoRoot: string, href: string, doc: DocSource, docs: DocSource[]): string {
    if (/^[a-z]+:/i.test(href) || href.startsWith("#") || href.startsWith("//")) return href;
    const [target, hash] = href.split("#");
    const resolved = path.posix.normalize(path.posix.join(path.posix.dirname(doc.file), target));
    const linked = docs.find(other => other.file === resolved);
    if (linked) return `${linked.slug}.html${hash ? `#${hash}` : ""}`;
    if (resolved.startsWith("src/") && IMAGE.test(resolved)) return `../${resolved.slice(4)}`;
    const onDisk = path.join(repoRoot, resolved);
    const kind = fs.existsSync(onDisk) && fs.statSync(onDisk).isDirectory() ? "tree" : "blob";
    return `${GITHUB}/${kind}/main/${resolved}${hash ? `#${hash}` : ""}`;
}

/** One doc page: rendered Markdown, a sidebar with every doc and this page's sections */
function renderDoc(repoRoot: string, doc: DocSource, docs: DocSource[]): string {
    const source = fs.readFileSync(path.join(repoRoot, doc.file), "utf8");
    const slug = slugger();
    const toc: {depth: number; id: string; text: string}[] = [];
    const marked = new Marked({
        gfm: true,
        renderer: {
            heading({tokens, depth}: Tokens.Heading) {
                const inner = this.parser.parseInline(tokens);
                const text = decode(inner);
                const id = slug(text);
                if (depth === 2 || depth === 3) toc.push({depth, id, text});
                return `<h${depth} id="${id}"><a class="anchor" href="#${id}" aria-hidden="true">#</a>${inner}</h${depth}>\n`;
            },
            code({text, lang}: Tokens.Code) {
                // Mermaid diagrams are drawn in the browser by site.ts
                if (lang === "mermaid") return `<pre class="mermaid">${escapeHtml(text)}</pre>\n`;
                const language = lang ? ` class="language-${escapeHtml(lang)}"` : "";
                return `<pre><code${language}>${escapeHtml(text)}</code></pre>\n`;
            },
            link({href, title, tokens}: Tokens.Link) {
                const target = rewriteHref(repoRoot, href, doc, docs);
                const external = /^https?:/.test(target) ? ' rel="noopener"' : "";
                const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
                return `<a href="${escapeHtml(target)}"${titleAttr}${external}>${this.parser.parseInline(tokens)}</a>`;
            },
            image({href, title, text}: Tokens.Image) {
                const titleAttr = title ? ` title="${escapeHtml(title)}"` : "";
                return `<img src="${escapeHtml(rewriteHref(repoRoot, href, doc, docs))}" alt="${escapeHtml(text)}"${titleAttr}>`;
            },
            html({text}: Tokens.HTML | Tokens.Tag) {
                // Raw <img> tags (the README logo) need the same path rewrite as Markdown images
                return text.replace(/(<img\b[^>]*\bsrc=")([^"]+)"/gi, (_, start, src) => `${start}${rewriteHref(repoRoot, src, doc, docs)}"`);
            },
        },
    });
    const content = marked.parse(source, {async: false});
    const nav = docs
        .map(other => `<li><a href="${other.slug}.html"${other === doc ? ' aria-current="page"' : ""}>${escapeHtml(other.title)}</a></li>`)
        .join("\n");
    const sections = toc.length
        ? `<h4>On this page</h4><ul class="toc">${toc
              .map(entry => `<li class="toc-${entry.depth}"><a href="#${entry.id}">${escapeHtml(entry.text)}</a></li>`)
              .join("\n")}</ul>`
        : "";
    const edit = `<p class="doc-source"><a href="${GITHUB}/blob/main/${doc.file}" rel="noopener">View ${escapeHtml(doc.file)} on GitHub</a></p>`;
    return page({
        title: doc.title,
        description: doc.summary,
        section: "docs",
        sidebar: `<h4>Documentation</h4><ul class="doc-nav">${nav}<li><a href="../wiki/">Unit wiki</a></li></ul>${sections}`,
        body: `<article class="prose">${content}</article>${edit}`,
    });
}

function renderIndex(docs: DocSource[]): string {
    const cards = docs
        .map(
            doc => `<a class="doc" href="${doc.slug}.html">
                <h3>${escapeHtml(doc.title)}</h3>
                <p>${escapeHtml(doc.summary)}</p>
            </a>`
        )
        .join("\n");
    return page({
        title: "Documentation",
        description: "Slavir documentation: rules, architecture, replays and the network protocol.",
        section: "docs",
        body: `<h1>Documentation</h1>
<p class="section-intro">For players who want the details and developers who want to build on it. Every page is
generated from the Markdown in the repository.</p>
<div class="docs">${cards}
    <a class="doc" href="../wiki/"><h3>Unit wiki</h3><p>Every unit's stats and matchups, generated from the game's live unit data.</p></a>
</div>`,
    });
}

/** Every generated docs page, by file name inside src/docs/ */
export function renderDocs(repoRoot: string): Map<string, string> {
    const docs = findDocs(repoRoot);
    const pages = new Map<string, string>([["index.html", renderIndex(docs)]]);
    for (const doc of docs) pages.set(`${doc.slug}.html`, renderDoc(repoRoot, doc, docs));
    return pages;
}
