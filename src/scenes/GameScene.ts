import type GameTile from "../model/GameTile.js";
import Phaser from "phaser";
import {SceneRegistry} from "./SceneRegistry.js";
import {Images} from "./PreloadScene.js";
import {Pathfinding} from "../model/HexMap.js";
import type {Hex} from "../model/hexgrid/Hex.js";
import type Player from "../model/player/Player.js";
import {defaultFont, formatTime, range} from "../helpers/utils.js";
import Graphics = Phaser.GameObjects.Graphics;
import Systems from "../model/Systems.js";
import {SHARED_CONFIG} from "../model/config.js";
import {type Replay, ReplayRecorder, ReplayVerifier, TICK_MS} from "../model/replay/Replay.js";

const grey = 0x808080;
const white = 0xffffff;

const c1 = Phaser.Display.Color.ValueToColor(grey);
const c2 = Phaser.Display.Color.ValueToColor(white);

/** Number of steps when changing tile visibility */
const shadeSteps = 60;

/** Most simulation ticks run in one frame (at normal speed), so a long frame does not freeze the game catching up */
const MAX_TICKS_PER_FRAME = 4;

const PLAYBACK_SPEEDS = [1, 2, 4, 8];

export interface GameSceneData {
    /** Watch this replay instead of playing */
    replay?: Replay;
}

/** Shade values to apply as tint */
const shadeValues = range(shadeSteps)
    .map(value => Phaser.Display.Color.Interpolate.ColorWithColor(c1, c2, shadeSteps, value))
    .map(value => Phaser.Display.Color.GetColor(value.r, value.g, value.b));

export default class GameScene extends Phaser.Scene {
    currentTile: GameTile;
    scaleFactor: number = 3;
    graphics: Graphics;
    graphics2: Graphics;
    gameEnded: boolean = false;
    systems: Systems;
    player1: Player;
    player2: Player;
    bg: Phaser.GameObjects.Sprite;
    fpsText: Phaser.GameObjects.Text;
    elapsedTime: number = 0;
    countdownRemaining: number = 3000;
    private countdownText: Phaser.GameObjects.Text;
    currentTimeText: Phaser.GameObjects.Text;
    private config: typeof SHARED_CONFIG;
    /** Number of simulation ticks run so far, see {@link simulationTick} */
    tick = 0;
    /** Real time not yet simulated */
    private tickAccumulator = 0;
    private recorder: ReplayRecorder;
    /** The replay being watched, null in a normal match */
    replay: Replay | null = null;
    private verifier: ReplayVerifier | null = null;
    private playbackSpeed = 1;
    private replayStatusText?: Phaser.GameObjects.Text;

    constructor(key: string = SceneRegistry.GAME) {
        super(key);
        // @ts-expect-error
        window.game = this;
        this.config = SHARED_CONFIG;
    }

    create(data?: GameSceneData) {
        this.gameEnded = false;
        this.elapsedTime = 0;
        this.countdownRemaining = 3000;
        this.tick = 0;
        this.tickAccumulator = 0;
        this.replay = data?.replay ?? null;
        this.verifier = this.replay ? new ReplayVerifier(this.replay) : null;
        this.playbackSpeed = 1;
        // Physics is stepped by the simulation ticks instead of once per rendered frame
        this.physics.disableUpdate();
        this.physics.resume();
        this.bg = this.add.sprite(this.config.width / 2, this.config.height / 2, Images.BROWN_BG).setScale(1.25);

        this.systems = this.createSystems();
        this.player1 = this.systems.player1;
        this.player2 = this.systems.player2;
        this.recorder = new ReplayRecorder(this.systems);
        if (this.replay) this.systems.commands.startPlayback(this.replay.commands);

        this.graphics = this.add.graphics();
        this.graphics2 = this.add.graphics().setScale(this.scaleFactor);
        this.input.mouse.disableContextMenu();
        this.fpsText = this.add.text(0, 0, "0 FPS", {
            fontFamily: "sans-serif",
            fontSize: "12px",
            color: "#0000FF",
        });

        for (const tile of this.systems.map.tiles) {
            tile.tile.tint = 0x545454;
        }

        if (this.config.debug.hexes) {
            this.drawHexes();
        }

        if (this.config.debug.navMesh) {
            this.drawNavMesh();
        }
        this.player1.create();
        this.player2.create();
        this.setupHud();
        this.drawVisibleTiles();
    }

    protected createSystems(): Systems {
        return new Systems(this, {
            scaleFactor: this.scaleFactor,
            width: this.config.width,
            height: this.config.height,
        });
    }

    /** Match timer, retire and pause buttons, and the starting countdown */
    protected setupHud() {
        this.add.image(this.config.width / 2, 10, Images.PANEL_BLUE);
        this.currentTimeText = this.add.text(this.config.width / 2 - 25, 10, "00:00", {
            fontFamily: defaultFont,
            fontSize: "30px",
        });
        if (this.replay) {
            this.setupReplayHud();
        } else {
            this.setupRetireButton();
        }
        this.setupPauseButton();
        this.countdownText = this.add
            .text(this.config.width / 2, this.config.height / 2, "3", {
                fontFamily: defaultFont,
                fontSize: "90px",
                stroke: "#000000",
                strokeThickness: 8,
            })
            .setOrigin(0.5)
            .setDepth(100);
    }

    /** "Replay" label with sync state and a playback speed button in place of the retire button */
    private setupReplayHud() {
        this.replayStatusText = this.add
            .text(this.config.width / 2, 50, "REPLAY", {
                fontFamily: defaultFont,
                fontSize: "22px",
                color: "#ffd27a",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(20);
        this.add
            .image(1200, 600, Images.BUTTON)
            .setScale(0.7, 0.9)
            .setInteractive()
            .on("pointerup", () => {
                this.playbackSpeed = PLAYBACK_SPEEDS[(PLAYBACK_SPEEDS.indexOf(this.playbackSpeed) + 1) % PLAYBACK_SPEEDS.length];
                speedText.setText(`Speed ${this.playbackSpeed}x`);
            });
        const speedText = this.add.text(1200, 600, "Speed 1x", {fontFamily: defaultFont, fontSize: "26px"}).setOrigin(0.5);
    }

    get canIssueCommands(): boolean {
        return this.countdownRemaining === 0 && !this.gameEnded && this.scene.isActive();
    }

    private setupPauseButton() {
        const pause = () => {
            if (!this.gameEnded) {
                this.scene.launch(SceneRegistry.PAUSE);
                this.scene.pause();
            }
        };
        this.add.image(1200, 60, Images.BUTTON).setScale(0.7, 0.9).setInteractive().on("pointerup", pause);
        this.add.text(1200, 60, "Pause", {fontFamily: defaultFont, fontSize: "28px"}).setOrigin(0.5);
        this.input.keyboard.on("keyup-ESC", pause);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.input.keyboard.off("keyup-ESC", pause));
    }

    setCurrentTile(tile: GameTile): void {
        this.currentTile = tile;
        const colors = {blue: 0x0000ff, green: 0x00ff00, red: 0xff0000};
        this.graphics.clear();
        this.graphics.lineStyle(1, colors.green, 1);
        const center = this.systems.map.getCenter(tile).add(this.systems.baseOffset);
        this.graphics.strokeCircle(center.x, center.y, 5).setScale(this.scaleFactor);
    }

    calculateVisibleTilesForPlayer(player: Player): Set<GameTile> {
        const visibleTiles = new Set<GameTile>();
        for (const playerUnit of player.units) {
            const tile = this.systems.pointToTile(playerUnit.pos.x, playerUnit.pos.y);
            if (tile) {
                for (const visibleTile of this.systems.map.visibleTiles(tile, playerUnit.stat.visionRadius)) {
                    visibleTiles.add(visibleTile);
                }
            }
        }
        if (player.base) {
            for (const visibleTile of this.systems.map.visibleTiles(player.base, 3, true)) {
                visibleTiles.add(visibleTile);
            }
        }

        player.visibleEnemyUnits = [];
        for (const unit of player.enemyPlayer.units) {
            if (visibleTiles.has(unit.gameTile())) {
                player.visibleEnemyUnits.push(unit);
            }
        }
        return visibleTiles;
    }

    drawVisibleTiles() {
        const visibleTiles = this.calculateVisibleTilesForPlayer(this.player1);
        this.calculateVisibleTilesForPlayer(this.player2);
        for (const p2unit of this.player2.units) {
            p2unit.setActivelyVisible(this.player1.visibleEnemyUnits.includes(p2unit));
        }
        for (const building of this.player2.buildings) {
            if (!building.revealed && visibleTiles.has(building.gameTile())) {
                building.setRevealed(true);
            }
        }
        for (const tile of this.systems.map.tiles) {
            this.drawVisibility(tile, visibleTiles.has(tile));
        }
    }

    drawVisibility(tile: GameTile, visible: boolean) {
        if (tile.tile.index !== -1) {
            if (visible) {
                tile.shadeIndex = Math.min(shadeSteps - 1, tile.shadeIndex + 3);
            } else {
                tile.shadeIndex = Math.max(0, tile.shadeIndex - 1);
            }
            tile.tile.tint = shadeValues[tile.shadeIndex];
        }
    }

    /**
     * Runs the simulation in fixed ticks of {@link TICK_MS}, however long the rendered frame was. Fixed ticks make
     * the match deterministic: the same commands on the same ticks give the same match, which replays rely on.
     */
    update(_time: number, delta: number) {
        this.fpsText.setText(`${(1000 / delta) | 0} FPS`);
        if (this.gameEnded) {
            return;
        }
        if (this.countdownRemaining > 0) {
            this.currentTimeText?.setText(formatTime(0));
            this.countdownRemaining = Math.max(0, this.countdownRemaining - delta);
            this.countdownText?.setText(`${Math.ceil(this.countdownRemaining / 1000)}`);
            if (this.countdownRemaining === 0) {
                this.countdownText?.destroy();
            }
            return;
        }
        const maxTicks = MAX_TICKS_PER_FRAME * this.playbackSpeed;
        this.tickAccumulator = Math.min(this.tickAccumulator + delta * this.playbackSpeed, maxTicks * TICK_MS);
        while (this.tickAccumulator >= TICK_MS && !this.gameEnded) {
            this.tickAccumulator -= TICK_MS;
            this.systems.commands.beginTick(this.tick);
            if (!this.gameEnded) this.simulationTick(TICK_MS);
            this.systems.commands.endTick();
            this.tick++;
            const checkpoint = this.recorder.afterTick(this.tick);
            if (checkpoint) this.verifier?.check(checkpoint);
        }
        this.currentTimeText?.setText(formatTime((this.elapsedTime / 1000) | 0));
        this.updateReplayStatus();
    }

    private updateReplayStatus() {
        if (!this.replayStatusText || this.verifier?.desyncTick == null) return;
        this.replayStatusText.setText(`REPLAY  -  out of sync at ${formatTime((this.verifier.desyncTick * TICK_MS) / 1000)}`).setColor("#ff6b6b");
    }

    /**
     * One step of the match. Everything that affects the outcome happens here, with the fixed `delta`; code outside
     * of it (input handlers, the scene clock, tweens, animation events) may only issue commands or change visuals.
     */
    protected simulationTick(delta: number) {
        this.physics.world.singleStep();
        this.elapsedTime += delta;
        this.drawVisibleTiles();
        // Copies: a unit that finished dying removes itself from the list
        for (const unit of [...this.player1.units]) {
            unit.update(delta);
        }
        for (const unit of [...this.player2.units]) {
            unit.update(delta);
        }
        this.systems.commands.update(delta);
        for (const resource of this.systems.resources) {
            resource.update(delta);
        }
        this.systems.objective.update(delta);
        this.player1.update(delta);
        this.player2.update(delta);
        if (this.player1.currentBaseHealth <= 0) {
            console.log("You lost");
            this.endGame(false);
        }
        if (this.player2.currentBaseHealth <= 0) {
            console.log("You won");
            this.endGame(true);
        }
    }

    /** @param result whether player 1 won */
    endGame(result: boolean) {
        if (this.gameEnded) return;
        this.gameEnded = true;
        this.stopUnits();
        const endTick = this.tick;
        this.time.delayedCall(3000, () => {
            // Finished here, not right away: a surrender command is recorded after it ended the game
            const replay = this.recorder.finish(endTick, result);
            this.scene.start(SceneRegistry.SCORE, {result, replay});
        });
    }

    stopUnits() {
        for (const unit of this.player1.units) {
            unit.stopUnit();
        }
        for (const unit of this.player2.units) {
            unit.stopUnit();
        }
    }

    private drawHexes() {
        const graphics = this.add.graphics();
        for (const hex of this.systems.hexes) {
            this.drawHex(graphics, hex);
        }
    }

    /** Draws non walkable paths */
    drawNavMesh() {
        const polyiz = this.systems.map.generateNavigationPolygons(Pathfinding.GROUND);
        for (const polygon of polyiz) {
            this.graphics2.lineStyle(1, 0xff0000, 1);
            this.graphics2
                .strokePoints(polygon.points, true, true)
                .setX(this.systems.scaledBaseOffset.x)
                .setY(this.systems.scaledBaseOffset.y)
                .setScale(this.scaleFactor);
        }
    }

    drawHex(graphics: Graphics, hex: Hex): void {
        const points = this.systems.map.layout.polygonCorners(hex);
        graphics.lineStyle(1, 0xff0000, 1);
        graphics
            .strokePoints(points, true, true)
            .setX(this.systems.scaledBaseOffset.x)
            .setY(this.systems.scaledBaseOffset.y)
            .setScale(this.scaleFactor);
    }

    setupRetireButton() {
        const retireButton = this.add.image(1200, 600, Images.BUTTON);
        retireButton.setInteractive();
        retireButton.on("pointerup", () => {
            this.systems.commands.issue({kind: "surrender", playerIndex: this.player1.index});
        });
        retireButton.setScale(0.7, 0.9);
        const retireButtonText = this.add.text(1170, 580, "Retire", {
            fontFamily: defaultFont,
            fontSize: "28px",
        });
    }
}
