/**
 * Script of the generated docs and wiki pages (see site/generate.ts): draws Mermaid diagrams and makes tables with the
 * "sortable" class sortable by clicking a column header.
 */

async function drawDiagrams() {
    const diagrams = document.querySelectorAll<HTMLElement>("pre.mermaid");
    if (!diagrams.length) return;
    // Mermaid is large, only pages with a diagram load it
    const {default: mermaid} = await import("mermaid");
    mermaid.initialize({
        startOnLoad: false,
        theme: "base",
        themeVariables: {
            darkMode: true,
            background: "#2b1d14",
            primaryColor: "#4a3222",
            primaryTextColor: "#f3e3c3",
            primaryBorderColor: "#a07a4b",
            secondaryColor: "#3a281b",
            tertiaryColor: "#241810",
            lineColor: "#c9ae86",
            textColor: "#f3e3c3",
            clusterBkg: "#241810",
            clusterBorder: "#a07a4b",
            edgeLabelBackground: "#2b1d14",
            fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
        },
    });
    await mermaid.run({nodes: [...diagrams]});
}

/** Number value of a cell when it reads as a number ("12.5 s", "1210"), otherwise its text */
function cellValue(cell: Element | undefined): number | string {
    const text = cell?.textContent?.trim() ?? "";
    const number = Number.parseFloat(text);
    return Number.isNaN(number) ? text.toLowerCase() : number;
}

function makeSortable(table: HTMLTableElement) {
    const body = table.tBodies[0];
    table.querySelectorAll("thead th").forEach((header, column) => {
        header.setAttribute("role", "button");
        header.setAttribute("tabindex", "0");
        const sort = () => {
            const ascending = header.getAttribute("aria-sort") !== "ascending";
            table.querySelectorAll("thead th").forEach(other => other.removeAttribute("aria-sort"));
            header.setAttribute("aria-sort", ascending ? "ascending" : "descending");
            const rows = [...body.rows].sort((a, b) => {
                const x = cellValue(a.cells[column]);
                const y = cellValue(b.cells[column]);
                // Text ("Can't", "—") always sorts after numbers
                if (typeof x !== typeof y) return typeof x === "number" ? -1 : 1;
                const order = x < y ? -1 : x > y ? 1 : 0;
                return ascending ? order : -order;
            });
            body.append(...rows);
        };
        header.addEventListener("click", sort);
        header.addEventListener("keydown", event => {
            if ((event as KeyboardEvent).key === "Enter" || (event as KeyboardEvent).key === " ") {
                event.preventDefault();
                sort();
            }
        });
    });
}

document.querySelectorAll<HTMLTableElement>("table.sortable").forEach(makeSortable);
drawDiagrams().catch(error => console.error("Could not draw the diagrams", error));
