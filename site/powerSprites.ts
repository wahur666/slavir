import fs from "node:fs";
import path from "node:path";
import {pathToFileURL} from "node:url";
import {createCanvas} from "@napi-rs/canvas";
import {TURRET_SHEET, TURRET_TEXTURES, drawIonIcon, drawTurretIcon, drawTurretSheet} from "../src/entities/powers/PowerArt.js";
import {ION_STRIKE_DURATION, type StrikePainter, drawIonStrike} from "../src/entities/powers/IonStrikeArt.js";

/**
 * Renders the commander power art to PNG files. The game draws it at runtime instead of loading images, so there is no
 * asset to show on the site; this runs the very same drawing code on a Node canvas:
 * - turret sheets and card icons: plain canvas code (src/entities/powers/PowerArt.ts)
 * - the ion cannon strike: Phaser Graphics calls (src/entities/powers/IonStrikeArt.ts), replayed on a canvas by
 *   {@link canvasPainter}, one frame every {@link ION_STRIKE.step} ms side by side in one strip
 *
 * Usage: `npm run sprites -- [outDir]` (default src/wiki/sprites/). The site generator also calls it on every build.
 */

/** Ion cannon strip layout. The blast radius on screen depends on the map scale; this one fills the frame. */
export const ION_STRIKE = {frame: 320, step: 100, targetX: 160, targetY: 236, radius: 120};

export interface PowerSprites {
    /** Turret sheet per side (player 1 blue, player 2 red), file names inside the output folder */
    turretSheets: string[];
    turretIcon: string;
    ionCannonIcon: string;
    /** The whole ion cannon strike, frames side by side */
    ionStrike: {file: string; frames: number; frame: number; step: number};
    frame: number;
}

type Draw = (ctx: CanvasRenderingContext2D) => void;

/** Writes the PNG only when its bytes changed, so the dev server is not woken for nothing */
function writePng(file: string, width: number, height: number, draw: Draw) {
    const canvas = createCanvas(width, height);
    // Skia's context implements the same 2D API the game draws with
    draw(canvas.getContext("2d") as unknown as CanvasRenderingContext2D);
    const png = canvas.toBuffer("image/png");
    if (fs.existsSync(file) && fs.readFileSync(file).equals(png)) return;
    fs.writeFileSync(file, png);
}

const rgba = (color: number, alpha = 1) => `rgba(${(color >> 16) & 255}, ${(color >> 8) & 255}, ${color & 255}, ${alpha})`;

/** Phaser Graphics calls replayed on a 2D canvas, additive like the game's BlendModes.ADD */
function canvasPainter(ctx: CanvasRenderingContext2D): StrikePainter {
    ctx.globalCompositeOperation = "lighter";
    return {
        fillStyle: (color, alpha) => {
            ctx.fillStyle = rgba(color, alpha);
        },
        lineStyle: (width, color, alpha) => {
            ctx.lineWidth = width;
            ctx.strokeStyle = rgba(color, alpha);
        },
        fillEllipse: (x, y, width, height) => {
            ctx.beginPath();
            ctx.ellipse(x, y, width / 2, height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
        },
        fillCircle: (x, y, radius) => {
            ctx.beginPath();
            ctx.arc(x, y, Math.max(0, radius), 0, Math.PI * 2);
            ctx.fill();
        },
        fillRect: (x, y, width, height) => ctx.fillRect(x, y, width, height),
        lineBetween: (x1, y1, x2, y2) => {
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        },
        beginPath: () => ctx.beginPath(),
        moveTo: (x, y) => ctx.moveTo(x, y),
        lineTo: (x, y) => ctx.lineTo(x, y),
        strokePath: () => ctx.stroke(),
    };
}

function drawIonStrikeStrip(ctx: CanvasRenderingContext2D, frames: number) {
    const {frame, step, targetX, targetY, radius} = ION_STRIKE;
    for (let i = 0; i < frames; i++) {
        ctx.save();
        ctx.translate(i * frame, 0);
        ctx.beginPath();
        ctx.rect(0, 0, frame, frame);
        ctx.clip();
        const painter = canvasPainter(ctx);
        drawIonStrike(painter, painter, i * step, targetX, targetY, radius);
        ctx.restore();
    }
}

export function renderPowerSprites(outDir: string): PowerSprites {
    fs.mkdirSync(outDir, {recursive: true});
    const turretSheets = TURRET_TEXTURES.map((key, side) => {
        const name = `${key}.png`;
        writePng(path.join(outDir, name), TURRET_SHEET.width, TURRET_SHEET.height, ctx => drawTurretSheet(ctx, side));
        return name;
    });
    writePng(path.join(outDir, "turret-icon.png"), 64, 64, drawTurretIcon);
    writePng(path.join(outDir, "ion-cannon-icon.png"), 64, 64, drawIonIcon);
    const frames = Math.ceil(ION_STRIKE_DURATION / ION_STRIKE.step);
    writePng(path.join(outDir, "ion-cannon-strike.png"), ION_STRIKE.frame * frames, ION_STRIKE.frame, ctx => drawIonStrikeStrip(ctx, frames));
    return {
        turretSheets,
        turretIcon: "turret-icon.png",
        ionCannonIcon: "ion-cannon-icon.png",
        ionStrike: {file: "ion-cannon-strike.png", frames, frame: ION_STRIKE.frame, step: ION_STRIKE.step},
        frame: TURRET_SHEET.frame,
    };
}

// Run directly: npm run sprites -- [outDir]
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
    const outDir = path.resolve(process.argv[2] ?? path.join(import.meta.dirname, "../src/wiki/sprites"));
    const result = renderPowerSprites(outDir);
    const files = [...result.turretSheets, result.turretIcon, result.ionCannonIcon, result.ionStrike.file];
    console.log(`Wrote ${files.join(", ")} to ${outDir}`);
}
