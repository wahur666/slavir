import type GameScene from "../scenes/GameScene.js";

const FLIGHT_MS = 150;

/** A small missile flying from the shooter to the target, followed by an impact flash */
export function fireShotEffect(scene: GameScene, fromX: number, fromY: number, toX: number, toY: number, visible: boolean) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const missile = scene.add.rectangle(fromX, fromY, 14, 4, 0xffe28a).setRotation(angle).setDepth(3).setVisible(visible);
    const trail = scene.add.rectangle(fromX, fromY, 8, 3, 0xff7a1a, 0.8).setRotation(angle).setDepth(3).setVisible(visible);
    const trailOffsetX = -Math.cos(angle) * 9;
    const trailOffsetY = -Math.sin(angle) * 9;
    scene.tweens.add({
        targets: missile,
        x: toX,
        y: toY,
        duration: FLIGHT_MS,
        onUpdate: () => trail.setPosition(missile.x + trailOffsetX, missile.y + trailOffsetY),
        onComplete: () => {
            missile.destroy();
            trail.destroy();
            const flash = scene.add.circle(toX, toY, 6, 0xffa040, 0.9).setDepth(3).setVisible(visible);
            scene.tweens.add({
                targets: flash,
                scale: 2.5,
                alpha: 0,
                duration: 180,
                onComplete: () => flash.destroy(),
            });
        },
    });
}
