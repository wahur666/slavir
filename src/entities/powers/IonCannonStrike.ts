import Phaser from "phaser";
import type GameScene from "../../scenes/GameScene.js";
import {ION_CANNON_BLAST_TIME} from "../../model/power/PowerRules.js";
import {FLATTEN, ION_STRIKE_DURATION, PALE, WHITE, drawIonStrike} from "./IonStrikeArt.js";

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
        return this.elapsed >= ION_STRIKE_DURATION;
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

    /** The drawing itself lives in IonStrikeArt, shared with the site's sprite renderer */
    private render() {
        this.graphics.clear();
        this.glow.clear();
        drawIonStrike(this.graphics, this.glow, this.elapsed, this.pos.x, this.pos.y, this.radius);
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
}
