import type Phaser from "phaser";
import {defaultFont} from "../helpers/utils.js";

/** How far the number floats up, in pixels */
const RISE = 42;
const DURATION = 1000;

/**
 * A damage number that floats up from (x, y) and fades out. Purely visual: it never touches the simulation.
 */
export function showDamageNumber(scene: Phaser.Scene, x: number, y: number, amount: number) {
    const text = scene.add
        .text(x, y, `-${Math.round(amount)}`, {
            fontFamily: defaultFont,
            fontSize: "20px",
            color: "#ff5a4f",
            stroke: "#1a0d0d",
            strokeThickness: 4,
        })
        .setOrigin(0.5, 1)
        .setDepth(20);
    scene.tweens.add({
        targets: text,
        y: y - RISE,
        alpha: {from: 1, to: 0},
        duration: DURATION,
        ease: "Cubic.easeOut",
        onComplete: () => text.destroy(),
    });
}
