import type Phaser from "phaser";
import type GameScene from "../scenes/GameScene.js";
import type Volley from "./Volley.js";

const PIP_GAP = 2;
const PIP_HEIGHT = 6;
const RELOAD_HEIGHT = 2;
const LOADED_COLOR = 0xffb020;
const SPENT_COLOR = 0x3a3a3a;
const RELOAD_COLOR = 0x6ec6ff;

/** One pip per shot in the magazine, with a thin reload progress line underneath */
export default class AmmoBar {
    private bg: Phaser.GameObjects.Rectangle;
    private pips: Phaser.GameObjects.Rectangle[] = [];
    private reload: Phaser.GameObjects.Rectangle;
    private readonly pipWidth: number;

    constructor(
        private gameScene: GameScene,
        private volley: Volley,
        private width: number
    ) {
        const shots = volley.stat.shots;
        this.pipWidth = (width - 2 - PIP_GAP * (shots - 1)) / shots;
        this.bg = gameScene.add
            .rectangle(0, 0, width, PIP_HEIGHT + RELOAD_HEIGHT + 3, 0x000000)
            .setOrigin(0, 0)
            .setDepth(16);
        for (let i = 0; i < shots; i++) {
            this.pips.push(gameScene.add.rectangle(0, 0, this.pipWidth, PIP_HEIGHT, LOADED_COLOR).setOrigin(0, 0).setDepth(16));
        }
        this.reload = gameScene.add
            .rectangle(0, 0, width - 2, RELOAD_HEIGHT, RELOAD_COLOR)
            .setOrigin(0, 0)
            .setDepth(16);
    }

    /** @param x center, @param y top edge */
    update(x: number, y: number) {
        const left = (x - this.width / 2) | 0;
        this.bg.setPosition(left, y);
        this.pips.forEach((pip, i) => {
            pip.setPosition(left + 1 + i * (this.pipWidth + PIP_GAP), y + 1);
            pip.fillColor = i < this.volley.ammo ? LOADED_COLOR : SPENT_COLOR;
        });
        const reloading = this.volley.reloadLeft > 0;
        this.reload.setPosition(left + 1, y + PIP_HEIGHT + 2);
        this.reload.setSize(Math.max(0, (this.width - 2) * (reloading ? this.volley.reloadProgress : 0)), RELOAD_HEIGHT);
    }

    setActivelyVisible(visible: boolean) {
        this.bg.setVisible(visible);
        this.reload.setVisible(visible);
        for (const pip of this.pips) pip.setVisible(visible);
    }

    free() {
        this.bg.destroy();
        this.reload.destroy();
        for (const pip of this.pips) pip.destroy();
    }
}
