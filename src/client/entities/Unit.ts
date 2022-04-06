import Phaser from "phaser";
import {Images} from "../scenes/PreloadScene";
import {Pathfinding} from "../model/HexMap";
import Vector2 = Phaser.Math.Vector2;
import Graphics = Phaser.GameObjects.Graphics;

export enum AnimationKeys {
    IDLE = "unit-idle",
    WALK = "unit-walk",
    ATTACK = "unit-attack",
    DIE = "unit-die"
}

export default class Unit extends Phaser.Physics.Arcade.Sprite {

    navPoints: Vector2[] = [];
    graphics: Graphics;
    scene: Phaser.Scene;
    pathfinding: Pathfinding;

    constructor(scene: Phaser.Scene, x: number, y: number) {
        super(scene, x, y, Images.GUARD);
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.pathfinding = Pathfinding.GROUND;
        this.scene = scene;
        this.setupGraphics();
        this.setOrigin(0.5, 0.8);
        this.setCircle(35, this.width / 2 - 35, this.height - 65);
        this.generateAnimations();
    }

    setupGraphics()  {
        this.graphics = this.scene.add.graphics();
        this.graphics.lineStyle(3, 0xFF0000, 1);
    }

    get pos(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    setNav(points: Vector2[]): void {
        this.navPoints = points.slice(1);
    }

    move() {
        if (this.navPoints.length > 0) {
            if (this.pos.distance(this.navPoints[0]) < 10) {
                this.navPoints.shift();
                if (this.navPoints.length === 0) {
                    this.body.stop();
                    this.play(AnimationKeys.IDLE, true);
                    this.graphics.clear();
                }
            } else {
                this.scene.physics.moveTo(this, this.navPoints[0].x, this.navPoints[0].y, 200);
                this.play(AnimationKeys.WALK, true);
            }
        }
        this.drawPath();
    }

    drawPath() {
        if (this.navPoints.length === 0) {
            return;
        }
        this.graphics.clear();
        this.graphics.lineStyle(3, 0xFF0000, 1);
        const curve = new Phaser.Curves.Path(this.x, this.y);
        const points = [this.pos, ...this.navPoints];
        for (let i = 0; i < points.length - 1; i++) {
            curve.add(new Phaser.Curves.Line(points[i], points[i+1]));
        }
        curve.draw(this.graphics, 64);
        this.graphics.stroke();
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
