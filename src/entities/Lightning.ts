import Phaser from "phaser";
import type GameScene from "../scenes/GameScene";
import {Images} from "../scenes/PreloadScene";
import Vector2 = Phaser.Math.Vector2;

export default class Lightning extends Phaser.GameObjects.Sprite {

    animName = "default";
    size = 256;

    constructor(scene: GameScene, x: number, y: number) {
        super(scene, x, y, Images.LIGHTNING);
        this.visible = false;
        this.scene.add.existing(this);
        this.anims.create({
            key: this.animName,
            frames: this.anims.generateFrameNames(Images.LIGHTNING, {frames: [0, 1, 2, 3]}),
            frameRate: 10,
            repeat: 0
        });
        this.play(this.animName, true);

        this.on("animationcomplete", e => {
            this.visible = false;
        });
    }

    strike(fromPos: Vector2, toPos: Vector2) {
        this.play(this.animName, true);
        this.visible = true;
        this.setPosition((fromPos.x + toPos.x) / 2 | 0, (fromPos.y + toPos.y) / 2 | 0);
        const rot = Math.atan2(fromPos.y - toPos.y, fromPos.x - toPos.x);
        this.setRotation( rot + Math.PI / 2 * Math.sign(rot));
        this.setScale(1, fromPos.distance(toPos) / this.size);
    }



}
