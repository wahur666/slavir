import Phaser from "phaser";
import Rectangle = Phaser.Geom.Rectangle;
import type {UnitStat} from "./UnitsStats";

export default class Card extends Phaser.GameObjects.Sprite {

    graphics: Phaser.GameObjects.Graphics;

    rectHeight = 60;

    areaRect = {
        x: 20,
        y: 0,
        width: -50,
        height: 0
    };

    constructor(scene: Phaser.Scene, x: number, y: number, unitStat: UnitStat, private onCLick: () => void) {
        super(scene, x, y, unitStat.texture, 1);
        scene.add.existing(this);
        this.setDepth(2);
        this.setCrop(28, 0, 72, 100);
        this.setOrigin(0.54, 0.58);
        this.graphics = scene.add.graphics();
        const shape = new Rectangle(x - this.width / 2 + this.areaRect.x, y - this.rectHeight + this.areaRect.y, this.width + this.areaRect.width, this.rectHeight * 2 + this.areaRect.height);
        this.graphics.fillStyle(0x545454, 1);
        this.graphics.fillRectShape(shape);
        this.setInteractive(new Rectangle(this.areaRect.x, this.areaRect.y, this.width + this.areaRect.width, this.height + this.areaRect.height), Phaser.Geom.Rectangle.Contains);
        this.on("pointerdown", (ev) => this.onCLick());
    }


}
