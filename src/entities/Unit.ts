import Phaser from "phaser";
import {Pathfinding} from "../model/HexMap.js";
import type GameTile from "../model/GameTile.js";
import type GameScene from "../scenes/GameScene.js";
import type {UnitStat} from "./UnitsStats.js";
import Vector2 = Phaser.Math.Vector2;
import Graphics = Phaser.GameObjects.Graphics;
import GetLineToCircle = Phaser.Geom.Intersects.GetLineToCircle;
import Line = Phaser.Geom.Line;
import Circle = Phaser.Geom.Circle;
import type Player from "../model/player/Player.js";
import type {Navigation} from "../model/navigation/Navigation.js";
import type Systems from "../model/Systems.js";
import HealthBar from "./HealthBar.js";

type Direction = "up" | "down" | "left" | "right";

export default class Unit extends Phaser.Physics.Arcade.Sprite {
    /** Distance in pixels within which a navigation point (hex center) counts as reached */
    static readonly ARRIVAL_DISTANCE = 5;

    static AnimationKeys = {
        IDLE_: "unit-idle-",
        ATTACK_: "unit-attack-",
        WALK_: "unit-walk-",
        DIE_: "unit-die-",
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

    /** Stable id used by commands to reference this unit */
    readonly id: number;
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
    player: Player;
    navigation: Navigation;
    attackCoolDown = 0;
    destination: GameTile | null = null;

    stat: UnitStat;
    moving = false;
    attackAnimationPlaying = false;
    systems: Systems;
    private healthBar: HealthBar;

    constructor(systems: Systems, x: number, y: number, texture: string, stat: UnitStat, player: Player, free: (unit: Unit) => Promise<void>) {
        super(systems.gameScene, x, y, texture);
        this.systems = systems;
        this.id = systems.nextUnitId();
        this.scene = systems.gameScene;
        this.stat = stat;
        this.free = free;
        this.player = player;
        this.navigation = systems.navigation;
        this.scene.add.existing(this);
        this.scene.physics.add.existing(this);
        this.setDepth(2);
        this.pathfinding = Pathfinding.GROUND;
        if (this.stat.flying) {
            this.pathfinding += Pathfinding.HIGH_GROUND + Pathfinding.WATER;
        }
        this.setupGraphics();
        this.setOrigin(0.5, 0.8);
        this.setCircle(this.radius, this.width / 2 - this.radius, this.height - this.radius - 20);
        this.currentHealth = this.stat.health * this.stat.squadSize;
        this.generateAnimations();
        this.setupHealthBar();
        this.play(Unit.AnimationKeys.IDLE_DOWN, true);
    }

    setupHealthBar() {
        this.healthBar = new HealthBar(this.scene, this.x, this.y - 50, 70, 10);
    }

    setupGraphics() {
        this.graphics = this.scene.add.graphics();
        this.graphics.lineStyle(3, 0xff0000, 1);
        this.selectedGraphics = this.scene.add.graphics();
    }

    get pos(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    /**
     * Set navigation points, optionally sets the target if it is a unit
     * @param points
     * @param target
     */
    private setNav(points: Vector2[], target: Unit | null = null): void {
        // The first point is the center of the tile the unit is on. Units must never stop between hex centers,
        // so if there is nowhere else to go (already at the destination, target already in range, or no path)
        // the unit still walks back to the center of its current hex.
        this.navPoints = points.slice(1);
        if (this.navPoints.length === 0 && !this.isAtTileCenter()) {
            this.navPoints = [this.tileCenter()];
        }
        this.body.stop();
        this.moving = this.navPoints.length > 0;
        // When we can target?
        // 1. We have a target
        // 2. That is not the same unit
        // 3. Which can attack
        // 4. If not airborne we can attack
        // 5. And if the target is airborne the unit also can attack air
        if (target && this.canAttack(target)) {
            this.target = target;
        } else {
            this.target = null;
        }
    }

    gameTile(): GameTile {
        return this.systems.pointToTile(this.x, this.y)!;
    }

    /** Center of the hex the unit is currently on */
    tileCenter(): Vector2 {
        return this.systems.hexToPos(this.gameTile().hex);
    }

    isAtTileCenter(): boolean {
        return this.pos.distance(this.tileCenter()) < Unit.ARRIVAL_DISTANCE;
    }

    /** Standing still on a hex center, the only state in which a unit may attack */
    isStationaryAtCenter(): boolean {
        return !this.moving && this.navPoints.length === 0 && this.isAtTileCenter();
    }

    takeDamage(unit: Unit) {
        switch (this.stat.type) {
            case "aircraft":
                this.currentHealth -= unit.stat.damageAgainstAir * unit.stat.squadSize;
                break;
            case "infantry":
                this.currentHealth -= unit.stat.damageAgainstInfantry * unit.stat.squadSize;
                break;
            case "vehicle":
                this.currentHealth -= unit.stat.damageAgainstVehicle * unit.stat.squadSize;
                break;
        }
        console.log("Remaining health", this.currentHealth);
        if (this.currentHealth <= 0) {
            unit.target = null;
            this.free(this);
        }
    }

    stopUnit() {
        this.navPoints = [];
        this.graphics.clear();
        this.selectedGraphics.clear();
        this.body.stop();
        this.moving = false;
        this.target = null;
        this.destination = null;
    }

    prepForDestroy(): Promise<void> {
        this.stopUnit();
        this.healthBar.free();
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

    /** Drops the order and target, but keeps walking until the center of the current hex is reached */
    stopUnitWhenHexCenterIsReached() {
        this.setNav([], null);
        this.destination = this.moving ? this.gameTile() : null;
    }

    update(delta: number) {
        if (this.markedForDeletion) {
            return;
        }
        if (this.target && (!this.canAttack(this.target) || !this.player.visibleEnemyUnits.includes(this.target))) {
            this.stopUnitWhenHexCenterIsReached();
            this.attackAnimationPlaying = false;
        }
        if (!this.target && this.stat.canAttack && this.isStationaryAtCenter()) {
            this.target = this.player.visibleEnemyUnits.find(enemy => this.canAttack(enemy) && this.inAttackRange(enemy)) || null;
        }
        // Chasing a target that is already in range from the current hex: finish the path at this hex's center
        // instead of walking further, the attack itself starts once the center is reached.
        if (this.target && this.navPoints.length > 0 && this.inAttackRange(this.target)) {
            const center = this.tileCenter();
            if (this.navPoints.length > 1 || this.navPoints[0].distance(center) >= 1) {
                this.navPoints = [center];
                this.destination = this.gameTile();
            }
        }
        this.playAnimation();
        if (this.navPoints.length > 0) {
            // Never overshoot a center in one step, even on a long frame
            const arrival = Math.max(Unit.ARRIVAL_DISTANCE, (this.stat.speed * delta) / 1000);
            if (this.pos.distance(this.navPoints[0]) < arrival) {
                const reached = this.navPoints.shift()!;
                if (this.navPoints.length === 0) {
                    // Snap exactly onto the hex center
                    this.setPosition(reached.x, reached.y);
                    this.body.stop();
                    this.graphics.clear();
                    this.moving = false;
                    this.destination = null;
                }
            } else {
                this.moving = true;
                this.scene.physics.moveTo(this, this.navPoints[0].x, this.navPoints[0].y, this.stat.speed);
            }
        }
        if (this.player === this.systems.player1) {
            this.drawPath();
            this.selectedGraphics.clear();
            if (this.selected) {
                this.drawSelectionRing();
            }
        }
        if (this.attackCoolDown > 0) {
            this.attackCoolDown = Math.max(0, this.attackCoolDown - delta);
        }
        this.healthBar.update(this.x, this.y - 100, this.currentHealth / this.stat.health / this.stat.squadSize);
    }

    canAttack(target: Unit): boolean {
        return (
            target !== this &&
            target.player !== this.player &&
            !target.markedForDeletion &&
            this.stat.canAttack &&
            (target.stat.type !== "aircraft" || this.stat.canAttackAir)
        );
    }

    private inAttackRange(target: Unit): boolean {
        return (
            target.gameTile().distance(this.gameTile()) <= this.stat.attackRange && this.navigation.checkBlockade(this.gameTile(), target.gameTile())
        );
    }

    attackTarget() {
        if (this.target && this.canAttack(this.target) && this.isStationaryAtCenter() && this.inAttackRange(this.target)) {
            this.target.takeDamage(this);
            this.attackCoolDown = this.stat.rateOfFire * 1000;
            this.attackAnimationPlaying = true;
        }
    }

    playAnimation() {
        const velocity = this.body.velocity;
        if (velocity.length() === 0) {
            if (this.target && this.attackCoolDown === 0 && this.isStationaryAtCenter() && this.inAttackRange(this.target)) {
                if (this.target.pos.x <= this.pos.x) {
                    this.play(Unit.AnimationKeys.ATTACK_LEFT, true);
                    this.lastDirection = "left";
                } else {
                    this.play(Unit.AnimationKeys.ATTACK_RIGHT, true);
                    this.lastDirection = "right";
                }
                this.attackTarget();
            } else {
                if (!this.attackAnimationPlaying) {
                    this.play(Unit.AnimationKeys.IDLE_ + this.lastDirection, true);
                }
            }
        } else if (Math.abs(velocity.x) > Math.abs(velocity.y)) {
            this.attackAnimationPlaying = false;
            if (velocity.x < 0) {
                this.play(Unit.AnimationKeys.WALK_LEFT, true);
                this.lastDirection = "left";
            } else {
                this.play(Unit.AnimationKeys.WALK_RIGHT, true);
                this.lastDirection = "right";
            }
        } else {
            this.attackAnimationPlaying = false;
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
        this.selectedGraphics.lineStyle(5, 0xffffff, 1);
        this.selectedGraphics.strokeCircle(this.x, this.y, this.radius);
    }

    drawPath() {
        this.graphics.clear();
        // If there is nothing, of we are half on the tile dont draw anymore
        if (
            (this.navPoints.length === 0 && !this.target) ||
            (this.selected && this.navPoints.length === 1 && this.pos.distance(this.navPoints[0]) < this.radius && !this.target)
        ) {
            return;
        }
        if (this.navPoints.length === 0 && this.target) {
            this.graphics.lineStyle(3, 0xff0000, 1);
            const curve = new Phaser.Curves.Path(this.x, this.y);
            curve.add(new Phaser.Curves.Line(this.pos, this.target.pos));
            curve.draw(this.graphics, 64);
            this.graphics.stroke();
            return;
        }
        this.graphics.lineStyle(3, 0xffffff, 1);
        const curve = new Phaser.Curves.Path(this.x, this.y);
        let origin: Vector2;
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
                    GetLineToCircle(
                        new Line(points[i + 1].x, points[i + 1].y, point2.x, point2.y),
                        new Circle(this.pos.x, this.pos.y, this.radius),
                        out
                    );
                    if (out[0]) point1 = new Vector2(Math.round(out[0].x), Math.round(out[0].y));
                    i++;
                }
            }
            curve.add(new Phaser.Curves.Line(point1, point2));
        }
        curve.draw(this.graphics, 64);
        this.graphics.stroke();
    }

    setActivelyVisible(visible: boolean) {
        this.setVisible(visible);
        this.healthBar.setActivelyVisible(visible);
    }

    generateAnimations() {
        this.anims.create({
            key: Unit.AnimationKeys.IDLE_DOWN,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [0, 1, 2, 3]}),
            frameRate: 5,
            repeat: -1,
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_DOWN,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [4, 5, 6, 7]}),
            frameRate: 5,
            repeat: -1,
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
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.IDLE_UP,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [16, 17, 18, 19]}),
            frameRate: 5,
            repeat: -1,
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_UP,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [20, 21, 22, 23]}),
            frameRate: 5,
            repeat: -1,
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
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.IDLE_LEFT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [32, 33, 34, 35]}),
            frameRate: 5,
            repeat: -1,
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_LEFT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [36, 37, 38, 39]}),
            frameRate: 5,
            repeat: -1,
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
            repeat: 0,
        });

        this.anims.create({
            key: Unit.AnimationKeys.IDLE_RIGHT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [48, 49, 50, 51]}),
            frameRate: 5,
            repeat: -1,
        });

        this.anims.create({
            key: Unit.AnimationKeys.WALK_RIGHT,
            frames: this.anims.generateFrameNames(this.stat.texture, {frames: [52, 53, 54, 55]}),
            frameRate: 5,
            repeat: -1,
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
            repeat: 0,
        });

        this.on("animationcomplete", e => {
            if (e.key.includes(Unit.AnimationKeys.ATTACK_)) {
                this.attackAnimationPlaying = false;
                this.play(Unit.AnimationKeys.IDLE_DOWN, true);
            }
        });
    }

    moveToGameTile(gameTile: GameTile | null = null, target: Unit | null = null) {
        if (this.markedForDeletion) return;
        if (target && !this.canAttack(target)) target = null;
        const dynamicObstacles: GameTile[] = [];
        for (const enemyUnit of this.player.visibleEnemyUnits) {
            if (this.stat.flying === enemyUnit.stat.flying && enemyUnit !== target) {
                dynamicObstacles.push(enemyUnit.gameTile());
            }
        }
        const end = target ? target.gameTile() : gameTile || this.gameTile();
        const path = this.systems.navigation.findPathAsVector2(
            this.gameTile(),
            end,
            this.pathfinding,
            target ? this.stat.attackRange : 0,
            dynamicObstacles
        );
        this.setNav(path, target);
        this.destination =
            this.navPoints.length > 0
                ? this.systems.pointToTile(this.navPoints[this.navPoints.length - 1].x, this.navPoints[this.navPoints.length - 1].y) || null
                : null;
    }
}
