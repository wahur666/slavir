import Phaser from "phaser";
import {Pathfinding} from "../model/HexMap";
import Vector2 = Phaser.Math.Vector2;
import Graphics = Phaser.GameObjects.Graphics;
import GetLineToCircle = Phaser.Geom.Intersects.GetLineToCircle;
import Line = Phaser.Geom.Line;
import Circle = Phaser.Geom.Circle;
import type GameTile from "../model/GameTile";
import type GameScene from "../scenes/GameScene";
import type {UnitStat} from "./UnitsStats";

type Direction = "up" | "down" | "left" | "right";


export default class Unit extends Phaser.Physics.Arcade.Sprite {

    static AnimationKeys = {
        IDLE_DOWN: "unit-idle-down",
        WALK_DOWN: "unit-walk-down",
        ATTACK_DOWN: "unit-attack-down",
        DIE_DOWN: "unit-die-down",
        IDLE_UP: "unit-idle-up",
        WALK_UP: "unit-walk-up",
        ATTACK_UP: "unit-attack-up",
        DIE_UP: "unit-die-up",
        IDLE_LEFT: "unit-idle-left",
        WALK_LEFT: "unit-walk-left",
        ATTACK_LEFT: "unit-attack-left",
        DIE_LEFT: "unit-die-left",
        IDLE_RIGHT: "unit-idle-right",
        WALK_RIGHT: "unit-walk-right",
        ATTACK_RIGHT: "unit-attack-right",
        DIE_RIGHT: "unit-die-right",
    };

    navPoints: Vector2[] = [];
    graphics: Graphics;
    selectedGraphics: Graphics;
    scene: GameScene;
    pathfinding: Pathfinding;
    selected = false;
    radius = 35;
    lastDirection: Direction = "down";
    target: Unit | null;
    currentHealth: number;
    free: (unit: Unit) => void;
    markedForDeletion = false;

    stat: UnitStat;
    moving = false;

    constructor(scene: GameScene, x: number, y: number, texture: string, stat: UnitStat, free: (unit: Unit) => void) {
        super(scene, x, y, texture);
        this.stat = stat;
        this.free = free;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDepth(2);
        this.pathfinding = Pathfinding.GROUND;
        this.scene = scene;
        this.setupGraphics();
        this.setOrigin(0.5, 0.8);
        this.setCircle(this.radius, this.width / 2 - this.radius, this.height - this.radius - 20);
        this.currentHealth = this.stat.health;
        this.generateAnimations();
        this.play(Unit.AnimationKeys.IDLE_DOWN, true);
    }

    setupGraphics() {
        this.graphics = this.scene.add.graphics();
        this.graphics.lineStyle(3, 0xFF0000, 1);
        this.selectedGraphics = this.scene.add.graphics();
    }

    get pos(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    setNav(points: Vector2[], target: Unit | null = null): void {
        if (points.length > 1) {
            this.navPoints = points.slice(1);
        }
        this.target = target;
    }

    gameTile(): GameTile {
        return this.scene.pointToTile(this.x, this.y)!;
    }

    takeDamage(unit: Unit) {
        if (this.stat.armored) {
            this.currentHealth -= unit.stat.damageAgainstHeavyArmor;
        } else {
            this.currentHealth -= unit.stat.damageAgainstLightArmor;
        }
        if (this.currentHealth <= 0) {
            this.free(this);
        }
    }

    prepForDestroy(): Promise<void> {
        this.navPoints = [];
        this.graphics.clear();
        this.selectedGraphics.clear();
        this.body.stop();
        this.moving = false;
        this.markedForDeletion = true;
        this.play("unit-die-" + this.lastDirection);
        return new Promise<void>(resolve => {
            this.on("animationcomplete", e => {
                if ((e.key as string).includes("die")) {
                    this.graphics.destroy();
                    this.selectedGraphics.destroy();
                    resolve();
                }
            });
        });
    }

    update() {
        if (this.markedForDeletion) {
            return;
        }
        this.playAnimation();
        if (this.navPoints.length > 0) {
            if (this.pos.distance(this.navPoints[0]) < 5) {
                this.navPoints.shift();
                if (this.navPoints.length === 0) {
                    this.body.stop();
                    this.graphics.clear();
                    this.moving = false;
                }
            } else {
                this.moving = true;
                this.scene.physics.moveTo(this, this.navPoints[0].x, this.navPoints[0].y, this.stat.speed);
            }
        }
        this.drawPath();
        this.selectedGraphics.clear();
        if (this.selected) {
            this.drawSelectionRing();
        }
        if (!this.moving && this.target) {
            const neighbours = [...this.gameTile().hex.neighbours(), this.gameTile().hex];
            if (!neighbours.find(e => e.equals(this.target!.gameTile().hex))) {
                this.target = null;
            }
        }
    }

    private playAnimation() {
        const velocity = this.body.velocity;
        if (velocity.length() === 0) {
            switch (this.lastDirection) {
                case "up":
                    this.play(Unit.AnimationKeys.IDLE_UP, true);
                    break;
                case "down":
                    this.play(Unit.AnimationKeys.IDLE_DOWN, true);
                    break;
                case "left":
                    this.play(Unit.AnimationKeys.IDLE_LEFT, true);
                    break;
                case "right":
                    this.play(Unit.AnimationKeys.IDLE_RIGHT, true);
                    break;
            }
        } else if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
            if (velocity.x < 0) {
                this.play(Unit.AnimationKeys.WALK_LEFT, true);
                this.lastDirection = "left";
            } else {
                this.play(Unit.AnimationKeys.WALK_RIGHT, true);
                this.lastDirection = "right";
            }
        } else {
            if (velocity.y < 0) {
                this.play(Unit.AnimationKeys.WALK_UP, true);
                this.lastDirection = "up";
            } else {
                this.play(Unit.AnimationKeys.WALK_DOWN, true);
                this.lastDirection = "down";
            }
        }
    }


    drawSelectionRing() {
        this.selectedGraphics.lineStyle(5, 0xFFFFFF, 1);
        this.selectedGraphics.strokeCircle(this.x, this.y, this.radius);
    }

    drawPath() {
        this.graphics.clear();
        // If there is nothing, of we are half on the tile dont draw anymore
        if ((this.navPoints.length === 0 && !this.target) || (this.selected && this.navPoints.length === 1 && this.pos.distance(this.navPoints[0]) < this.radius) && !this.target) {
            return;
        }
        if (this.navPoints.length === 0 && this.target) {
            this.graphics.lineStyle(3, 0xFF0000, 1);
            const curve = new Phaser.Curves.Path(this.x, this.y);
            curve.add(new Phaser.Curves.Line(this.pos, this.target.pos));
            curve.draw(this.graphics, 64);
            this.graphics.stroke();
            return;
        }
        this.graphics.lineStyle(3, 0xFFFFFF, 1);
        const curve = new Phaser.Curves.Path(this.x, this.y);
        let origin;
        // If selected, we draw a circle around the unit, and the line goes from there, else the origin
        if (this.selected) {
            const angle = Phaser.Math.Angle.BetweenPoints(this.pos, this.navPoints[0]);
            origin = new Vector2(this.pos.x + this.radius * Math.cos(angle), this.pos.y + this.radius * Math.sin(angle));
        } else {
            origin = this.pos;
        }
        const points = [origin, ...this.navPoints];
        if (this.target) {
            points.push(this.target.pos);
        }
        for (let i = 0; i < points.length - 1; i++) {
            let point1 = points[i];
            let point2 = points[i + 1];
            if (this.navPoints.length > 1) {
                // If there is 3 points at least, and the unit is selected, we have to check if we are near to the next center,
                // if yes, we modify the drawing not to draw the line between the next center, because it is inside already,
                // rather than we draw a line to the next center, but also account for the selected circle indicator
                // we have to do an intersection check between the circle and the inside center and the next center, then
                // draw the line from the intersection point
                if (this.selected && i === 0 && this.navPoints[0].distance(this.pos) < this.radius) {
                    const out: any[] = [];
                    point2 = points[i + 2];
                    GetLineToCircle(new Line(points[i + 1].x, points[i + 1].y, point2.x, point2.y), new Circle(this.pos.x, this.pos.y, this.radius), out);
                    point1 = new Vector2(Math.round(out[0].x), Math.round(out[0].y));
                    i++;
                }
            }
            curve.add(new Phaser.Curves.Line(point1, point2));
        }
        curve.draw(this.graphics, 64);
        this.graphics.stroke();
    }

    generateAnimations() {
        this.anims.create({
            key: Unit.AnimationKeys.IDLE_DOWN,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [0, 1, 2, 3]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_DOWN,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [4, 5, 6, 7]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.ATTACK_DOWN,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [8, 9, 10, 11]}),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.DIE_DOWN,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [12, 13, 14, 15]}),
            frameRate: 6,
            repeat: 0
        });

        this.anims.create({
            key: Unit.AnimationKeys.IDLE_UP,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [16, 17, 18, 19]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_UP,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [20, 21, 22, 23]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.ATTACK_UP,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [24, 25, 26, 27]}),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.DIE_UP,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [28, 29, 30, 31]}),
            frameRate: 6,
            repeat: 0
        });

        this.anims.create({
            key: Unit.AnimationKeys.IDLE_LEFT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [32, 33, 34, 35]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_LEFT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [36, 37, 38, 39]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.ATTACK_LEFT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [40, 41, 42, 43]}),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.DIE_LEFT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [44, 45, 46, 47]}),
            frameRate: 6,
            repeat: 0
        });

        this.anims.create({
            key: Unit.AnimationKeys.IDLE_RIGHT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [48, 49, 50, 51]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_RIGHT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [52, 53, 54, 55]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.ATTACK_RIGHT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [56, 57, 58, 59]}),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.DIE_RIGHT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [60, 61, 62, 63]}),
            frameRate: 6,
            repeat: 0
        });

        this.on("animationcomplete", e => {
            if (e.key === Unit.AnimationKeys.ATTACK_DOWN) {
                this.play(Unit.AnimationKeys.IDLE_DOWN, true);
            }
        });
    }

}
