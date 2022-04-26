import Phaser from "phaser";
import {Pathfinding} from "../model/HexMap";
import Vector2 = Phaser.Math.Vector2;
import Graphics = Phaser.GameObjects.Graphics;
import GetLineToCircle = Phaser.Geom.Intersects.GetLineToCircle;
import Line = Phaser.Geom.Line;
import Circle = Phaser.Geom.Circle;


export default class Unit extends Phaser.Physics.Arcade.Sprite {

    static AnimationKeys = {
        IDLE: "unit-idle",
        WALK: "unit-walk",
        ATTACK: "unit-attack",
        DIE: "unit-die"
    };

    navPoints: Vector2[] = [];
    graphics: Graphics;
    selectedGraphics: Graphics;
    scene: Phaser.Scene;
    pathfinding: Pathfinding;
    selected = false;
    radius = 35;

    speed = 150;
    flying: boolean;
    levitating: boolean;
    canAttackAir: boolean;
    canAttackGround: boolean;
    canShootOverObstacle: boolean;
    hp: number;
    damageAgainstLightArmor: number;
    damageAgainstHeavyArmor: number;
    damageAgainstAir: number;
    cost: number;
    textureName: string;
    visionRadius = 2;

    constructor(scene: Phaser.Scene, x: number, y: number, texture: string, stats: any) {
        super(scene, x, y, texture);
        this.textureName = texture;
        scene.add.existing(this);
        scene.physics.add.existing(this);
        this.setDepth(2);
        this.pathfinding = Pathfinding.GROUND;
        this.scene = scene;
        this.setupGraphics();
        this.setOrigin(0.5, 0.8);
        this.setCircle(this.radius, this.width / 2 - this.radius, this.height - this.radius - 20);
        this.generateAnimations();
    }

    setupGraphics() {
        this.graphics = this.scene.add.graphics();
        this.graphics.lineStyle(3, 0xFF0000, 1);
        this.selectedGraphics = this.scene.add.graphics();
    }

    get pos(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    setNav(points: Vector2[]): void {
        if (points.length > 1) {
            this.navPoints = points.slice(1);
        }
    }

    update() {
        if (this.navPoints.length > 0) {
            if (this.pos.distance(this.navPoints[0]) < 5) {
                this.navPoints.shift();
                if (this.navPoints.length === 0) {
                    this.body.stop();
                    this.play(Unit.AnimationKeys.IDLE, true);
                    this.graphics.clear();
                }
            } else {
                this.scene.physics.moveTo(this, this.navPoints[0].x, this.navPoints[0].y, this.speed);
                this.play(Unit.AnimationKeys.WALK, true);
            }
        }
        this.drawPath();
        this.selectedGraphics.clear();
        if (this.selected) {
            this.drawSelectionRing();
        }
    }

    pointInCircle(point: Vector2): boolean {
        return this.pos.distance(point) < this.radius;
    }

    drawSelectionRing() {
        this.selectedGraphics.lineStyle(5, 0xFFFFFF, 1);
        this.selectedGraphics.strokeCircle(this.x, this.y, this.radius);
    }

    drawPath() {
        this.graphics.clear();
        // If there is nothing, of we are half on the tile dont draw anymore
        if (this.navPoints.length === 0 || (this.selected && this.navPoints.length === 1 && this.pos.distance(this.navPoints[0]) < this.radius)) {
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
            key: Unit.AnimationKeys.IDLE,
            frames: this.anims.generateFrameNames(this.textureName, {frames: [0, 1, 2, 3]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK,
            frames: this.anims.generateFrameNames(this.textureName, {frames: [4, 5, 6, 7]}),
            frameRate: 5,
            repeat: -1
        });

        this.anims.create({
            key: Unit.AnimationKeys.ATTACK,
            frames: this.anims.generateFrameNames(this.textureName, {frames: [8, 9, 10, 11]}),
            frameRate: 8,
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.DIE,
            frames: this.anims.generateFrameNames(this.textureName, {frames: [12, 13, 14, 15]}),
            frameRate: 4,
            repeat: -1
        });

        this.on("animationcomplete", e => {
            if (e.key === Unit.AnimationKeys.ATTACK) {
                this.play(Unit.AnimationKeys.IDLE, true);
            }
        });
    }

}
