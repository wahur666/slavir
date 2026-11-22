import type Phaser from "phaser";

/**
 * Commander power art, drawn on canvases at startup since there are no sprite assets for it:
 * - a turret spritesheet per side, laid out like the unit sheets (4 frames x 16 rows of 128px, see Unit.generateAnimations)
 * - card icons for the turret and the ion cannon
 */

export const TURRET_TEXTURES = ["turret-1", "turret-2"] as const;
export const TURRET_ICON = "power-turret-icon";
export const ION_CANNON_ICON = "power-ion-icon";

const FRAME = 128;
const DIRECTIONS = ["down", "up", "left", "right"] as const;
const KINDS = ["idle", "walk", "attack", "die"] as const;
type Direction = (typeof DIRECTIONS)[number];
type Kind = (typeof KINDS)[number];

/** Accent colors of player 1 (blue) and player 2 (red) */
const ACCENTS = [
    {main: "#3d8bff", light: "#9cc7ff", dark: "#1d4f9e"},
    {main: "#ff4d4d", light: "#ffb0a0", dark: "#9e2020"},
];

/** Center of the base plate in a frame; the unit origin (0.5, 0.8) puts it on the hex center */
const CX = 64;
const CY = 102;

/** Creates the textures once per game, they are shared by every scene */
export function ensurePowerTextures(scene: Phaser.Scene) {
    TURRET_TEXTURES.forEach((key, side) => {
        if (!scene.textures.exists(key)) createTurretSheet(scene, key, side);
    });
    if (!scene.textures.exists(TURRET_ICON)) createIcon(scene, TURRET_ICON, drawTurretIcon);
    if (!scene.textures.exists(ION_CANNON_ICON)) createIcon(scene, ION_CANNON_ICON, drawIonIcon);
}

function createTurretSheet(scene: Phaser.Scene, key: string, side: number) {
    const texture = scene.textures.createCanvas(key, TURRET_SHEET.width, TURRET_SHEET.height)!;
    drawTurretSheet(texture.getContext(), side);
    for (let row = 0; row < 16; row++) {
        for (let frame = 0; frame < 4; frame++) {
            texture.add(row * 4 + frame, 0, frame * FRAME, row * FRAME, FRAME, FRAME);
        }
    }
    texture.refresh();
}

/** Size of a turret sheet: 4 frames x 16 rows (4 directions x idle / walk / attack / die) */
export const TURRET_SHEET = {width: FRAME * 4, height: FRAME * 16, frame: FRAME};

/**
 * Draws a whole turret sheet for one side (0: player 1, 1: player 2) on a context of {@link TURRET_SHEET}'s size. Plain
 * canvas calls only, so the site generator can render the same sheet in Node (site/powerSprites.ts).
 */
export function drawTurretSheet(ctx: CanvasRenderingContext2D, side: number) {
    DIRECTIONS.forEach((direction, d) => {
        KINDS.forEach((kind, k) => {
            const row = d * 4 + k;
            for (let frame = 0; frame < 4; frame++) {
                ctx.save();
                ctx.translate(frame * FRAME, row * FRAME);
                ctx.beginPath();
                ctx.rect(0, 0, FRAME, FRAME);
                ctx.clip();
                drawTurretFrame(ctx, direction, kind, frame, ACCENTS[side]);
                ctx.restore();
            }
        });
    });
}

function createIcon(scene: Phaser.Scene, key: string, draw: (ctx: CanvasRenderingContext2D) => void) {
    const texture = scene.textures.createCanvas(key, 64, 64)!;
    draw(texture.getContext());
    texture.refresh();
}

type Accent = (typeof ACCENTS)[number];

function drawTurretFrame(ctx: CanvasRenderingContext2D, direction: Direction, kind: Kind, frame: number, accent: Accent) {
    if (kind === "die") {
        drawWreck(ctx, direction, frame, accent);
        return;
    }
    const firing = kind === "attack" && frame < 2;
    const recoil = kind === "attack" ? [5, 3, 1, 0][frame] : 0;
    // Status light blinks on the idle cycle, stays lit while firing
    const lightOn = kind === "attack" || frame % 2 === 0;
    drawBase(ctx, accent);
    drawPedestal(ctx);
    // Barrels pointing away from the viewer are hidden behind the head
    if (direction === "up") drawBarrels(ctx, direction, recoil, firing);
    drawHead(ctx, direction, accent, lightOn);
    if (direction !== "up") drawBarrels(ctx, direction, recoil, firing);
}

/** Octagonal concrete plate with hazard corners, seen at the map's angle */
function drawBase(ctx: CanvasRenderingContext2D, accent: Accent) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ellipse(ctx, CX, CY + 6, 42, 15);
    ctx.fill();

    const plate = (rx: number, ry: number, dy: number) => {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = Math.PI / 8 + (i * Math.PI) / 4;
            const x = CX + Math.cos(angle) * rx;
            const y = CY + dy + Math.sin(angle) * ry;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
    };
    // Side of the slab, then its top
    ctx.fillStyle = "#3a3f46";
    plate(38, 15, 4);
    ctx.fill();
    const top = ctx.createLinearGradient(0, CY - 15, 0, CY + 15);
    top.addColorStop(0, "#8c939b");
    top.addColorStop(1, "#5d646c");
    ctx.fillStyle = top;
    plate(38, 15, 0);
    ctx.fill();
    ctx.strokeStyle = "#2b2f35";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Team colored rim marks
    ctx.strokeStyle = accent.main;
    ctx.lineWidth = 3;
    for (const angle of [Math.PI * 0.75, Math.PI * 0.25, Math.PI * 1.25, Math.PI * 1.75]) {
        ctx.beginPath();
        ctx.ellipse(CX, CY, 32, 12, 0, angle - 0.22, angle + 0.22);
        ctx.stroke();
    }
    // Bolts
    ctx.fillStyle = "#c9ced4";
    for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI) / 4;
        ellipse(ctx, CX + Math.cos(angle) * 26, CY + Math.sin(angle) * 9, 1.6, 1.1);
        ctx.fill();
    }
}

/** Short armored cylinder holding the head */
function drawPedestal(ctx: CanvasRenderingContext2D) {
    const body = ctx.createLinearGradient(CX - 14, 0, CX + 14, 0);
    body.addColorStop(0, "#4b5158");
    body.addColorStop(0.45, "#9aa1a8");
    body.addColorStop(1, "#40454b");
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(CX - 14, CY - 22);
    ctx.lineTo(CX - 14, CY - 2);
    ctx.ellipse(CX, CY - 2, 14, 5, 0, Math.PI, 0, true);
    ctx.lineTo(CX + 14, CY - 22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2b2f35";
    ctx.lineWidth = 1.2;
    ctx.stroke();
}

/** Armored dome with a sensor visor facing the barrels */
function drawHead(ctx: CanvasRenderingContext2D, direction: Direction, accent: Accent, lightOn: boolean) {
    const hy = CY - 30;
    const dome = ctx.createRadialGradient(CX - 6, hy - 8, 2, CX, hy, 24);
    dome.addColorStop(0, "#d5dadf");
    dome.addColorStop(0.5, "#89919a");
    dome.addColorStop(1, "#4a5057");
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.moveTo(CX - 22, hy + 4);
    ctx.bezierCurveTo(CX - 22, hy - 18, CX + 22, hy - 18, CX + 22, hy + 4);
    ctx.ellipse(CX, hy + 4, 22, 8, 0, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#2b2f35";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Team colored band around the dome
    ctx.strokeStyle = accent.main;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.ellipse(CX, hy + 1, 21, 7, 0, 0.1, Math.PI - 0.1);
    ctx.stroke();

    // Visor slit on the side the gun faces
    const visor = {down: {x: CX, y: hy - 2, w: 16}, up: null, left: {x: CX - 12, y: hy - 4, w: 9}, right: {x: CX + 12, y: hy - 4, w: 9}}[direction];
    if (visor) {
        ctx.fillStyle = "#14181d";
        roundRect(ctx, visor.x - visor.w / 2, visor.y - 2.5, visor.w, 5, 2);
        ctx.fill();
        ctx.fillStyle = lightOn ? accent.light : accent.dark;
        roundRect(ctx, visor.x - visor.w / 2 + 1.5, visor.y - 1.2, visor.w - 3, 2.4, 1);
        ctx.fill();
    }
    // Status light on top
    ctx.fillStyle = lightOn ? accent.light : accent.dark;
    ellipse(ctx, CX, hy - 13, 2.6, 2);
    ctx.fill();
    if (lightOn) {
        ctx.fillStyle = hexAlpha(accent.light, 0.35);
        ellipse(ctx, CX, hy - 13, 6, 4.5);
        ctx.fill();
    }
}

/** Twin barrels; `recoil` pulls them back in pixels */
function drawBarrels(ctx: CanvasRenderingContext2D, direction: Direction, recoil: number, firing: boolean) {
    const hy = CY - 30;
    ctx.lineCap = "round";
    const barrel = (x1: number, y1: number, x2: number, y2: number, width: number) => {
        ctx.strokeStyle = "#23272c";
        ctx.lineWidth = width + 2;
        line(ctx, x1, y1, x2, y2);
        ctx.strokeStyle = "#6f777f";
        ctx.lineWidth = width;
        line(ctx, x1, y1, x2, y2);
        ctx.strokeStyle = "rgba(255,255,255,0.35)";
        ctx.lineWidth = 1;
        line(ctx, x1, y1 - width / 4, x2, y2 - width / 4);
    };
    const tips: {x: number; y: number}[] = [];
    switch (direction) {
        case "left":
        case "right": {
            const s = direction === "left" ? -1 : 1;
            const tip = CX + s * (48 - recoil);
            barrel(CX + s * 14, hy - 5, tip, hy - 5, 5);
            barrel(CX + s * 14, hy + 1, tip - s * 2, hy + 1, 5);
            // Muzzle brakes
            ctx.fillStyle = "#2f343a";
            ctx.fillRect(Math.min(tip, tip - s * 6), hy - 8, 6, 6);
            ctx.fillRect(Math.min(tip - s * 2, tip - s * 8), hy - 2, 6, 6);
            tips.push({x: tip + s * 3, y: hy - 5}, {x: tip + s, y: hy + 1});
            break;
        }
        case "down": {
            const tip = hy + 22 - recoil;
            barrel(CX - 6, hy + 4, CX - 6, tip, 6);
            barrel(CX + 6, hy + 4, CX + 6, tip, 6);
            ctx.fillStyle = "#14181d";
            ellipse(ctx, CX - 6, tip + 1, 3.2, 2.2);
            ctx.fill();
            ellipse(ctx, CX + 6, tip + 1, 3.2, 2.2);
            ctx.fill();
            tips.push({x: CX - 6, y: tip + 4}, {x: CX + 6, y: tip + 4});
            break;
        }
        case "up": {
            const tip = hy - 30 + recoil;
            barrel(CX - 5, hy - 6, CX - 5, tip, 5);
            barrel(CX + 5, hy - 6, CX + 5, tip, 5);
            tips.push({x: CX - 5, y: tip - 3}, {x: CX + 5, y: tip - 3});
            break;
        }
    }
    if (firing) {
        for (const tip of tips) muzzleFlash(ctx, tip.x, tip.y, recoil >= 5 ? 1 : 0.6);
    }
}

function muzzleFlash(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
    const glow = ctx.createRadialGradient(x, y, 0, x, y, 12 * size);
    glow.addColorStop(0, "rgba(255,255,220,1)");
    glow.addColorStop(0.4, "rgba(255,200,80,0.9)");
    glow.addColorStop(1, "rgba(255,120,20,0)");
    ctx.fillStyle = glow;
    ellipse(ctx, x, y, 12 * size, 12 * size);
    ctx.fill();
    ctx.fillStyle = "#fffbe0";
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
        const radius = (i % 2 === 0 ? 9 : 3.5) * size;
        const angle = (i * Math.PI) / 5;
        ctx.lineTo(x + Math.cos(angle) * radius, y + Math.sin(angle) * radius);
    }
    ctx.closePath();
    ctx.fill();
}

/** Death: flash, fireball, smoke, burnt wreck */
function drawWreck(ctx: CanvasRenderingContext2D, direction: Direction, frame: number, accent: Accent) {
    drawBase(ctx, accent);
    if (frame === 0) {
        drawPedestal(ctx);
        drawHead(ctx, direction, accent, true);
        explosion(ctx, CX, CY - 32, 18, 0.8);
    } else if (frame === 1) {
        drawPedestal(ctx);
        explosion(ctx, CX, CY - 28, 34, 1);
    } else {
        // Broken stump and debris
        ctx.fillStyle = "#30353b";
        ctx.beginPath();
        ctx.moveTo(CX - 14, CY - 2);
        ctx.lineTo(CX - 14, CY - 12);
        ctx.lineTo(CX - 6, CY - 17);
        ctx.lineTo(CX + 2, CY - 11);
        ctx.lineTo(CX + 9, CY - 16);
        ctx.lineTo(CX + 14, CY - 10);
        ctx.lineTo(CX + 14, CY - 2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(20,16,12,0.55)";
        ellipse(ctx, CX, CY, 30, 11);
        ctx.fill();
        ctx.fillStyle = "#4a5057";
        for (const [dx, dy] of [
            [-26, 4],
            [22, -3],
            [-8, 10],
            [30, 7],
        ]) {
            ctx.fillRect(CX + dx, CY + dy, 4, 3);
        }
        const smoke = frame === 2 ? 0.75 : 0.35;
        for (const [dx, dy, r] of [
            [-6, -30, 14],
            [6, -42, 11],
            [-2, -54, 8],
        ]) {
            ctx.fillStyle = `rgba(60,60,64,${smoke})`;
            ellipse(ctx, CX + dx, CY + dy - (frame - 2) * 8, r, r);
            ctx.fill();
        }
        if (frame === 2) {
            ctx.fillStyle = "rgba(255,140,40,0.8)";
            ellipse(ctx, CX - 2, CY - 14, 5, 4);
            ctx.fill();
        }
    }
}

function explosion(ctx: CanvasRenderingContext2D, x: number, y: number, radius: number, alpha: number) {
    const fire = ctx.createRadialGradient(x, y, 0, x, y, radius);
    fire.addColorStop(0, `rgba(255,255,230,${alpha})`);
    fire.addColorStop(0.35, `rgba(255,200,70,${alpha})`);
    fire.addColorStop(0.7, `rgba(240,90,20,${alpha * 0.9})`);
    fire.addColorStop(1, "rgba(120,40,10,0)");
    ctx.fillStyle = fire;
    ellipse(ctx, x, y, radius, radius * 0.85);
    ctx.fill();
}

/** Card icon: the turret's head and barrels, front view */
export function drawTurretIcon(ctx: CanvasRenderingContext2D) {
    ctx.save();
    // The frame's turret spans about x 22..112, y 50..117
    ctx.scale(0.6, 0.6);
    ctx.translate(-14, -28);
    drawBase(ctx, ACCENTS[0]);
    drawPedestal(ctx);
    drawHead(ctx, "right", ACCENTS[0], true);
    drawBarrels(ctx, "right", 0, false);
    ctx.restore();
}

/** Card icon: an orbital beam hitting the ground */
export function drawIonIcon(ctx: CanvasRenderingContext2D) {
    const ground = ctx.createRadialGradient(32, 50, 0, 32, 50, 26);
    ground.addColorStop(0, "rgba(220,245,255,1)");
    ground.addColorStop(0.4, "rgba(90,190,255,0.85)");
    ground.addColorStop(1, "rgba(30,90,200,0)");
    ctx.fillStyle = ground;
    ellipse(ctx, 32, 50, 28, 12);
    ctx.fill();
    const beam = ctx.createLinearGradient(20, 0, 44, 0);
    beam.addColorStop(0, "rgba(60,160,255,0)");
    beam.addColorStop(0.3, "rgba(110,200,255,0.9)");
    beam.addColorStop(0.5, "rgba(255,255,255,1)");
    beam.addColorStop(0.7, "rgba(110,200,255,0.9)");
    beam.addColorStop(1, "rgba(60,160,255,0)");
    ctx.fillStyle = beam;
    ctx.fillRect(20, 0, 24, 50);
    ctx.strokeStyle = "rgba(170,230,255,0.9)";
    ctx.lineWidth = 2;
    ellipse(ctx, 32, 50, 20, 7);
    ctx.stroke();
    // Satellite at the top
    ctx.fillStyle = "#d5dadf";
    ctx.fillRect(28, 2, 8, 6);
    ctx.fillStyle = "#3d8bff";
    ctx.fillRect(16, 3, 11, 4);
    ctx.fillRect(37, 3, 11, 4);
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number) {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
}

function line(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function hexAlpha(hex: string, alpha: number): string {
    const value = Number.parseInt(hex.slice(1), 16);
    return `rgba(${(value >> 16) & 255},${(value >> 8) & 255},${value & 255},${alpha})`;
}
