import Phaser from "phaser";
import type GameScene from "../../scenes/GameScene.js";
import {ION_CANNON_BLAST_TIME} from "../../model/power/PowerRules.js";

/** The map is seen at an angle, rings on the ground are flattened by this factor */
const FLATTEN = 0.45;
/** Targeting beams converge until here, then the cannon charges */
const LOCK_END = 2200;
/** The main beam comes down from here until the blast */
const BEAM_START = 3000;
/** Visuals keep going after the blast for this long */
const AFTERMATH = 900;
const BEAM_COUNT = 6;

const CYAN = 0x6fd3ff;
const PALE = 0xc8f1ff;
const WHITE = 0xffffff;
const DEEP = 0x2a7bff;

/**
 * One ion cannon strike: the timing runs on simulation time (see {@link update}), so the blast lands on the same tick
 * in a replay and pauses with the game; the visuals are redrawn from that time as well.
 */
export default class IonCannonStrike {
    /** ms since the strike was called */
    elapsed = 0;
    private blasted = false;
    private readonly graphics: Phaser.GameObjects.Graphics;
    private readonly glow: Phaser.GameObjects.Graphics;

    /**
     * @param pos scaled position of the targeted hex center
     * @param radius scaled radius of the blast, for the visuals
     * @param onBlast deals the damage, called once the blast sequence is over
     */
    constructor(
        private readonly scene: GameScene,
        private readonly pos: Phaser.Math.Vector2,
        private readonly radius: number,
        private readonly onBlast: () => void
    ) {
        // Ground decals below the units, beams above them
        this.glow = scene.add.graphics().setDepth(1.6).setBlendMode(Phaser.BlendModes.ADD);
        this.graphics = scene.add.graphics().setDepth(6).setBlendMode(Phaser.BlendModes.ADD);
        this.render();
    }

    get finished(): boolean {
        return this.elapsed >= ION_CANNON_BLAST_TIME + AFTERMATH;
    }

    /** Advances the strike in simulation time; returns true once it is over and destroyed */
    update(delta: number): boolean {
        this.elapsed += delta;
        if (!this.blasted && this.elapsed >= ION_CANNON_BLAST_TIME) {
            this.blasted = true;
            this.onBlast();
            this.impactEffects();
        }
        if (this.finished) {
            this.destroy();
            return true;
        }
        this.render();
        return false;
    }

    destroy() {
        this.graphics.destroy();
        this.glow.destroy();
    }

    private render() {
        const t = this.elapsed;
        const g = this.graphics;
        const glow = this.glow;
        g.clear();
        glow.clear();
        const {x, y} = this.pos;
        const r = this.radius;

        if (t < ION_CANNON_BLAST_TIME) {
            const lock = Math.min(1, t / LOCK_END);
            const charge = Phaser.Math.Clamp((t - LOCK_END) / (BEAM_START - LOCK_END), 0, 1);
            const fadeIn = Math.min(1, t / 300);

            // Danger zone on the ground: a filled disc that brightens, and a dashed ring turning around it
            glow.fillStyle(DEEP, (0.12 + 0.18 * lock + 0.25 * charge) * fadeIn);
            this.flatCircle(glow, x, y, r);
            glow.fillStyle(CYAN, (0.1 + 0.4 * charge) * fadeIn);
            this.flatCircle(glow, x, y, r * (0.35 + 0.25 * Math.sin(t / 90) * charge));
            const dashes = 12;
            const turn = t / 700;
            glow.lineStyle(3, PALE, 0.85 * fadeIn);
            for (let i = 0; i < dashes; i++) {
                const start = turn + (i * Math.PI * 2) / dashes;
                this.flatArc(glow, x, y, r, start, start + Math.PI / dashes);
            }
            glow.lineStyle(2, CYAN, 0.7 * fadeIn);
            this.flatArc(glow, x, y, r * (1 - 0.55 * lock), -turn * 1.6, -turn * 1.6 + Math.PI * 1.4);
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
                this.drawColumn(g, x, y, 10 + 34 * beam, 1);
                glow.fillStyle(WHITE, 0.3 + 0.4 * beam);
                this.flatCircle(glow, x, y, r * 0.5 * (1 + beam));
            }
        } else {
            // Aftermath: the column thins out, a shockwave ring rolls outwards, the ground glows and cools
            const after = (t - ION_CANNON_BLAST_TIME) / AFTERMATH;
            const fade = 1 - after;
            this.drawColumn(g, x, y, 44 * (1 - after) ** 2, fade);
            glow.fillStyle(CYAN, 0.45 * fade);
            this.flatCircle(glow, x, y, r * (0.9 + 0.3 * after));
            glow.fillStyle(WHITE, 0.6 * fade ** 2);
            this.flatCircle(glow, x, y, r * 0.6);
            const wave = r * (0.6 + 1.2 * Math.sqrt(after));
            glow.lineStyle(10 * fade + 1, PALE, 0.9 * fade);
            this.flatArc(glow, x, y, wave, 0, Math.PI * 2);
            glow.lineStyle(4 * fade + 1, WHITE, fade);
            this.flatArc(glow, x, y, wave * 0.8, 0, Math.PI * 2);
        }
    }

    /** Vertical beam from above the screen down to the ground, with a white core */
    private drawColumn(g: Phaser.GameObjects.Graphics, x: number, y: number, width: number, alpha: number) {
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

    /** Flash, camera shake and sparks when the beam hits; visual only */
    private impactEffects() {
        const {x, y} = this.pos;
        this.scene.cameras.main.shake(280, 0.006);
        const flash = this.scene.add
            .circle(x, y - 10, this.radius * 0.7, WHITE, 0.9)
            .setDepth(6)
            .setBlendMode(Phaser.BlendModes.ADD);
        this.scene.tweens.add({targets: flash, scale: 2.2, alpha: 0, duration: 260, onComplete: () => flash.destroy()});
        for (let i = 0; i < 18; i++) {
            const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.3;
            const distance = this.radius * (0.8 + Math.random() * 0.8);
            const spark = this.scene.add
                .rectangle(x, y, 10, 2, i % 3 === 0 ? WHITE : PALE)
                .setRotation(Math.atan2(Math.sin(angle) * FLATTEN, Math.cos(angle)))
                .setDepth(6)
                .setBlendMode(Phaser.BlendModes.ADD);
            this.scene.tweens.add({
                targets: spark,
                x: x + Math.cos(angle) * distance,
                y: y + Math.sin(angle) * distance * FLATTEN - 12 - Math.random() * 20,
                alpha: 0,
                scaleX: 0.3,
                duration: 380 + Math.random() * 220,
                ease: "Quad.easeOut",
                onComplete: () => spark.destroy(),
            });
        }
    }

    private flatCircle(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number) {
        g.fillEllipse(x, y, radius * 2, radius * 2 * FLATTEN, 40);
    }

    /** Arc of a ring lying on the ground */
    private flatArc(g: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, from: number, to: number) {
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
}
