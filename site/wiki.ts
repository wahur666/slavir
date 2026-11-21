import type {UnitStat} from "../src/entities/UnitsStats.js";
import type {GameData} from "./gameData.js";
import {GITHUB, escapeHtml, page} from "./layout.js";

/** Sprite sheet rows, see Unit.generateAnimations */
const ANIMATIONS = [
    {name: "Idle", row: 0, fps: 5},
    {name: "Walk", row: 1, fps: 5},
    {name: "Attack", row: 2, fps: 8},
    {name: "Death", row: 3, fps: 6},
];

const TYPE_LABEL: Record<UnitStat["type"], string> = {
    infantry: "Infantry",
    vehicle: "Vehicle",
    aircraft: "Aircraft",
    structure: "Structure",
};

/** Where each kind of damage applies, in the order of the damage table */
const TARGET_CLASSES: {label: string; type: UnitStat["type"]}[] = [
    {label: "Infantry", type: "infantry"},
    {label: "Vehicle", type: "vehicle"},
    {label: "Aircraft", type: "aircraft"},
    {label: "Structure / base", type: "structure"},
];

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const fmt = (value: number, digits = 1) => (Number.isInteger(value) ? String(value) : value.toFixed(digits));
const seconds = (value: number) => `${fmt(value, 2)} s`;

/** Page file name of a unit */
export const unitSlug = (stat: UnitStat) =>
    stat.reference
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

/** A unit's display name: the reference unit its numbers were tuned after */
export const unitName = (stat: UnitStat) => stat.reference;

function isHarvester(stat: UnitStat) {
    return stat.reference === "Harvester";
}

/** Can `attacker` shoot `target` at all */
function canHit(attacker: UnitStat, target: UnitStat): boolean {
    if (!attacker.canAttack) return false;
    if (target.flying && !attacker.canAttackAir) return false;
    return true;
}

/** Weapon numbers for one target class, at full squad strength */
function weapon(data: GameData, attacker: UnitStat, target: Pick<UnitStat, "type">) {
    const volley = data.squadVolleyStat(attacker);
    const rotating = attacker.squadFire === "rotating" && attacker.squadSize > 1;
    const membersPerShot = rotating ? 1 : attacker.squadSize;
    const perMember = data.damagePerMember(attacker, target);
    const perShot = perMember * membersPerShot;
    // The magazine refills `reload` seconds after it is no longer full, but never faster than it can be emptied
    const cycle = Math.max(volley.reload, volley.shots * volley.shotInterval);
    const dps = attacker.canAttack && cycle > 0 ? (perShot * volley.shots) / cycle : 0;
    return {volley, perMember, perShot, dps};
}

/** Seconds for `attacker` at full strength to destroy a full-health `target`, ignoring losses on either side */
function timeToKill(data: GameData, attacker: UnitStat, target: UnitStat): number | undefined {
    if (!canHit(attacker, target)) return undefined;
    const {dps, volley} = weapon(data, attacker, target);
    if (dps <= 0) return undefined;
    return volley.initialChargeUp + (target.health * target.squadSize) / dps;
}

function textureOf(data: GameData, stat: UnitStat) {
    const texture = data.textures.get(stat.texture);
    return texture?.frameWidth ? texture : undefined;
}

/** An animated sprite sheet row, clipped to one frame */
function sprite(data: GameData, stat: UnitStat, row = 0, fps = 5, size = 128): string {
    const texture = textureOf(data, stat);
    if (!texture) return `<div class="sprite sprite-empty" style="--size: ${size}px" aria-hidden="true"></div>`;
    const scale = size / texture.frameWidth!;
    return `<div class="sprite" style="--size: ${size}px; --row: ${row}; --fps: ${fps}; --scale: ${scale}" aria-hidden="true">
        <img src="../${texture.url}" alt="" loading="lazy">
    </div>`;
}

function buildingLabel(data: GameData, stat: UnitStat): string {
    if (stat.type === "structure") return "Commander power";
    const building = data.buildings.get(stat.building);
    const name = stat.building === "castle" ? "Castle" : capitalize(stat.building);
    return building?.cost ? `${name} (${building.cost} to unlock)` : name;
}

function strengths(stat: UnitStat): string[] {
    const tags: string[] = [];
    if (stat.goodAgainstInfantry) tags.push("Good against infantry");
    if (stat.goodAgainstFactory) tags.push("Good against vehicles");
    if (stat.goodAgainstAir) tags.push("Good against aircraft");
    if (stat.flying) tags.push("Flying");
    if (stat.fireOnMove) tags.push("Fires on the move");
    if (stat.canAttack && !stat.canAttackAir) tags.push("Cannot hit aircraft");
    if (!stat.canAttack) tags.push("Unarmed");
    return tags;
}

function row(label: string, value: string) {
    return `<tr><th scope="row">${label}</th><td>${value}</td></tr>`;
}

function renderUnit(data: GameData, stat: UnitStat, index: number): string {
    const units = data.units;
    const prev = units[(index - 1 + units.length) % units.length];
    const next = units[(index + 1) % units.length];
    const squadHealth = stat.health * stat.squadSize;
    const firstWeapon = weapon(data, stat, {type: "vehicle"});
    const volley = firstWeapon.volley;

    const overview = [
        row("Type", TYPE_LABEL[stat.type] + (stat.flying ? ", flying" : "")),
        row("Built from", buildingLabel(data, stat)),
        row("Cost", String(stat.cost)),
        row("Health", stat.squadSize > 1 ? `${squadHealth} <span class="muted">(${stat.squadSize} × ${stat.health})</span>` : String(squadHealth)),
        row("Squad size", String(stat.squadSize)),
        row("Speed", stat.speed ? `${stat.speed} <span class="muted">px/s</span>` : "Does not move"),
        row("Attack range", stat.canAttack ? `${stat.attackRange} hex${stat.attackRange > 1 ? "es" : ""}` : "—"),
        row("Vision", `${stat.visionRadius} hex${stat.visionRadius > 1 ? "es" : ""}`),
        stat.limit > 0 ? row("Limit", `${stat.limit} at a time`) : "",
        stat.type === "structure" ? row("Deploy time", seconds(data.turret.deployTime)) : "",
        stat.type === "structure" ? row("Lifespan", seconds(data.turret.lifespan)) : "",
    ].join("");

    const weaponRows = stat.canAttack
        ? [
              row("Magazine", `${volley.shots} shot${volley.shots > 1 ? "s" : ""}`),
              row("Wind-up", seconds(volley.initialChargeUp)),
              volley.shots > 1 ? row("Between shots", seconds(volley.shotInterval)) : "",
              row("Reload", seconds(volley.reload)),
              stat.squadSize > 1
                  ? row("Squad fire", stat.squadFire === "rotating" ? "Rotating: members take turns" : "Volley: every member fires at once")
                  : "",
          ].join("")
        : "";

    const damageRows = TARGET_CLASSES.map(target => {
        const result = weapon(data, stat, target);
        const blocked = !stat.canAttack || (target.type === "aircraft" && !stat.canAttackAir);
        return `<tr><th scope="row">${target.label}</th>
            <td>${blocked ? "—" : fmt(result.perMember)}</td>
            <td>${blocked ? "—" : fmt(result.perShot)}</td>
            <td>${blocked ? "—" : fmt(result.dps)}</td></tr>`;
    }).join("");

    const matchups = units
        .filter(other => other !== stat)
        .map(other => {
            const ours = timeToKill(data, stat, other);
            const theirs = timeToKill(data, other, stat);
            let verdict = "Even";
            let tone = "even";
            if (ours === undefined && theirs === undefined) {
                verdict = "No fight";
                tone = "none";
            } else if (theirs === undefined || (ours !== undefined && ours < theirs * 0.8)) {
                verdict = "Favoured";
                tone = "good";
            } else if (ours === undefined || theirs < ours * 0.8) {
                verdict = "Unfavoured";
                tone = "bad";
            }
            return `<tr>
                <td><a class="unit-link" href="${unitSlug(other)}.html">${sprite(data, other, 0, 5, 40)}<span>${escapeHtml(unitName(other))}</span></a></td>
                <td>${other.cost}</td>
                <td>${ours === undefined ? "Can't" : seconds(ours)}</td>
                <td>${theirs === undefined ? "Can't" : seconds(theirs)}</td>
                <td><span class="verdict verdict-${tone}">${verdict}</span></td>
            </tr>`;
        })
        .join("");

    const animations = textureOf(data, stat)
        ? `<section><h2>Animations</h2><div class="animations">${ANIMATIONS.map(
              anim => `<figure>${sprite(data, stat, anim.row, anim.fps, 96)}<figcaption>${anim.name}</figcaption></figure>`
          ).join("")}</div></section>`
        : "";

    const tags = strengths(stat)
        .map(tag => `<span class="tag">${tag}</span>`)
        .join("");
    const source = stat.type === "structure" ? "Turret" : stat.className?.name;

    const body = `<nav class="crumbs"><a href="./">Units</a> / ${escapeHtml(unitName(stat))}</nav>
<header class="unit-hero">
    ${sprite(data, stat, 0, 5, 160)}
    <div>
        <p class="eyebrow">${TYPE_LABEL[stat.type]} · ${escapeHtml(buildingLabel(data, stat))}</p>
        <h1>${escapeHtml(unitName(stat))}</h1>
        <div class="tags">${tags}</div>
        <p class="muted">Texture <code>${escapeHtml(stat.texture)}</code>${
            source ? ` · class <a href="${GITHUB}/blob/main/src/entities/units/${source}.ts" rel="noopener"><code>${source}</code></a>` : ""
        }</p>
    </div>
</header>
<div class="unit-grid">
    <section><h2>Overview</h2><table class="stats">${overview}</table></section>
    ${stat.canAttack ? `<section><h2>Weapon</h2><table class="stats">${weaponRows}</table></section>` : ""}
</div>
${
    stat.canAttack
        ? `<section><h2>Damage</h2>
<table class="data">
    <thead><tr><th>Against</th><th>Per member</th><th>Per shot</th><th>DPS</th></tr></thead>
    <tbody>${damageRows}</tbody>
</table>
<p class="note">DPS is sustained damage at full squad strength, after the wind-up. "Per shot" counts every member that fires.</p>
</section>`
        : `<section><h2>Damage</h2><p class="muted">${isHarvester(stat) ? "Harvesters gather resources and never attack." : "This unit does not attack."}</p></section>`
}
<section><h2>Matchups</h2>
<div class="table-scroll"><table class="data sortable">
    <thead><tr><th>Opponent</th><th>Cost</th><th>${escapeHtml(unitName(stat))} kills it in</th><th>It kills ${escapeHtml(unitName(stat))} in</th><th>Verdict</th></tr></thead>
    <tbody>${matchups}</tbody>
</table></div>
<p class="note">One full-health squad against another, standing in range, ignoring members lost along the way, terrain and
retargeting. "Favoured" means at least 20% faster. A rough guide, not a simulation.</p>
</section>
${animations}
<nav class="pager">
    <a href="${unitSlug(prev)}.html">← ${escapeHtml(unitName(prev))}</a>
    <a href="${unitSlug(next)}.html">${escapeHtml(unitName(next))} →</a>
</nav>`;

    return page({
        title: unitName(stat),
        description: `${unitName(stat)}: ${TYPE_LABEL[stat.type].toLowerCase()} unit in Slavir. Stats, damage and matchups.`,
        section: "wiki",
        sidebar: unitSidebar(data, stat),
        body,
    });
}

function unitSidebar(data: GameData, current?: UnitStat): string {
    const links = data.units
        .map(
            stat =>
                `<li><a class="unit-link" href="${unitSlug(stat)}.html"${stat === current ? ' aria-current="page"' : ""}>${sprite(data, stat, 0, 5, 32)}<span>${escapeHtml(unitName(stat))}</span></a></li>`
        )
        .join("");
    return `<h4>Units</h4><ul class="unit-nav">${links}</ul>`;
}

function renderIndex(data: GameData): string {
    const groups = new Map<string, UnitStat[]>();
    for (const stat of data.units) {
        const key = buildingLabel(data, stat);
        groups.set(key, [...(groups.get(key) ?? []), stat]);
    }
    const sections = [...groups]
        .map(
            ([label, stats]) =>
                `<section><h2>${escapeHtml(label)}</h2><div class="unit-cards">${stats
                    .map(
                        stat => `<a class="unit-card" href="${unitSlug(stat)}.html">
                    ${sprite(data, stat, 0, 5, 96)}
                    <h3>${escapeHtml(unitName(stat))}</h3>
                    <p>${TYPE_LABEL[stat.type]}${stat.squadSize > 1 ? ` · squad of ${stat.squadSize}` : ""}</p>
                    <p class="cost">${stat.cost}</p>
                </a>`
                    )
                    .join("")}</div></section>`
        )
        .join("");

    const compare = data.units
        .map(stat => {
            const best = stat.canAttack ? Math.max(...TARGET_CLASSES.map(target => weapon(data, stat, target).dps)) : 0;
            return `<tr>
                <td><a class="unit-link" href="${unitSlug(stat)}.html">${sprite(data, stat, 0, 5, 32)}<span>${escapeHtml(unitName(stat))}</span></a></td>
                <td>${TYPE_LABEL[stat.type]}</td>
                <td>${stat.cost}</td>
                <td>${stat.health * stat.squadSize}</td>
                <td>${stat.speed}</td>
                <td>${stat.canAttack ? stat.attackRange : "—"}</td>
                <td>${stat.visionRadius}</td>
                ${TARGET_CLASSES.map(target => {
                    const blocked = !stat.canAttack || (target.type === "aircraft" && !stat.canAttackAir);
                    const dps = weapon(data, stat, target).dps;
                    return `<td${!blocked && dps === best && best > 0 ? ' class="best"' : ""}>${blocked ? "—" : fmt(dps)}</td>`;
                }).join("")}
            </tr>`;
        })
        .join("");

    return page({
        title: "Unit wiki",
        description: "Every Slavir unit with stats, damage and matchups, generated from the game's own unit data.",
        section: "wiki",
        body: `<h1>Unit wiki</h1>
<p class="section-intro">Every unit in the game, generated at build time from the game's own unit classes, so the
numbers always match what you play.</p>
${sections}
<section><h2>Compare</h2>
<div class="table-scroll"><table class="data sortable compare">
    <thead><tr><th>Unit</th><th>Type</th><th>Cost</th><th>Health</th><th>Speed</th><th>Range</th><th>Vision</th>
        <th>DPS vs infantry</th><th>DPS vs vehicle</th><th>DPS vs air</th><th>DPS vs structure</th></tr></thead>
    <tbody>${compare}</tbody>
</table></div>
<p class="note">Click a column to sort. Health is the whole squad. DPS is sustained, at full strength.</p>
</section>`,
    });
}

/** Every generated wiki page, by file name inside src/wiki/ */
export function renderWiki(data: GameData): Map<string, string> {
    const pages = new Map<string, string>([["index.html", renderIndex(data)]]);
    data.units.forEach((stat, index) => {
        pages.set(`${unitSlug(stat)}.html`, renderUnit(data, stat, index));
    });
    return pages;
}
