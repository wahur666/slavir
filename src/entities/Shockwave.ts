import type Phaser from "phaser";
import type GameScene from "../scenes/GameScene.js";

/** Pixels per ms the wave front travels */
const WAVE_SPEED = 0.45;
/** Half the opening angle of the wave front, in radians */
const WAVE_SPREAD = 0.6;
/** The map is seen at an angle, rings on the ground are flattened by this factor */
const GROUND_FLATTEN = 0.55;
const WAVE_COLOR = 0xbfe6ff;
const WAVE_CORE_COLOR = 0xffffff;
const DUST_COLOR = 0xc9a26b;

/**
 * Titan shockwave: an arc-shaped wave front rolls from the shooter through each hex in `hexes` (in order), and bursts on
 * every hex it passes, with a ground ring and a dust puff.
 * @param from the shooter's position
 * @param hexes centers of the hexes the wave goes through, the farthest last
 */
export function fireShockwave(scene: GameScene, from: Phaser.Math.Vector2, hexes: Phaser.Math.Vector2[], visible: boolean) {
    if (hexes.length === 0) return;
    const last = hexes[hexes.length - 1];
    const angle = Math.atan2(last.y - from.y, last.x - from.x);
    const reach = Math.hypot(last.x - from.x, last.y - from.y);
    const hexDistances = hexes.map(hex => Math.hypot(hex.x - from.x, hex.y - from.y));
    const burst = hexes.map(() => false);

    const front = scene.add.graphics().setDepth(3).setVisible(visible);
    const state = {radius: 12};
    scene.tweens.add({
        targets: state,
        radius: reach + 14,
        duration: reach / WAVE_SPEED,
        ease: "Sine.easeOut",
        onUpdate: () => {
            const progress = Math.min(1, state.radius / (reach + 14));
            front.clear();
            // Three arcs, thick and faint at the back, thin and bright at the edge, read as one rolling wave
            const layers = [
                {offset: -10, width: 12, color: WAVE_COLOR, alpha: 0.25},
                {offset: -4, width: 7, color: WAVE_COLOR, alpha: 0.55},
                {offset: 0, width: 3, color: WAVE_CORE_COLOR, alpha: 0.95},
            ];
            for (const layer of layers) {
                const radius = Math.max(1, state.radius + layer.offset);
                front.lineStyle(layer.width * (1 - progress * 0.4), layer.color, layer.alpha * (1 - progress * 0.5));
                front.beginPath();
                front.arc(from.x, from.y, radius, angle - WAVE_SPREAD, angle + WAVE_SPREAD, false);
                front.strokePath();
            }
            hexDistances.forEach((distance, i) => {
                if (!burst[i] && state.radius >= distance) {
                    burst[i] = true;
                    groundBurst(scene, hexes[i], visible);
                }
            });
        },
        onComplete: () => front.destroy(),
    });
}

/** Expanding flattened ring and a dust puff on a hex the wave passes */
function groundBurst(scene: GameScene, at: Phaser.Math.Vector2, visible: boolean) {
    const ring = scene.add
        .ellipse(at.x, at.y, 20, 20 * GROUND_FLATTEN)
        .setStrokeStyle(4, WAVE_COLOR, 0.9)
        .setDepth(1.5)
        .setVisible(visible);
    scene.tweens.add({
        targets: ring,
        scale: 4,
        alpha: 0,
        duration: 320,
        ease: "Cubic.easeOut",
        onComplete: () => ring.destroy(),
    });

    const flash = scene.add
        .ellipse(at.x, at.y, 34, 34 * GROUND_FLATTEN, WAVE_CORE_COLOR, 0.55)
        .setDepth(1.5)
        .setVisible(visible);
    scene.tweens.add({
        targets: flash,
        scale: 1.8,
        alpha: 0,
        duration: 200,
        onComplete: () => flash.destroy(),
    });

    for (let i = 0; i < 6; i++) {
        const dir = (i / 6) * Math.PI * 2 + Math.random() * 0.5;
        const dust = scene.add
            .circle(at.x, at.y, 3 + Math.random() * 3, DUST_COLOR, 0.8)
            .setDepth(3)
            .setVisible(visible);
        scene.tweens.add({
            targets: dust,
            x: at.x + Math.cos(dir) * (22 + Math.random() * 12),
            y: at.y + Math.sin(dir) * (22 + Math.random() * 12) * GROUND_FLATTEN - 10,
            alpha: 0,
            scale: 1.6,
            duration: 380,
            ease: "Quad.easeOut",
            onComplete: () => dust.destroy(),
        });
    }
}
