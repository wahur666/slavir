import type GameScene from "../scenes/GameScene";

export default class HealthBar {

    bg: Phaser.GameObjects.Rectangle;
    fg: Phaser.GameObjects.Rectangle;


    constructor(
        private gameScene: GameScene,
        private x: number,
        private y: number,
        private width: number,
        private height: number) {

        this.bg = this.gameScene.add.rectangle(x, y, width, height, 0x000000).setDepth(16);
        this.fg = this.gameScene.add.rectangle(x  - width / 2 | 0, y, width - 2, height - 2, 0x00FF00).setOrigin(0, 0.5).setDepth(16);

    }

    update(x: number, y: number, percent: number) {
        this.bg.setPosition(x, y);
        this.fg.setPosition(x - this.width / 2 + 1 | 0 , y);
        this.fg.setSize(Math.max(0, this.width * percent - 2), this.height - 2);
    }

    free() {
        this.fg.destroy();
        this.bg.destroy();
    }

}
