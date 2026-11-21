import type Phaser from "phaser";
import type Player from "../model/player/Player.js";
import type GameTile from "../model/GameTile.js";
import type Systems from "../model/Systems.js";
import {Images} from "../scenes/PreloadScene.js";
import HealthBar from "./HealthBar.js";
import Lightning from "./Lightning.js";

const sum = (arr: number[]) => arr.reduce((acc, item) => acc + item, 0);

export default class Objective {
    maxCoolDown = 60_000;
    currentCoolDown = 0;
    bufferZone = 55_000;

    maxPeaceCoolDown = 10_000;
    peaceCoolDown = 0;

    bufferTime = 3000;
    /** A launched rocket: the side it hits and the simulation time until it lands */
    private incomingStrike: {leftSide: boolean; remaining: number} | null = null;

    pads: number[] = Array(3).fill(0);

    player1: Player;
    player2: Player;
    padTiles: {nuke: GameTile; pad1: GameTile[]; pad2: GameTile[]; pad3: GameTile[]};
    private healthBar: HealthBar;
    private nukePos: Phaser.Math.Vector2;
    private lightning: Lightning;

    constructor(
        private systems: Systems,
        padTiles: {nuke: GameTile; pad1: GameTile[]; pad2: GameTile[]; pad3: GameTile[]}
    ) {
        this.padTiles = padTiles;
        this.player1 = this.systems.player1;
        this.player2 = this.systems.player2;
        this.create();
        this.lightning = new Lightning(this.systems.gameScene, 0, 0);
    }

    create() {
        this.nukePos = this.systems.hexToPos(this.padTiles.nuke.hex);
        const nukeBase = this.systems.gameScene.add.image(this.nukePos.x, this.nukePos.y, Images.NUKE);
        const obelisk = this.systems.gameScene.add.image(this.nukePos.x + 1, this.nukePos.y + 10, Images.OBELISK).setOrigin(0.5, 1);
        const obeliskNums = this.systems.gameScene.add.image(this.nukePos.x + 1, this.nukePos.y - 18, Images.OBELISK_NUMS);
        const nukeBaseNums0 = this.systems.gameScene.add.image(this.nukePos.x - 39, this.nukePos.y - 4, Images.NUKE_NUMS, 0);
        const nukeBaseNums3 = this.systems.gameScene.add.image(this.nukePos.x + 39, this.nukePos.y - 4, Images.NUKE_NUMS, 3);
        this.healthBar = new HealthBar(this.systems.gameScene, this.nukePos.x + 1, this.nukePos.y + 20, 100, 15, 0x23aa65);
    }

    update(delta: number) {
        this.updateStrike(delta);
        if (this.peaceCoolDown > 0) {
            this.peaceCoolDown = Math.max(0, this.peaceCoolDown - delta);
            this.healthBar.update(
                this.nukePos.x + 1,
                this.nukePos.y + 20,
                Math.max(0, 1 - (this.maxPeaceCoolDown - this.peaceCoolDown) / this.bufferTime)
            );
            this.healthBar.setColor(0xff0000);
            return;
        }
        this.healthBar.setColor(0x23aa65);
        this.calculatePadState();
        const padState = sum(this.pads);
        if (padState !== 0) {
            this.currentCoolDown += delta | 0;
            if (this.currentCoolDown >= this.maxCoolDown) {
                this.launchStrike(padState < 0);
                this.currentCoolDown = 0;
                this.peaceCoolDown = this.maxPeaceCoolDown;
            }
        } else if (this.currentCoolDown > this.bufferZone) {
            this.currentCoolDown = Math.max(this.bufferZone, (this.currentCoolDown - delta) | 0);
        }
        this.healthBar.update(this.nukePos.x + 1, this.nukePos.y + 20, this.currentCoolDown / this.maxCoolDown);
    }

    /**
     * Fires the rocket, it hits the base {@link bufferTime} later
     * @param leftSide - Shoot rocket to the left side (player 1)
     */
    launchStrike(leftSide: boolean) {
        // TODO: Add a rocket animation, this is just a delay now
        this.incomingStrike = {leftSide, remaining: this.bufferTime};
    }

    get strikePending(): boolean {
        return this.incomingStrike !== null;
    }

    /** Counted in simulation time (not the scene clock) so the strike lands on the same tick in a replay */
    private updateStrike(delta: number) {
        if (!this.incomingStrike) return;
        this.incomingStrike.remaining -= delta;
        if (this.incomingStrike.remaining > 0) return;
        const target = this.incomingStrike.leftSide ? this.player1 : this.player2;
        this.incomingStrike = null;
        target.takeObjectiveDamage();
        this.lightning.strike(this.nukePos, this.systems.hexToPos(target.base!.hex));
    }

    private calculatePadState() {
        const checkPad = (pad: GameTile, units: GameTile[]): boolean => {
            for (const unit of units) {
                if (unit === pad) return true;
            }
            return false;
        };
        const checkAllPadsForPlayer = (player: Player): number[] => {
            const playerPads: number[] = [];
            const playerUnits = player.units.filter(e => !e.markedForDeletion).map(e => e.gameTile()!);
            if (playerUnits.length === 0) {
                return [0, 0, 0];
            }
            const checkAllTiles = (padTiles: GameTile[]): boolean => {
                for (const pad of padTiles) {
                    if (checkPad(pad, playerUnits)) {
                        return true;
                    }
                }
                return false;
            };
            playerPads.push(checkAllTiles(this.padTiles.pad1) ? 1 : 0);
            playerPads.push(checkAllTiles(this.padTiles.pad2) ? 1 : 0);
            playerPads.push(checkAllTiles(this.padTiles.pad3) ? 1 : 0);
            return playerPads;
        };

        const player1pads = checkAllPadsForPlayer(this.player1);
        const player2pads = checkAllPadsForPlayer(this.player2);

        for (let i = 0; i < 3; i++) {
            this.pads[i] = player1pads[i] - player2pads[i];
        }
    }
}
