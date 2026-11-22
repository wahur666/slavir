import type Phaser from "phaser";
import Unit, {type ShotTarget} from "../Unit.js";
import {Buildings} from "../Building.js";
import {UnitName, type UnitStat} from "../UnitsStats.js";
import type Systems from "../../model/Systems.js";
import type Player from "../../model/player/Player.js";
import HealthBar from "../HealthBar.js";
import {TRACER, fireShotEffect} from "../ShotEffect.js";

/** Lifespan bar color */
const LIFE_COLOR = 0xffd24a;
/** The map is seen at an angle, rings on the ground are flattened by this factor */
const GROUND_FLATTEN = 0.4;

/**
 * Commander power: a gun emplacement dropped on a hex. 60 damage against everything (air included) every 0.5s.
 * It takes {@link DEPLOY_TIME} to deploy (it can be shot meanwhile but does not fire), then expires after
 * {@link LIFESPAN}. It never moves, cannot be selected or ordered, and does not count towards the unit cap.
 * Units hit it with their damage against structures (`damageAgainstBase`).
 */
export default class Turret extends Unit {
    static readonly DEPLOY_TIME = 1330;
    static readonly LIFESPAN = 20_000;
    static readonly SCALE = 1;

    static readonly stat: UnitStat = {
        attackRange: 1,
        // Not built from a card; the castle always exists
        building: Buildings.CASTLE,
        canAttack: true,
        canAttackAir: true,
        className: Turret,
        cost: 40,
        damageAgainstAir: 60,
        damageAgainstBase: 0,
        damageAgainstInfantry: 60,
        damageAgainstHarvester: 60,
        damageAgainstVehicle: 60,
        flying: false,
        goodAgainstInfantry: true,
        goodAgainstFactory: false,
        goodAgainstAir: true,
        health: 2400,
        limit: -1,
        rateOfFire: 0.5,
        reference: "Turret",
        speed: 0,
        squadSize: 1,
        texture: UnitName.Turret,
        type: "structure",
        visionRadius: 1,
    };

    /** ms left until the turret is deployed and starts firing */
    deployLeft = Turret.DEPLOY_TIME;
    /** ms left until it expires, counted once deployed */
    lifeLeft = Turret.LIFESPAN;
    private lifeBar: HealthBar;
    private deployGraphics: Phaser.GameObjects.Graphics;

    constructor(systems: Systems, x: number, y: number, texture: string, stat: UnitStat, player: Player, free: (unit: Unit) => void) {
        super(systems, x, y, texture, stat, player, free);
        this.lifeBar = new HealthBar(this.scene, x, y, 56, 6, LIFE_COLOR);
        this.deployGraphics = this.scene.add.graphics().setDepth(1.5);
        this.renderDeploy();
    }

    /** The sheet differs per side (accent color), so the frames come from the sprite's own texture */
    generateAnimations(sprite: Phaser.GameObjects.Sprite) {
        const key = sprite.texture.key;
        const rows = ["idle-down", "walk-down", "attack-down", "die-down", "idle-up", "walk-up", "attack-up", "die-up"];
        rows.push("idle-left", "walk-left", "attack-left", "die-left", "idle-right", "walk-right", "attack-right", "die-right");
        rows.forEach((name, row) => {
            const kind = name.split("-")[0];
            sprite.anims.create({
                key: `unit-${name}`,
                frames: sprite.anims.generateFrameNumbers(key, {frames: [0, 1, 2, 3].map(frame => row * 4 + frame)}),
                frameRate: kind === "attack" ? 12 : kind === "die" ? 6 : 3,
                repeat: kind === "attack" || kind === "die" ? 0 : -1,
            });
        });
    }

    get deployed(): boolean {
        return this.deployLeft <= 0;
    }

    canAttack(target: Unit): boolean {
        return this.deployed && super.canAttack(target);
    }

    update(delta: number) {
        if (!this.markedForDeletion) {
            if (!this.deployed) {
                this.deployLeft = Math.max(0, this.deployLeft - delta);
            } else {
                this.lifeLeft = Math.max(0, this.lifeLeft - delta);
                if (this.lifeLeft === 0) {
                    this.player.expireStructure(this);
                }
            }
        }
        super.update(delta);
        if (this.markedForDeletion) return;
        this.renderDeploy();
        this.lifeBar.update(this.x, this.y - 88, this.lifeLeft / Turret.LIFESPAN);
    }

    /** Rises out of the ground inside a closing ring while deploying; drawn from simulation time so it keeps pace in replays */
    private renderDeploy() {
        const progress = 1 - this.deployLeft / Turret.DEPLOY_TIME;
        const eased = 1 - (1 - progress) ** 3;
        this.setScale(Turret.SCALE, Turret.SCALE * (0.15 + 0.85 * eased));
        this.setAlpha(0.5 + 0.5 * eased);
        this.deployGraphics.clear();
        if (this.deployed) return;
        const radius = 46 - 16 * progress;
        this.deployGraphics.lineStyle(3, 0xffd24a, 0.9);
        this.deployGraphics.beginPath();
        this.deployGraphics.arc(this.x, this.y, radius, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2, false);
        this.deployGraphics.strokePath();
        // The arc is drawn round, flattened to lie on the ground
        this.deployGraphics.setScale(1, GROUND_FLATTEN).setY(this.y * (1 - GROUND_FLATTEN));
        this.deployGraphics.fillStyle(0xffd24a, 0.15 + 0.15 * Math.sin(progress * Math.PI * 6));
        this.deployGraphics.fillCircle(this.x, this.y, radius);
    }

    protected playShotEffect(target: ShotTarget, _volley: unknown, from: Phaser.GameObjects.Sprite = this) {
        fireShotEffect(this.scene, from.x, from.y - 30, target.x, target.y - 20, this.visible || target.visible, TRACER);
    }

    setActivelyVisible(visible: boolean) {
        super.setActivelyVisible(visible);
        this.lifeBar?.setActivelyVisible(visible);
        this.deployGraphics?.setVisible(visible);
    }

    prepForDestroy(onRemoved: () => void): void {
        this.lifeBar.free();
        this.deployGraphics.destroy();
        this.setScale(Turret.SCALE).setAlpha(1);
        super.prepForDestroy(onRemoved);
    }
}
