import type GameScene from "../scenes/GameScene.js";

export interface ShotStyle {
    /** Projectile size in pixels */
    length: number;
    width: number;
    color: number;
    /** Glow drawn behind the projectile, null for none */
    trailColor: number | null;
    flightMs: number;
    /** Impact flash */
    flashColor: number;
    flashRadius: number;
    flashScale: number;
}

/** Orca style missile */
export const MISSILE: ShotStyle = {
    length: 14,
    width: 4,
    color: 0xffe28a,
    trailColor: 0xff7a1a,
    flightMs: 150,
    flashColor: 0xffa040,
    flashRadius: 6,
    flashScale: 2.5,
};

/** Fast, bluish anti-air missile */
export const AA_MISSILE: ShotStyle = {
    length: 16,
    width: 4,
    color: 0xe8f6ff,
    trailColor: 0x4fb8ff,
    flightMs: 120,
    flashColor: 0x9ad8ff,
    flashRadius: 7,
    flashScale: 3,
};

/** Short machine-gun tracer with a small spark */
export const TRACER: ShotStyle = {
    length: 10,
    width: 2,
    color: 0xfff3b0,
    trailColor: null,
    flightMs: 80,
    flashColor: 0xffd060,
    flashRadius: 3,
    flashScale: 1.8,
};

/** A projectile flying from the shooter to the target, followed by an impact flash */
export function fireShotEffect(
    scene: GameScene,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    visible: boolean,
    style: ShotStyle = MISSILE
) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const projectile = scene.add.rectangle(fromX, fromY, style.length, style.width, style.color).setRotation(angle).setDepth(3).setVisible(visible);
    const trail =
        style.trailColor === null
            ? null
            : scene.add
                  .rectangle(fromX, fromY, style.length * 0.6, style.width * 0.75, style.trailColor, 0.8)
                  .setRotation(angle)
                  .setDepth(3)
                  .setVisible(visible);
    const trailOffsetX = -Math.cos(angle) * style.length * 0.65;
    const trailOffsetY = -Math.sin(angle) * style.length * 0.65;
    scene.tweens.add({
        targets: projectile,
        x: toX,
        y: toY,
        duration: style.flightMs,
        onUpdate: () => trail?.setPosition(projectile.x + trailOffsetX, projectile.y + trailOffsetY),
        onComplete: () => {
            projectile.destroy();
            trail?.destroy();
            const flash = scene.add.circle(toX, toY, style.flashRadius, style.flashColor, 0.9).setDepth(3).setVisible(visible);
            scene.tweens.add({
                targets: flash,
                scale: style.flashScale,
                alpha: 0,
                duration: 180,
                onComplete: () => flash.destroy(),
            });
        },
    });
}
