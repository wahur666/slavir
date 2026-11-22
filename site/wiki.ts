import type {BuildingStat} from "../src/entities/Building.js";
import type {UnitStat} from "../src/entities/UnitsStats.js";
import type {GameData, TextureInfo} from "./gameData.js";
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
function sprite(data: GameData, stat: UnitStat, row = 0, fps = 5, size = 128, override?: TextureInfo): string {
    const texture = override ?? textureOf(data, stat);
    if (!texture) return `<div class="sprite sprite-empty" style="--size: ${size}px" aria-hidden="true"></div>`;
    const scale = size / texture.frameWidth!;
    return `<div class="sprite" style="--size: ${size}px; --row: ${row}; --fps: ${fps}; --scale: ${scale}" aria-hidden="true">
        <img src="../${texture.url}" alt="" loading="lazy">
    </div>`;
}

/** Every frame of a one-row strip in turn, or a single frame of it when `still` is given */
function strip(sheet: TextureInfo, frames: number, fps: number, size: number, still?: number): string {
    const frame = still === undefined ? "" : `; --frame: ${still}`;
    return `<div class="sprite${still === undefined ? "" : " still"}" style="--size: ${size}px; --row: 0; --frames: ${frames}; --fps: ${fps}${frame}" aria-hidden="true">
        <img src="../${sheet.url}" alt="" loading="lazy">
    </div>`;
}

/** Units recruited from cards, in card order */
const recruitable = (data: GameData) => data.units.filter(stat => stat.type !== "structure");
const turretStat = (data: GameData) => data.units.find(stat => stat.type === "structure");

const ION_SLUG = "ion-cannon";

/** A commander power in the sidebar and on the index */
interface PowerEntry {
    slug: string;
    name: string;
    icon: (size: number) => string;
}

function powerEntries(data: GameData): PowerEntry[] {
    const entries: PowerEntry[] = [];
    const turret = turretStat(data);
    if (turret) entries.push({slug: unitSlug(turret), name: unitName(turret), icon: size => sprite(data, turret, 0, 3, size)});
    const ion = data.ionStrike;
    const label = data.powers.powerStats[data.powers.PowerName.IonCannon].label;
    entries.push({
        slug: ION_SLUG,
        name: label,
        icon: size =>
            ion
                ? `<div class="sprite" style="--size: ${size}px" aria-hidden="true"><img class="power-icon" src="../${ion.icon}" alt="" width="${size}" height="${size}"></div>`
                : `<div class="sprite sprite-empty" style="--size: ${size}px" aria-hidden="true"></div>`,
    });
    return entries;
}

/** Buildings in the order of the game's Buildings enum: castle, the four card buildings, spawn */
const buildingList = (data: GameData) => [...data.buildings.values()];
const buildingName = (type: string) => capitalize(type);
/** The castle and the spawn are there from the start; the rest are bought from the building cards */
const startsBuilt = (building: BuildingStat) => building.type === "castle" || building.type === "spawn";
const unlockedBy = (data: GameData, building: BuildingStat) => recruitable(data).filter(stat => stat.building === building.type);

function buildingImage(data: GameData, building: BuildingStat, size: number): string {
    const texture = data.textures.get(building.texture);
    if (!texture) return `<div class="sprite sprite-empty" style="--size: ${size}px" aria-hidden="true"></div>`;
    return `<div class="building-image" style="--size: ${size}px" aria-hidden="true"><img src="../${texture.url}" alt="" loading="lazy"></div>`;
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
    const isPower = stat.type === "structure";
    // Units page through units, powers through powers
    const ring: {slug: string; name: string}[] = isPower
        ? powerEntries(data)
        : recruitable(data).map(other => ({slug: unitSlug(other), name: unitName(other)}));
    const at = ring.findIndex(entry => entry.slug === unitSlug(stat));
    const prev = ring[(at - 1 + ring.length) % ring.length];
    const next = ring[(at + 1) % ring.length];
    const power = isPower ? data.powers.powerStats[data.powers.PowerName.Turret] : undefined;
    const squadHealth = stat.health * stat.squadSize;
    const firstWeapon = weapon(data, stat, {type: "vehicle"});
    const volley = firstWeapon.volley;

    const overview = [
        row("Type", TYPE_LABEL[stat.type] + (stat.flying ? ", flying" : "")),
        row("Built from", isPower ? buildingLabel(data, stat) : `<a href="${stat.building}.html">${escapeHtml(buildingLabel(data, stat))}</a>`),
        row("Cost", String(power?.cost ?? stat.cost)),
        power ? row("Cooldown", seconds(power.coolDown / 1000)) : "",
        power ? row("Hotkey", `<kbd>${power.hotkey}</kbd>`) : "",
        row("Health", stat.squadSize > 1 ? `${squadHealth} <span class="muted">(${stat.squadSize} × ${stat.health})</span>` : String(squadHealth)),
        row("Squad size", String(stat.squadSize)),
        row("Speed", stat.speed ? `${stat.speed} <span class="muted">px/s</span>` : "Does not move"),
        row("Attack range", stat.canAttack ? `${stat.attackRange} hex${stat.attackRange > 1 ? "es" : ""}` : "—"),
        row("Vision", `${stat.visionRadius} hex${stat.visionRadius > 1 ? "es" : ""}`),
        stat.limit > 0 ? row("Limit", `${stat.limit} at a time`) : "",
        stat.type === "structure" ? row("Deploy time", seconds(data.turret.deployTime)) : "",
        stat.type === "structure" ? row("Lifespan", seconds(data.turret.lifespan)) : "",
        isPower
            ? row("Placement", `Visible, free, walkable hex, not a pad, at most ${data.powers.TURRET_FORWARD_LIMIT} hexes past the middle of the map`)
            : "",
        isPower ? row("Unit cap", "Does not count") : "",
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

    const generated = data.generated.get(stat.texture);
    const teams = generated
        ? `<section><h2>Team colours</h2><div class="animations">${generated.sheets
              .map(
                  (sheet, side) =>
                      `<figure>${sprite(data, stat, 0, 3, 96, sheet)}<figcaption>Player ${side + 1}</figcaption></figure>` +
                      `<figure>${sprite(data, stat, 2, 8, 96, sheet)}<figcaption>Player ${side + 1} firing</figcaption></figure>`
              )
              .join("")}${
              generated.icon
                  ? `<figure><div class="card-icon"><img src="../${generated.icon}" alt="" width="64" height="64"></div><figcaption>Card icon</figcaption></figure>`
                  : ""
          }</div>
<p class="note">The game draws this art on a canvas at startup (<a href="${GITHUB}/blob/main/src/entities/powers/PowerArt.ts" rel="noopener"><code>PowerArt.ts</code></a>);
these frames come from the same drawing code, rendered by <code>npm run sprites</code>.</p></section>`
        : "";

    const animations = textureOf(data, stat)
        ? `<section><h2>Animations</h2><div class="animations">${ANIMATIONS.map(
              anim => `<figure>${sprite(data, stat, anim.row, anim.fps, 96)}<figcaption>${anim.name}</figcaption></figure>`
          ).join("")}</div></section>`
        : "";

    const tags = strengths(stat)
        .map(tag => `<span class="tag">${tag}</span>`)
        .join("");
    const source = stat.type === "structure" ? "Turret" : stat.className?.name;

    const body = `<nav class="crumbs"><a href="./">${isPower ? "Powers" : "Units"}</a> / ${escapeHtml(unitName(stat))}</nav>
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
${teams}
${animations}
<nav class="pager">
    <a href="${prev.slug}.html">← ${escapeHtml(prev.name)}</a>
    <a href="${next.slug}.html">${escapeHtml(next.name)} →</a>
</nav>`;

    return page({
        title: unitName(stat),
        description: isPower
            ? `${unitName(stat)}: commander power in Slavir. Stats, damage and matchups.`
            : `${unitName(stat)}: ${TYPE_LABEL[stat.type].toLowerCase()} unit in Slavir. Stats, damage and matchups.`,
        section: "wiki",
        sidebar: wikiSidebar(data, unitSlug(stat)),
        body,
    });
}

function wikiSidebar(data: GameData, current?: string): string {
    const link = (slug: string, icon: string, name: string) =>
        `<li><a class="unit-link" href="${slug}.html"${slug === current ? ' aria-current="page"' : ""}>${icon}<span>${escapeHtml(name)}</span></a></li>`;
    const units = recruitable(data)
        .map(stat => link(unitSlug(stat), sprite(data, stat, 0, 5, 32), unitName(stat)))
        .join("");
    const powers = powerEntries(data)
        .map(entry => link(entry.slug, entry.icon(32), entry.name))
        .join("");
    const buildings = buildingList(data)
        .map(building => link(building.type, buildingImage(data, building, 32), buildingName(building.type)))
        .join("");
    return `<h4>Units</h4><ul class="unit-nav">${units}</ul><h4>Powers</h4><ul class="unit-nav">${powers}</ul><h4>Buildings</h4><ul class="unit-nav">${buildings}</ul>`;
}

function renderIndex(data: GameData): string {
    const groups = new Map<string, UnitStat[]>();
    for (const stat of recruitable(data)) {
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

    const {powerStats, PowerName} = data.powers;
    const powerCards = powerEntries(data)
        .map(entry => {
            const stat = powerStats[entry.slug === ION_SLUG ? PowerName.IonCannon : PowerName.Turret];
            return `<a class="unit-card" href="${entry.slug}.html">
                    ${entry.icon(96)}
                    <h3>${escapeHtml(entry.name)}</h3>
                    <p>Commander power · <kbd>${stat.hotkey}</kbd></p>
                    <p class="cost">${stat.cost}</p>
                </a>`;
        })
        .join("");

    const compare = recruitable(data)
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
        sidebar: wikiSidebar(data),
        body: `<h1>Unit wiki</h1>
<p class="section-intro">Every unit, commander power and building in the game, generated at build time from the game's own
code, so the numbers always match what you play.</p>
${sections}
<section><h2>Commander powers</h2><div class="unit-cards">${powerCards}</div></section>
<section><h2>Buildings</h2><div class="unit-cards">${buildingList(data)
            .map(
                building => `<a class="unit-card" href="${building.type}.html">
                    ${buildingImage(data, building, 96)}
                    <h3>${buildingName(building.type)}</h3>
                    <p>${startsBuilt(building) ? "Starts built" : `Unlocks ${unlockedBy(data, building).length} units`}</p>
                    ${startsBuilt(building) ? "" : `<p class="cost">${building.cost}</p>`}
                </a>`
            )
            .join("")}</div></section>
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

/** The ion cannon: a power with no unit behind it, everything comes from PowerRules */
function renderIonCannon(data: GameData): string {
    const rules = data.powers;
    const stat = rules.powerStats[rules.PowerName.IonCannon];
    const ion = data.ionStrike;
    const blast = rules.ION_CANNON_BLAST_TIME / 1000;
    const hex = rules.UNITS_PER_HEX;
    const radiusHexes = rules.ION_CANNON_RADIUS / hex;
    const fps = ion ? 1000 / ion.step : 10;
    /** Frame of the strip at a moment, in ms */
    const at = (ms: number) => (ion ? Math.min(ion.frames - 1, Math.round(ms / ion.step)) : 0);

    const overview = [
        row("Cost", String(stat.cost)),
        row("Cooldown", seconds(stat.coolDown / 1000)),
        row("Hotkey", `<kbd>${stat.hotkey}</kbd>`),
        row("Target", "Any visible hex"),
        row("Blast sequence", `${seconds(blast)} from the click to the hit`),
        row("Blast radius", `${rules.ION_CANNON_RADIUS} units <span class="muted">(${fmt(radiusHexes)} hexes, ${hex} units per hex step)</span>`),
        row("Friendly fire", "Yes: your own units, turrets and base take the same damage"),
    ].join("");

    // Damage by distance from the epicenter, for each kind of target
    const distances = [0, ...rules.ION_CANNON_FALLOFF.map(([distance]) => distance)];
    const where = (distance: number) =>
        distance === 0
            ? "Epicenter"
            : distance <= hex / 2
              ? "Edge of the target hex"
              : distance === hex
                ? "Next hex's center"
                : "Next hex's outer edge";
    const kinds: {label: string; type: "infantry" | "vehicle" | "aircraft"; harvester: boolean}[] = [
        {label: "Infantry", type: "infantry", harvester: false},
        {label: "Vehicle", type: "vehicle", harvester: false},
        {label: "Aircraft", type: "aircraft", harvester: false},
        {label: "Harvester", type: "vehicle", harvester: true},
    ];
    const damageTable = `<table class="data">
    <thead><tr><th>Against</th>${distances.map(d => `<th>${d} units<br><span class="muted">${where(d)}</span></th>`).join("")}</tr></thead>
    <tbody>${kinds
        .map(
            kind =>
                `<tr><th scope="row">${kind.label}</th>${distances.map(d => `<td>${rules.ionCannonDamage(kind.type, kind.harvester, d, 0)}</td>`).join("")}</tr>`
        )
        .join("")}
    <tr><th scope="row">Structure / base</th><td colspan="${distances.length}">${rules.ionCannonStructureDamage(0)} on a hit on one of its hexes,
        ${rules.ionCannonStructureDamage(1)} next to one, nothing further away <span class="muted">(a base is five hexes: the castle and its four building slots)</span></td></tr>
    </tbody>
</table>`;

    // The falloff curve as bars, every 3 units
    const falloff = Array.from({length: Math.floor(rules.ION_CANNON_RADIUS / 3) + 2}, (_, i) => i * 3)
        .map(distance => {
            const share = rules.ionCannonFalloff(distance);
            return `<div class="falloff-row"><span>${distance}</span><div class="falloff-bar"><div style="width: ${share * 100}%"></div></div><span>${Math.round(share * 100)}%</span></div>`;
        })
        .join("");

    // What one strike does to each unit, standing on the epicenter or a hex away
    const victims = data.units
        .map(unit => {
            const health = unit.health * unit.squadSize;
            const harvester = isHarvester(unit);
            const hit = (distance: number, hexes: number) =>
                unit.type === "structure" ? rules.ionCannonStructureDamage(hexes) : rules.ionCannonDamage(unit.type, harvester, distance, hexes);
            const cell = (damage: number) =>
                damage >= health
                    ? `<span class="verdict verdict-good">Destroyed</span>`
                    : damage > 0
                      ? `${Math.round((1 - damage / health) * 100)}% left`
                      : `<span class="muted">Untouched</span>`;
            return `<tr>
                <td><a class="unit-link" href="${unitSlug(unit)}.html">${sprite(data, unit, 0, 5, 40)}<span>${escapeHtml(unitName(unit))}</span></a></td>
                <td>${health}</td>
                <td>${cell(hit(0, 0))}</td>
                <td>${cell(hit(hex, 1))}</td>
                <td>${cell(hit(rules.ION_CANNON_RADIUS, 1))}</td>
            </tr>`;
        })
        .join("");

    const phases = [
        {label: "Lock-on", ms: 1200, text: `Targeting beams spiral in onto the hex and a ring marks the danger zone (0 to ${seconds(2.2)}).`},
        {label: "Charge", ms: 2700, text: `An orb charges on the target (${seconds(2.2)} to ${seconds(3)}).`},
        {
            label: "Beam",
            ms: 3200,
            text: `The main beam comes down (${seconds(3)} to ${seconds(blast)}). Units that leave the radius before now escape.`,
        },
        {label: "Blast", ms: rules.ION_CANNON_BLAST_TIME + 150, text: `Damage lands at ${seconds(blast)}, then a shockwave rolls out.`},
    ];
    const timeline = ion
        ? `<section><h2>Blast sequence</h2><div class="phases">${phases
              .map(
                  phase =>
                      `<figure>${strip(ion.sheet, ion.frames, fps, 150, at(phase.ms))}<figcaption><strong>${phase.label}</strong>${phase.text}</figcaption></figure>`
              )
              .join("")}</div></section>`
        : "";

    const hero = ion ? strip(ion.sheet, ion.frames, fps, 220) : `<div class="sprite sprite-empty" style="--size: 220px" aria-hidden="true"></div>`;
    const powers = powerEntries(data);
    const self = powers.findIndex(entry => entry.slug === ION_SLUG);
    const prev = powers[(self - 1 + powers.length) % powers.length];
    const next = powers[(self + 1) % powers.length];

    const body = `<nav class="crumbs"><a href="./">Powers</a> / ${escapeHtml(stat.label)}</nav>
<header class="unit-hero">
    <div class="strike-hero">${hero}</div>
    <div>
        <p class="eyebrow">Commander power · <kbd>${stat.hotkey}</kbd></p>
        <h1>${escapeHtml(stat.label)}</h1>
        <div class="tags"><span class="tag">Area damage</span><span class="tag">Hits bases</span><span class="tag">Friendly fire</span></div>
        <p class="muted">Rules in <a href="${GITHUB}/blob/main/src/model/power/PowerRules.ts" rel="noopener"><code>PowerRules.ts</code></a> ·
            art in <a href="${GITHUB}/blob/main/src/entities/powers/IonStrikeArt.ts" rel="noopener"><code>IonStrikeArt.ts</code></a></p>
    </div>
</header>
<div class="unit-grid">
    <section><h2>Overview</h2><table class="stats">${overview}</table></section>
    <section><h2>Falloff</h2><div class="falloff">${falloff}</div>
    <p class="note">Share of the damage by distance from the epicenter, in units. Full up to ${rules.ION_CANNON_FALLOFF[0][0]}, then linear between the points, nothing past ${rules.ION_CANNON_RADIUS}.</p></section>
</div>
<section><h2>Damage</h2>
<div class="table-scroll">${damageTable}</div>
<p class="note">Distances are measured on the hex grid, not on screen. A unit walking between two hexes takes damage for where it is.</p>
</section>
<section><h2>Against each unit</h2>
<div class="table-scroll"><table class="data sortable">
    <thead><tr><th>Unit</th><th>Health</th><th>On the epicenter</th><th>On the next hex</th><th>At the outer edge</th></tr></thead>
    <tbody>${victims}</tbody>
</table></div>
<p class="note">A full-health squad hit by one strike. The turret is a structure and takes the structure damage by hex.</p>
</section>
${timeline}
${
    ion
        ? `<section><h2>Card icon</h2><div class="animations"><figure><div class="card-icon"><img src="../${ion.icon}" alt="" width="64" height="64"></div><figcaption>Card icon</figcaption></figure></div>
<p class="note">The game draws the strike with Phaser Graphics at runtime; these frames come from the same drawing code, rendered by <code>npm run sprites</code>,
one every ${ion.step} ms. On screen the blast is sized to the map.</p></section>`
        : ""
}
<nav class="pager">
    <a href="${prev.slug}.html">← ${escapeHtml(prev.name)}</a>
    <a href="${next.slug}.html">${escapeHtml(next.name)} →</a>
</nav>`;

    return page({
        title: stat.label,
        description: `${stat.label}: commander power in Slavir. Cost, cooldown, damage falloff and what it does to each unit.`,
        section: "wiki",
        sidebar: wikiSidebar(data, ION_SLUG),
        body,
    });
}

/** One building: what it costs and unlocks; the castle also gets the base's health and what it takes to destroy it */
function renderBuilding(data: GameData, building: BuildingStat, index: number): string {
    const buildings = buildingList(data);
    const prev = buildings[(index - 1 + buildings.length) % buildings.length];
    const next = buildings[(index + 1) % buildings.length];
    const name = buildingName(building.type);
    const units = unlockedBy(data, building);
    const isCastle = building.type === "castle";
    const isSpawn = building.type === "spawn";
    const rules = data.powers;

    const overview = [
        row("Cost", startsBuilt(building) ? "Starts built" : String(building.cost)),
        row("How you get it", startsBuilt(building) ? "Every player starts with one" : "Click its card below the map, once per match"),
        !startsBuilt(building) ? row("Placed on", "The next free building slot next to the castle") : "",
        units.length
            ? row(
                  startsBuilt(building) ? "Recruits" : "Unlocks",
                  units.map(unit => `<a href="${unitSlug(unit)}.html">${escapeHtml(unitName(unit))}</a>`).join(", ")
              )
            : "",
        isCastle ? row("Base health", `${data.baseHealth} <span class="muted">(shared by the castle and its four building slots)</span>`) : "",
        isSpawn ? row("Role", "Recruited units appear here") : "",
        !isSpawn
            ? row("Part of the base", "Yes: units and the ion cannon damage the base through any of its five hexes")
            : row("Part of the base", "No"),
    ].join("");

    const unitCards = units.length
        ? `<section><h2>${startsBuilt(building) ? "Recruits" : "Unlocks"}</h2><div class="unit-cards">${units
              .map(
                  unit => `<a class="unit-card" href="${unitSlug(unit)}.html">
                    ${sprite(data, unit, 0, 5, 96)}
                    <h3>${escapeHtml(unitName(unit))}</h3>
                    <p>${TYPE_LABEL[unit.type]}${unit.squadSize > 1 ? ` · squad of ${unit.squadSize}` : ""}</p>
                    <p class="cost">${unit.cost}</p>
                </a>`
              )
              .join("")}</div></section>`
        : "";

    // The castle: how long one squad of each unit needs to bring the base down, and the ion cannon's share
    let siege = "";
    if (isCastle) {
        const rows = recruitable(data)
            .filter(unit => unit.canAttack)
            .map(unit => {
                const {perShot, dps, volley} = weapon(data, unit, {type: "structure"});
                const time = dps > 0 ? volley.initialChargeUp + data.baseHealth / dps : undefined;
                return `<tr>
                    <td><a class="unit-link" href="${unitSlug(unit)}.html">${sprite(data, unit, 0, 5, 40)}<span>${escapeHtml(unitName(unit))}</span></a></td>
                    <td>${fmt(perShot)}</td>
                    <td>${fmt(dps)}</td>
                    <td>${time === undefined ? "Can't" : seconds(time)}</td>
                </tr>`;
            })
            .join("");
        const direct = rules.ionCannonStructureDamage(0);
        const adjacent = rules.ionCannonStructureDamage(1);
        siege = `<section><h2>Destroying the base</h2>
<div class="table-scroll"><table class="data sortable">
    <thead><tr><th>Attacker</th><th>Per shot</th><th>DPS</th><th>One squad alone</th></tr></thead>
    <tbody>${rows}</tbody>
</table></div>
<p class="note">One full-strength squad shooting the base with its damage against structures, without losses.</p>
<table class="stats">
    ${row("Missile strike", "Holding the objective pads launches a strike that takes half of the base's full health")}
    ${row(
        `<a href="${ION_SLUG}.html">Ion cannon</a>`,
        `${direct} on a hit on one of the base's hexes (${Math.ceil(data.baseHealth / direct)} strikes to destroy it), ${adjacent} next to one`
    )}
</table>
</section>`;
    }

    const texture = data.textures.get(building.texture);
    const body = `<nav class="crumbs"><a href="./">Buildings</a> / ${name}</nav>
<header class="unit-hero">
    ${buildingImage(data, building, 160)}
    <div>
        <p class="eyebrow">Building${startsBuilt(building) ? " · starts built" : ` · ${building.cost} to build`}</p>
        <h1>${name}</h1>
        <p class="muted">Type <code>${escapeHtml(building.type)}</code>${texture ? ` · image <code>${escapeHtml(texture.url.replace(/^assets\//, ""))}</code>` : ""} ·
            defined in <a href="${GITHUB}/blob/main/src/entities/Building.ts" rel="noopener"><code>Building.ts</code></a></p>
    </div>
</header>
<section><h2>Overview</h2><table class="stats">${overview}</table></section>
${unitCards}
${siege}
<nav class="pager">
    <a href="${prev.type}.html">← ${buildingName(prev.type)}</a>
    <a href="${next.type}.html">${buildingName(next.type)} →</a>
</nav>`;

    return page({
        title: name,
        description: `${name}: building in Slavir.${units.length ? ` Unlocks ${units.map(unitName).join(", ")}.` : ""}`,
        section: "wiki",
        sidebar: wikiSidebar(data, building.type),
        body,
    });
}

/** Every generated wiki page, by file name inside src/wiki/ */
export function renderWiki(data: GameData): Map<string, string> {
    const pages = new Map<string, string>([["index.html", renderIndex(data)]]);
    data.units.forEach((stat, index) => {
        pages.set(`${unitSlug(stat)}.html`, renderUnit(data, stat, index));
    });
    pages.set(`${ION_SLUG}.html`, renderIonCannon(data));
    buildingList(data).forEach((building, index) => {
        pages.set(`${building.type}.html`, renderBuilding(data, building, index));
    });
    return pages;
}
