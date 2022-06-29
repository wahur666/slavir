import Phaser from "phaser";
import Rectangle = Phaser.Geom.Rectangle;

export default class Card extends Phaser.GameObjects.Sprite {

    graphics: Phaser.GameObjects.Graphics;

    rectHeight = 60;

    areaRect = {
        x: 20,
        y: 0,
        width: -50,
        height: 0
    };

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, private onCLick: () => void) {
        super(scene, x, y, texture, 1);
        scene.add.existing(this);
        this.setDepth(2);
        this.setCrop(28, 0, 100, 100);
        this.graphics = scene.add.graphics();
        const shape = new Rectangle(x-this.width/2 + this.areaRect.x, y-this.rectHeight + this.areaRect.y, this.width + this.areaRect.width, this.rectHeight * 2 + this.areaRect.height);
        this.graphics.fillStyle(0x545454,1);
        this.graphics.fillRectShape(shape);
        this.setInteractive();
        this.input.hitArea.setTo(this.areaRect.x, this.areaRect.y, this.width + this.areaRect.width, this.height+this.areaRect.height);
        // const hitArea = new Rectangle(0, 0, this.width, this.rectHeight * 2 );
        this.on("pointerdown", (ev) => {
            this.onCLick();
            // console.log(ev);
        });

        // this.setInteractive(shape, (ev) => console.log(ev));
    }



}
