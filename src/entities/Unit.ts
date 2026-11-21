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
import Volley from "./Volley.js";
import AmmoBar from "./AmmoBar.js";
import {fireShotEffect} from "./ShotEffect.js";
import {aliveMembers, damagePerMember, formationOffsets, maxSquadHealth, shootingMembers, squadVolleyStat} from "./Squad.js";
import {canEnter, canPark, enemyHolding, freeTilesNear, isFreeEndTile, sameLayer} from "../model/navigation/Occupancy.js";

type Direction = "up" | "down" | "left" | "right";

export default class Unit extends Phaser.Physics.Arcade.Sprite {
    /** Distance in pixels within which a navigation point (hex center) counts as reached */
    static readonly ARRIVAL_DISTANCE = 5;
    /** Sprite scale of squad members, so a whole squad fits on one hex */
    static readonly SQUAD_SCALE = 0.55;
    /** Distance of the squad members from the leader, in pixels */
    static readonly SQUAD_FORMATION_RADIUS = 26;
    /** ms between two path recalculations while chasing a target or walking a blocked path */
    static readonly REPATH_INTERVAL = 250;
    /** How far (in hexes) a unit looks for a free hex when its end hex is taken */
    static readonly FREE_TILE_RADIUS = 4;
    /** ms an enemy is left alone after the unit found no room to attack it from */
    static readonly GIVE_UP_TIME = 5000;

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
    /** Ordered (or auto-acquired) target, which the unit chases */
    target: Unit | null;
    /** The unit the weapon is aimed at this frame, see {@link findFireTarget} */
    fireTarget: Unit | null = null;
    currentHealth: number;
    free: (unit: Unit) => void;
    markedForDeletion = false;
    player: Player;
    navigation: Navigation;
    /** The hex the unit is heading to, null when it is not moving */
    destination: GameTile | null = null;
    /**
     * The hex the unit holds, enemies of the same layer cannot enter it (see Occupancy).
     * Same as {@link gameTile} except while the unit bounces back from a hex held by an enemy.
     */
    claimedTile: GameTile;
    /** The ordered move tile, kept to find a new path after a bump or when the path gets blocked */
    goal: GameTile | null = null;
    /** Walking back to {@link claimedTile} after trying to step into a hex held by an enemy */
    retreating = false;
    /** Hexes the unit bumped into because an enemy held them, avoided on the next paths even if that enemy is not visible */
    private bumpedTiles: GameTile[] = [];
    /** Enemies the unit gave up attacking for lack of room around them, with the ms left before it tries again */
    private givenUpTargets = new Map<Unit, number>();
    private repathCoolDown = 0;
    /** ms until the next try to leave a shared hex, after no free hex was found */
    private freeTileCoolDown = 0;
    /** The target's hex when the chase path was planned, a new path is needed once the target leaves it */
    private chaseTile: GameTile | null = null;
    /**
     * The unit stood on a hex center with its target in range, i.e. the fight has started. An engaged unit never chases:
     * once the target leaves its range the attack is dropped and the unit stays where it is.
     */
    private engaged = false;

    stat: UnitStat;
    volley: Volley;
    moving = false;
    attackAnimationPlaying = false;
    systems: Systems;
    private healthBar: HealthBar;
    /** Only for burst-fire units */
    private ammoBar: AmmoBar | null = null;
    /** Living squad members besides the leader (the unit itself), in the order they die (last first) */
    private followers: Phaser.GameObjects.Sprite[] = [];
    /** Members playing their death animation */
    private dyingFollowers: Phaser.GameObjects.Sprite[] = [];
    private formation: {x: number; y: number}[] = [];

    /** Simulation time left until a dying unit is removed, and what to call then; see {@link prepForDestroy} */
    private death: {remaining: number; onRemoved: () => void} | null = null;

    constructor(systems: Systems, x: number, y: number, texture: string, stat: UnitStat, player: Player, free: (unit: Unit) => void) {
        super(systems.gameScene, x, y, texture);
        this.systems = systems;
        this.id = systems.nextUnitId();
        this.scene = systems.gameScene;
        this.stat = stat;
        this.volley = new Volley(squadVolleyStat(stat));
        this.free = free;
        this.player = player;
        this.navigation = systems.navigation;
        this.claimedTile = this.gameTile();
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
        this.currentHealth = maxSquadHealth(this.stat);
        this.generateAnimations(this);
        this.on("animationcomplete", (e: Phaser.Animations.Animation) => {
            if (e.key.includes(Unit.AnimationKeys.ATTACK_)) {
                this.attackAnimationPlaying = false;
                this.play(Unit.AnimationKeys.IDLE_DOWN, true);
            }
        });
        this.setupSquad();
        this.setupHealthBar();
        this.play(Unit.AnimationKeys.IDLE_DOWN, true);
    }

    /** Squads show one sprite per member; the unit itself is the leader, the followers only mirror it */
    private setupSquad() {
        if (this.stat.squadSize <= 1) return;
        this.setScale(Unit.SQUAD_SCALE);
        this.formation = formationOffsets(this.stat.squadSize, Unit.SQUAD_FORMATION_RADIUS);
        for (let i = 1; i < this.stat.squadSize; i++) {
            const follower = this.scene.add.sprite(this.x, this.y, this.texture.key);
            follower.setOrigin(this.originX, this.originY).setScale(Unit.SQUAD_SCALE).setDepth(this.depth);
            this.generateAnimations(follower);
            follower.play(Unit.AnimationKeys.IDLE_DOWN);
            this.followers.push(follower);
        }
        this.updateFollowers();
    }

    /** Living members of the squad, the unit itself included */
    get aliveMembers(): number {
        return aliveMembers(this.currentHealth, this.stat);
    }

    /** Sprite of a squad member, 0 is the leader (the unit itself) */
    private memberSprite(index: number): Phaser.GameObjects.Sprite {
        return index === 0 ? this : this.followers[index - 1];
    }

    /**
     * Keep the followers in formation and in step with the leader's idle and walk animations. Attacks are not mirrored,
     * every member plays its own attack when it shoots, see {@link playAnimation}.
     */
    private updateFollowers() {
        const key = this.anims.currentAnim?.key;
        const leaderAttacking = !!key?.includes(Unit.AnimationKeys.ATTACK_);
        this.followers.forEach((follower, i) => {
            const offset = this.formation[i + 1];
            follower.setPosition(this.x + offset.x, this.y + offset.y);
            // Members behind the leader are drawn below it
            follower.setDepth(this.depth + (offset.y < 0 ? -0.1 : 0.1));
            const followerAttacking = follower.anims.isPlaying && !!follower.anims.currentAnim?.key.includes(Unit.AnimationKeys.ATTACK_);
            if (!key || leaderAttacking || (followerAttacking && (!this.moving || this.stat.fireOnMove))) return;
            if (follower.anims.currentAnim?.key !== key) {
                follower.play(key);
            }
        });
    }

    /** Remove followers until only the living members are left */
    private killFollowers(alive: number) {
        while (this.followers.length > Math.max(0, alive - 1)) {
            const follower = this.followers.pop()!;
            this.dyingFollowers.push(follower);
            follower.play(Unit.AnimationKeys.DIE_ + this.lastDirection);
            follower.once("animationcomplete", () => {
                this.dyingFollowers.splice(this.dyingFollowers.indexOf(follower), 1);
                follower.destroy();
            });
        }
    }

    setupHealthBar() {
        this.healthBar = new HealthBar(this.scene, this.x, this.y - 50, 70, 10);
        // A rotating squad's magazine is its members taking turns, not ammo worth showing
        if (this.volley.stat.shots > 1 && this.stat.squadFire !== "rotating") {
            this.ammoBar = new AmmoBar(this.scene, this.volley, 70);
        }
    }

    /** ms until the weapon can fire again */
    get attackCoolDown(): number {
        return this.volley.coolDown;
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
        // the unit still walks back to the center of the hex it holds.
        this.navPoints = points.slice(1);
        if (this.navPoints.length === 0 && this.pos.distance(this.claimedCenter()) >= Unit.ARRIVAL_DISTANCE) {
            this.navPoints = [this.claimedCenter()];
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

    /** Center of the hex the unit holds */
    claimedCenter(): Vector2 {
        return this.systems.hexToPos(this.claimedTile.hex);
    }

    isAtTileCenter(): boolean {
        return this.pos.distance(this.tileCenter()) < Unit.ARRIVAL_DISTANCE;
    }

    /** Standing on its hex with nowhere to go */
    get parked(): boolean {
        return !this.moving && this.navPoints.length === 0;
    }

    /** Standing still on a hex center, the only state in which a unit may attack */
    isStationaryAtCenter(): boolean {
        return !this.moving && this.navPoints.length === 0 && this.isAtTileCenter();
    }

    /**
     * One shot of the attacker
     * @param unit attacker
     * @param shooters members of the attacker's squad that hit this unit, each deals its per-member damage
     */
    takeDamage(unit: Unit, shooters = unit.aliveMembers) {
        this.currentHealth -= damagePerMember(unit.stat, this.stat) * shooters;
        console.log("Remaining health", this.currentHealth, "members", this.aliveMembers);
        this.killFollowers(this.aliveMembers);
        if (this.currentHealth <= 0) {
            // A fire-on-move unit may have killed a bystander, its chase order stays
            if (unit.target === this) unit.target = null;
            if (unit.fireTarget === this) unit.fireTarget = null;
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
        this.fireTarget = null;
        this.destination = null;
        this.goal = null;
        this.retreating = false;
        this.engaged = false;
    }

    /**
     * Starts the death animation; `onRemoved` is called from {@link update} once the animation's length passed in
     * simulation time. The removal is timed by the simulation, not by the animation, so it happens on the same
     * tick in a replay.
     */
    prepForDestroy(onRemoved: () => void): void {
        this.stopUnit();
        this.healthBar.free();
        this.ammoBar?.free();
        this.killFollowers(0);
        this.markedForDeletion = true;
        this.play("unit-die-" + this.lastDirection);
        this.death = {remaining: this.anims.currentAnim?.duration ?? 1000, onRemoved};
    }

    private updateDeath(delta: number) {
        if (!this.death) return;
        this.death.remaining -= delta;
        if (this.death.remaining > 0) return;
        const {onRemoved} = this.death;
        this.death = null;
        this.graphics.destroy();
        this.selectedGraphics.destroy();
        onRemoved();
    }

    /** Drops the order and target, but keeps walking until the center of the current hex is reached */
    stopUnitWhenHexCenterIsReached() {
        this.setNav([], null);
        this.goal = null;
        this.destination = this.moving ? this.claimedTile : null;
    }

    update(delta: number) {
        if (this.markedForDeletion) {
            this.updateDeath(delta);
            return;
        }
        this.repathCoolDown = Math.max(0, this.repathCoolDown - delta);
        for (const [enemy, left] of this.givenUpTargets) {
            if (left <= delta || enemy.markedForDeletion) this.givenUpTargets.delete(enemy);
            else this.givenUpTargets.set(enemy, left - delta);
        }
        this.updateClaim();
        if (this.target && (!this.canAttack(this.target) || !this.player.visibleEnemyUnits.includes(this.target))) {
            this.stopUnitWhenHexCenterIsReached();
            this.attackAnimationPlaying = false;
        }
        if (!this.target) {
            this.engaged = false;
        } else if (this.engaged && !this.inAttackRange(this.target)) {
            // The target retreated out of range after the fight started: stand still instead of chasing it
            this.stopUnitWhenHexCenterIsReached();
            this.attackAnimationPlaying = false;
            this.engaged = false;
        }
        if (!this.target && this.stat.canAttack && this.isStationaryAtCenter()) {
            // Auto attack an enemy in range, as an order like any other so the command hub knows about it
            const enemy = this.player.visibleEnemyUnits.find(enemy => this.canAttack(enemy) && this.inAttackRange(enemy));
            if (enemy) this.systems.commands.issue({kind: "attack", playerIndex: this.player.index, unitIds: [this.id], targetId: enemy.id});
        }
        // Chasing a target that is already in range from the current hex: finish the path at this hex's center
        // instead of walking further, the attack itself starts once the center is reached.
        // Only where the unit may stop: leaving a hex another unit stands on must not be cut short here.
        if (
            !this.retreating &&
            this.target &&
            this.navPoints.length > 0 &&
            this.inAttackRange(this.target) &&
            canPark(this, this.claimedTile, this.systems.allUnits())
        ) {
            const center = this.claimedCenter();
            if (this.navPoints.length > 1 || this.navPoints[0].distance(center) >= 1) {
                this.navPoints = [center];
                this.destination = this.claimedTile;
            }
        }
        this.leaveSharedTile(delta);
        this.recalculateNavigationIfNeeded();
        this.fireTarget = this.findFireTarget();
        if (this.target && this.fireTarget === this.target && this.isStationaryAtCenter()) this.engaged = true;
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
                    this.arrive();
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
        this.updateVolleys(delta, this.fireTarget);
        this.updateFollowers();
        this.healthBar.update(this.x, this.y - 100, this.currentHealth / maxSquadHealth(this.stat));
        this.ammoBar?.update(this.x, this.y - 94);
    }

    /**
     * The unit the weapon winds up against and fires at, null when there is none.
     * - Normal units: the target, only while standing on a hex center with it in range.
     * - Fire-on-move units: also while driving; the target when in range, otherwise any visible enemy in range.
     */
    private findFireTarget(): Unit | null {
        if (!this.stat.canAttack) return null;
        if (!this.stat.fireOnMove && !this.isStationaryAtCenter()) return null;
        if (this.target && this.canAttack(this.target) && this.inAttackRange(this.target)) return this.target;
        if (!this.stat.fireOnMove) return null;
        return this.player.visibleEnemyUnits.find(enemy => this.canAttack(enemy) && this.inAttackRange(enemy)) ?? null;
    }

    /** The weapon used against the given target; override for units with more than one weapon */
    protected volleyFor(_target: Unit): Volley {
        return this.volley;
    }

    /**
     * Advance every weapon's timers; override together with {@link volleyFor}
     * @param fireTarget the unit the weapon is aimed at, null when not engaged (the wind-up starts over)
     */
    protected updateVolleys(delta: number, fireTarget: Unit | null) {
        this.volley.update(delta, fireTarget !== null);
    }

    /**
     * Visual for a single shot; by default only units with an explicit `volley` stat show a missile
     * @param from the squad member that shoots
     */
    protected playShotEffect(target: Unit, _volley: Volley, from: Phaser.GameObjects.Sprite = this) {
        if (this.stat.volley) {
            fireShotEffect(this.scene, from.x, from.y - 30 * from.scaleY, target.x, target.y - 20, this.visible || target.visible);
        }
    }

    private canFire(): boolean {
        return !!this.fireTarget && this.canAttack(this.fireTarget) && this.volleyFor(this.fireTarget).ready;
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
        return this.inAttackRangeFrom(this.gameTile(), target.gameTile());
    }

    /** Whether the unit could shoot at a unit on `targetTile` while standing on `from` */
    private inAttackRangeFrom(from: GameTile, targetTile: GameTile): boolean {
        return targetTile.distance(from) <= this.stat.attackRange && this.navigation.checkBlockade(from, targetTile);
    }

    /**
     * Fire the next shot if the weapon is ready. A rotating squad still spends the turn of a dead member, without a shot.
     * @returns the squad members that shot
     */
    attackTarget(): number[] {
        if (!this.canFire()) return [];
        const target = this.fireTarget!;
        const volley = this.volleyFor(target);
        const shooters = shootingMembers(this.stat, this.aliveMembers, volley.ammo);
        volley.fire();
        if (shooters.length === 0) return shooters;
        for (const member of shooters) {
            this.playShotEffect(target, volley, this.memberSprite(member));
        }
        if (shooters.includes(0)) {
            this.attackAnimationPlaying = true;
        }
        target.takeDamage(this, shooters.length);
        return shooters;
    }

    playAnimation() {
        const velocity = this.body.velocity;
        // Normal units only get a fire target while standing still, fire-on-move units also while driving
        if (this.canFire()) {
            const target = this.fireTarget!;
            for (const member of this.attackTarget()) {
                const sprite = this.memberSprite(member);
                const direction: Direction = target.x <= sprite.x ? "left" : "right";
                sprite.play(Unit.AnimationKeys.ATTACK_ + direction, member === 0);
                if (member === 0) this.lastDirection = direction;
            }
        }
        if (velocity.length() === 0) {
            if (!this.attackAnimationPlaying) {
                this.play(Unit.AnimationKeys.IDLE_ + this.lastDirection, true);
            }
        } else if (this.attackAnimationPlaying && this.stat.fireOnMove) {
            // Let the attack animation finish while driving on, the walk animation resumes afterwards
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
        this.drawRoute();
        this.drawFireLine();
    }

    /** Red line to the unit a fire-on-move unit shoots at while driving; standing units show theirs in {@link drawRoute} */
    private drawFireLine() {
        if (!this.stat.fireOnMove || !this.fireTarget || this.navPoints.length === 0 || this.fireTarget.markedForDeletion) return;
        this.graphics.lineStyle(3, 0xff0000, 1);
        this.graphics.lineBetween(this.x, this.y, this.fireTarget.x, this.fireTarget.y);
    }

    private drawRoute() {
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
        this.ammoBar?.setActivelyVisible(visible);
        for (const follower of [...this.followers, ...this.dyingFollowers]) follower.setVisible(visible);
    }

    /** Animations are local to each sprite, so every squad member needs its own set */
    generateAnimations(sprite: Phaser.GameObjects.Sprite) {
        sprite.anims.create({
            key: Unit.AnimationKeys.IDLE_DOWN,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [0, 1, 2, 3]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.WALK_DOWN,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [4, 5, 6, 7]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.ATTACK_DOWN,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [8, 9, 10, 11]}),
            frameRate: 8,
            repeat: 0,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.DIE_DOWN,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [12, 13, 14, 15]}),
            frameRate: 6,
            repeat: 0,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.IDLE_UP,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [16, 17, 18, 19]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.WALK_UP,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [20, 21, 22, 23]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.ATTACK_UP,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [24, 25, 26, 27]}),
            frameRate: 8,
            repeat: 0,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.DIE_UP,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [28, 29, 30, 31]}),
            frameRate: 6,
            repeat: 0,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.IDLE_LEFT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [32, 33, 34, 35]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.WALK_LEFT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [36, 37, 38, 39]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.ATTACK_LEFT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [40, 41, 42, 43]}),
            frameRate: 8,
            repeat: 0,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.DIE_LEFT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [44, 45, 46, 47]}),
            frameRate: 6,
            repeat: 0,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.IDLE_RIGHT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [48, 49, 50, 51]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.WALK_RIGHT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [52, 53, 54, 55]}),
            frameRate: 5,
            repeat: -1,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.ATTACK_RIGHT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [56, 57, 58, 59]}),
            frameRate: 8,
            repeat: 0,
        });

        sprite.anims.create({
            key: Unit.AnimationKeys.DIE_RIGHT,
            frames: sprite.anims.generateFrameNames(this.stat.texture, {frames: [60, 61, 62, 63]}),
            frameRate: 6,
            repeat: 0,
        });
    }

    /**
     * New order: walk to a tile, or chase and attack a target. Enemy units of the same layer are walked around,
     * friendly units are walked through. If the end hex is taken the closest free hex is used instead.
     */
    moveToGameTile(gameTile: GameTile | null = null, target: Unit | null = null) {
        if (this.markedForDeletion) return;
        if (target && !this.canAttack(target)) target = null;
        this.goal = target ? null : gameTile;
        this.bumpedTiles = [];
        // A new order starts unengaged, so an ordered target may be chased until it is first in range
        this.engaged = false;
        if (this.retreating) {
            // Finish walking back to the held hex first, the new order is planned from there, see arrive()
            this.target = target;
            return;
        }
        this.navigateTo(gameTile, target);
    }

    /**
     * Claim the hex the unit has just stepped into. A hex held by an enemy of the same layer cannot be entered:
     * the unit bounces back to the hex it came from, and plans a new path from there.
     * @returns false if the unit bounced
     */
    private updateClaim(): boolean {
        if (this.retreating) return true;
        const tile = this.gameTile();
        if (!tile || tile === this.claimedTile) return true;
        if (canEnter(this, tile, this.systems.allUnits())) {
            this.claimedTile = tile;
            return true;
        }
        if (!this.bumpedTiles.includes(tile)) this.bumpedTiles.push(tile);
        this.retreating = true;
        this.body.stop();
        this.navPoints = [this.claimedCenter()];
        this.moving = true;
        this.destination = this.claimedTile;
        return false;
    }

    /** Reached the last navigation point, snapped onto the hex center */
    private arrive() {
        if (!this.updateClaim()) return;
        if (this.retreating) {
            this.retreating = false;
            this.renavigate();
            if (!this.parked) return;
        }
        if (!canPark(this, this.claimedTile, this.systems.allUnits())) {
            // Never stand on the same hex as another unit of the same layer
            this.moveToFreeTile();
            return;
        }
        if (!this.target) this.goal = null;
        this.bumpedTiles = [];
    }

    /** Plan the current order again: the chase of the target, or the walk to the goal */
    private renavigate() {
        if (this.target) {
            this.navigateTo(null, this.target);
        } else if (this.goal) {
            this.navigateTo(this.goal, null);
        }
    }

    /**
     * Keeps the current order up to date:
     * - chasing: a new path once the target left the hex the path was planned for, the path got blocked,
     *   or the unit stands out of range
     * - walking: a new path once an enemy blocks the path
     */
    private recalculateNavigationIfNeeded() {
        if (this.retreating || this.repathCoolDown > 0) return;
        const target = this.target;
        if (target) {
            if (this.inAttackRange(target)) return;
            if (this.parked || target.claimedTile !== this.chaseTile || this.pathBlocked(target)) {
                this.repathCoolDown = Unit.REPATH_INTERVAL;
                this.navigateTo(null, target);
            }
        } else if (this.goal && !this.parked && this.pathBlocked(null)) {
            this.repathCoolDown = Unit.REPATH_INTERVAL;
            this.navigateTo(this.goal, null);
        }
    }

    /** Hexes the unit knows to be held by enemies of its layer: visible enemies, and hexes it bumped into */
    private knownObstacles(target: Unit | null): GameTile[] {
        const tiles = this.player.visibleEnemyUnits
            .filter(enemy => enemy !== target && !enemy.markedForDeletion && sameLayer(this, enemy))
            .map(enemy => enemy.claimedTile);
        const units = this.systems.allUnits();
        for (const tile of this.bumpedTiles) {
            if (tile !== target?.claimedTile && !tiles.includes(tile) && enemyHolding(this, tile, units)) tiles.push(tile);
        }
        return tiles;
    }

    /** Whether the remaining path crosses a hex known to be held by an enemy */
    private pathBlocked(target: Unit | null): boolean {
        const blocked = this.knownObstacles(target);
        if (blocked.length === 0) return false;
        let from = this.claimedTile;
        for (const point of this.navPoints) {
            const to = this.systems.pointToTile(point.x, point.y);
            if (!to) continue;
            if (this.systems.map.getTileHits(from, to).some(hit => hit.tile !== this.claimedTile && blocked.includes(hit.tile))) return true;
            from = to;
        }
        return false;
    }

    private navigateTo(gameTile: GameTile | null, target: Unit | null) {
        const units = this.systems.allUnits();
        const obstacles = this.knownObstacles(target);
        const start = this.claimedTile;
        let path: GameTile[];
        if (target && this.inAttackRangeFrom(start, target.gameTile()) && canPark(this, start, units)) {
            // Already in range from the held hex: stay (or walk back to its center) and shoot from here
            path = [start];
            this.chaseTile = target.claimedTile;
        } else if (target) {
            path = this.navigation.findPathTiles(start, target.claimedTile, this.pathfinding, this.stat.attackRange, obstacles);
            const end = path[path.length - 1];
            if (!end || !isFreeEndTile(this, end, units)) {
                // No path, or someone already stands (or is heading) there: use the closest free hex the target can be shot from
                const alternative = this.pathToFreeTile(end ?? target.claimedTile, obstacles, this.attackPositionFor(target));
                if (!alternative) {
                    // No room around the target: do not force it, the attack is given up
                    this.giveUpTarget(target);
                    return;
                }
                path = alternative;
            }
            this.chaseTile = target.claimedTile;
        } else {
            const end = gameTile ?? start;
            path = isFreeEndTile(this, end, units) ? this.navigation.findPathTiles(start, end, this.pathfinding, 0, obstacles) : [];
            if (path.length === 0) path = this.pathToFreeTile(end, obstacles) ?? [];
        }
        this.followPath(path, target);
    }

    /**
     * Never stand on the same hex as another unit (flying or not), however the unit came to a stop there
     * (arrival, stop order, lost target, no path). Runs before firing, so the unit that has to leave does not shoot.
     * When two units stand on one hex, the first one updated leaves and the other one stays.
     */
    private leaveSharedTile(delta: number) {
        this.freeTileCoolDown = Math.max(0, this.freeTileCoolDown - delta);
        if (this.retreating || !this.parked || this.freeTileCoolDown > 0) return;
        if (canPark(this, this.claimedTile, this.systems.allUnits())) return;
        if (!this.moveToFreeTile()) this.freeTileCoolDown = Unit.REPATH_INTERVAL;
    }

    /**
     * The end hex is taken, walk to the closest free one. While attacking only a free hex the target can be shot from will do,
     * if there is none the attack is given up.
     * @returns false if there is no reachable free hex nearby
     */
    private moveToFreeTile(): boolean {
        const target = this.target;
        if (target) {
            const path = this.pathToFreeTile(this.claimedTile, this.knownObstacles(target), this.attackPositionFor(target));
            if (path) {
                this.followPath(path, target);
                return true;
            }
            return this.giveUpTarget(target);
        }
        const path = this.pathToFreeTile(this.claimedTile, this.knownObstacles(null));
        if (!path) return false;
        this.followPath(path, null);
        return true;
    }

    /** Tiles the target can be shot from */
    private attackPositionFor(target: Unit): (tile: GameTile) => boolean {
        return tile => this.inAttackRangeFrom(tile, target.claimedTile);
    }

    /** Whether the unit recently gave up attacking the enemy for lack of room; such enemies are not attacked for a while */
    hasGivenUpOn(enemy: Unit): boolean {
        return (this.givenUpTargets.get(enemy) ?? 0) > 0;
    }

    /**
     * Every hex the target can be shot from is taken (or unreachable): drop the attack instead of forcing it,
     * which ends the attack order so its issuer can pick another objective. The unit stays on its hex, or moves
     * to the closest free one if it is shared.
     * @returns false if the unit is left on a shared hex with no free hex nearby
     */
    private giveUpTarget(target: Unit): boolean {
        this.givenUpTargets.set(target, Unit.GIVE_UP_TIME);
        this.target = null;
        this.fireTarget = null;
        this.chaseTile = null;
        this.goal = null;
        if (canPark(this, this.claimedTile, this.systems.allUnits())) {
            this.followPath([], null);
            return true;
        }
        return this.moveToFreeTile();
    }

    private followPath(path: GameTile[], target: Unit | null) {
        this.setNav(
            path.map(tile => this.navigation.navPoint(tile)),
            target
        );
        if (path.length > 1) {
            this.destination = path[path.length - 1];
        } else {
            this.destination = this.navPoints.length > 0 ? this.claimedTile : null;
        }
    }

    /** Path to the closest reachable free hex around `origin`, null if there is none nearby */
    private pathToFreeTile(origin: GameTile, obstacles: GameTile[], accept?: (tile: GameTile) => boolean): GameTile[] | null {
        const walkable = this.systems.map.tiles.filter(tile => tile.pathfinding & this.pathfinding && !obstacles.includes(tile));
        const candidates = freeTilesNear(this, origin, walkable, this.systems.allUnits(), Unit.FREE_TILE_RADIUS, accept);
        for (const tile of candidates.slice(0, 8)) {
            const path = this.navigation.findPathTiles(this.claimedTile, tile, this.pathfinding, 0, obstacles);
            if (path.length > 0) return path;
        }
        return null;
    }
}
