import Phaser from "phaser";
import {Images} from "../scenes/PreloadScene";

export enum AnimationKeys {
    IDLE = "unit-idle",
    WALK = "unit-walk",
    ATTACK = "unit-attack",
    DIE = "unit-die"
}

export default class Unit extends Phaser.Physics.Arcade.Sprite {

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, Images.GUARD);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setOrigin(0.5, 0.8);
        this.setCircle(35, this.width / 2 - 35, this.height - 65);
        this.generateAnimations();
    }

    generateAnimations() {
        this.anims.create({
            key: AnimationKeys.IDLE,
            frames: this.anims.generateFrameNames(Images.GUARD, {frames: [0, 1, 2, 3]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: AnimationKeys.WALK,
            frames: this.anims.generateFrameNames(Images.GUARD, {frames: [4, 5, 6, 7]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: AnimationKeys.ATTACK,
            frames: this.anims.generateFrameNames(Images.GUARD, {frames: [8, 9, 10, 11]}),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: AnimationKeys.DIE,
            frames: this.anims.generateFrameNames(Images.GUARD, {frames: [12, 13, 14, 15]}),
            frameRate: 4,
            repeat: -1
        });

        this.on("animationcomplete", e => {
            if (e.key === AnimationKeys.ATTACK) {
                this.play(AnimationKeys.IDLE, true);
            }
        });
    }

}
