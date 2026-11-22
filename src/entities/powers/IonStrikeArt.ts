import {ION_CANNON_BLAST_TIME} from "../../model/power/PowerRules.js";

/**
 * How an ion cannon strike looks at a given moment, kept free of Phaser: the game paints it with Phaser Graphics
 * (IonCannonStrike), the site generator with a Node canvas (site/powerSprites.ts), from the same code.
 */

/** The map is seen at an angle, rings on the ground are flattened by this factor */
export const FLATTEN = 0.45;
/** Targeting beams converge until here, then the cannon charges */
export const LOCK_END = 2200;
/** The main beam comes down from here until the blast */
export const BEAM_START = 3000;
/** Visuals keep going after the blast for this long */
export const AFTERMATH = 900;
/** Length of the whole effect, in ms */
export const ION_STRIKE_DURATION = ION_CANNON_BLAST_TIME + AFTERMATH;
const BEAM_COUNT = 6;

export const CYAN = 0x6fd3ff;
export const PALE = 0xc8f1ff;
export const WHITE = 0xffffff;
export const DEEP = 0x2a7bff;

/** The drawing calls the strike uses, a subset of Phaser.GameObjects.Graphics. Everything is drawn additively. */
export interface StrikePainter {
    fillStyle(color: number, alpha?: number): unknown;
    lineStyle(width: number, color: number, alpha?: number): unknown;
    fillEllipse(x: number, y: number, width: number, height: number, smoothness?: number): unknown;
    fillCircle(x: number, y: number, radius: number): unknown;
    fillRect(x: number, y: number, width: number, height: number): unknown;
    lineBetween(x1: number, y1: number, x2: number, y2: number): unknown;
    beginPath(): unknown;
    moveTo(x: number, y: number): unknown;
    lineTo(x: number, y: number): unknown;
    strokePath(): unknown;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Draws one moment of a strike
 * @param g beams, above the units
 * @param glow ground decals, below the units
 * @param t ms since the strike was called
 * @param x target x, the beams come down from y = -40
 * @param y target y
 * @param r blast radius on screen
 */
export function drawIonStrike(g: StrikePainter, glow: StrikePainter, t: number, x: number, y: number, r: number) {
    if (t < ION_CANNON_BLAST_TIME) {
        const lock = Math.min(1, t / LOCK_END);
        const charge = clamp((t - LOCK_END) / (BEAM_START - LOCK_END), 0, 1);
        const fadeIn = Math.min(1, t / 300);

        // Danger zone on the ground: a filled disc that brightens, and a dashed ring turning around it
        glow.fillStyle(DEEP, (0.12 + 0.18 * lock + 0.25 * charge) * fadeIn);
        flatCircle(glow, x, y, r);
        glow.fillStyle(CYAN, (0.1 + 0.4 * charge) * fadeIn);
        flatCircle(glow, x, y, r * (0.35 + 0.25 * Math.sin(t / 90) * charge));
        const dashes = 12;
        const turn = t / 700;
        glow.lineStyle(3, PALE, 0.85 * fadeIn);
        for (let i = 0; i < dashes; i++) {
            const start = turn + (i * Math.PI * 2) / dashes;
            flatArc(glow, x, y, r, start, start + Math.PI / dashes);
        }
        glow.lineStyle(2, CYAN, 0.7 * fadeIn);
        flatArc(glow, x, y, r * (1 - 0.55 * lock), -turn * 1.6, -turn * 1.6 + Math.PI * 1.4);
        // Crosshair
        glow.lineStyle(2, PALE, 0.6 * fadeIn);
        glow.lineBetween(x - r * 0.25, y, x + r * 0.25, y);
        glow.lineBetween(x, y - r * 0.25 * FLATTEN, x, y + r * 0.25 * FLATTEN);

        // Targeting beams from the sky, their feet spiral in onto the target
        const spread = r * (1 - lock) + 4;
        for (let i = 0; i < BEAM_COUNT; i++) {
            const angle = (i * Math.PI * 2) / BEAM_COUNT + t / 500;
            const footX = x + Math.cos(angle) * spread;
            const footY = y + Math.sin(angle) * spread * FLATTEN;
            const skyX = x + Math.cos(angle) * (120 + 60 * (1 - lock));
            const alpha = (0.25 + 0.5 * lock) * fadeIn;
            g.lineStyle(5 + 6 * charge, CYAN, alpha * 0.35);
            g.lineBetween(skyX, -40, footX, footY);
            g.lineStyle(1.5 + 2 * charge, PALE, alpha);
            g.lineBetween(skyX, -40, footX, footY);
            g.fillStyle(WHITE, alpha);
            g.fillCircle(footX, footY, 2 + 2 * charge);
        }

        // Charging orb
        if (charge > 0) {
            const pulse = 1 + 0.15 * Math.sin(t / 40);
            g.fillStyle(CYAN, 0.35 * charge);
            g.fillCircle(x, y - 6, 22 * charge * pulse);
            g.fillStyle(WHITE, 0.8 * charge);
            g.fillCircle(x, y - 6, 9 * charge * pulse);
        }

        // Main beam
        if (t >= BEAM_START) {
            const beam = (t - BEAM_START) / (ION_CANNON_BLAST_TIME - BEAM_START);
            drawColumn(g, x, y, 10 + 34 * beam, 1);
            glow.fillStyle(WHITE, 0.3 + 0.4 * beam);
            flatCircle(glow, x, y, r * 0.5 * (1 + beam));
        }
    } else {
        // Aftermath: the column thins out, a shockwave ring rolls outwards, the ground glows and cools
        const after = Math.min(1, (t - ION_CANNON_BLAST_TIME) / AFTERMATH);
        const fade = 1 - after;
        drawColumn(g, x, y, 44 * (1 - after) ** 2, fade);
        glow.fillStyle(CYAN, 0.45 * fade);
        flatCircle(glow, x, y, r * (0.9 + 0.3 * after));
        glow.fillStyle(WHITE, 0.6 * fade ** 2);
        flatCircle(glow, x, y, r * 0.6);
        const wave = r * (0.6 + 1.2 * Math.sqrt(after));
        glow.lineStyle(10 * fade + 1, PALE, 0.9 * fade);
        flatArc(glow, x, y, wave, 0, Math.PI * 2);
        glow.lineStyle(4 * fade + 1, WHITE, fade);
        flatArc(glow, x, y, wave * 0.8, 0, Math.PI * 2);
    }
}

/** Vertical beam from above the screen down to the ground, with a white core */
function drawColumn(g: StrikePainter, x: number, y: number, width: number, alpha: number) {
    if (width <= 0.5) return;
    g.fillStyle(DEEP, 0.35 * alpha);
    g.fillRect(x - width * 0.9, -40, width * 1.8, y + 40);
    g.fillStyle(CYAN, 0.7 * alpha);
    g.fillRect(x - width / 2, -40, width, y + 40);
    g.fillStyle(WHITE, alpha);
    g.fillRect(x - width / 5, -40, (width * 2) / 5, y + 40);
    g.fillStyle(WHITE, alpha);
    g.fillEllipse(x, y, width * 1.6, width * 1.6 * FLATTEN);
}

function flatCircle(g: StrikePainter, x: number, y: number, radius: number) {
    g.fillEllipse(x, y, radius * 2, radius * 2 * FLATTEN, 40);
}

/** Arc of a ring lying on the ground */
function flatArc(g: StrikePainter, x: number, y: number, radius: number, from: number, to: number) {
    const steps = Math.max(4, Math.ceil(((to - from) / (Math.PI * 2)) * 48));
    g.beginPath();
    for (let i = 0; i <= steps; i++) {
        const angle = from + ((to - from) * i) / steps;
        const px = x + Math.cos(angle) * radius;
        const py = y + Math.sin(angle) * radius * FLATTEN;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
    }
    g.strokePath();
}
