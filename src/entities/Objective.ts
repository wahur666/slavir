import type Player from "../model/player/Player";
import type GameTile from "../model/GameTile";

const sum = (arr: number[]) => arr.reduce((acc, item) => acc + item, 0);

export default class Objective {

    maxCoolDown = 60_000;
    currentCoolDown = 0;
    bufferZone = 55_000;

    maxPeaceCoolDown = 10_000;
    peaceCoolDown = 0;

    pads: number[] = Array(3).fill(0);

    player1: Player;
    player2: Player;
    padTiles: { pad1: GameTile[]; pad2: GameTile[]; pad3: GameTile[] };

    constructor(padTiles: {pad1: GameTile[], pad2: GameTile[], pad3: GameTile[]}, player1: Player, player2: Player) {
        this.padTiles = padTiles;
        this.player1 = player1;
        this.player2 = player2;
    }

    update(delta: number) {
        if (this.peaceCoolDown > 0) {
            this.peaceCoolDown = Math.max(0, this.peaceCoolDown - delta);
            return;
        }
        this.calculatePadState();
        const padState = sum(this.pads);
        if (padState !== 0) {
            this.currentCoolDown += delta | 0;
            if (this.currentCoolDown >= this.maxCoolDown) {
                const leftSide = padState < 0;
                this.playRocketAnimation(leftSide).then(() => (leftSide ? this.player1 : this.player2).takeObjectiveDamage());
                this.currentCoolDown = 0;
                this.peaceCoolDown = this.maxPeaceCoolDown;
            }
        } else if (this.currentCoolDown > this.bufferZone) {
            this.currentCoolDown = Math.max(this.bufferZone, this.currentCoolDown - delta | 0);
        }
        // console.log("Pad state cooldown", this.currentCoolDown / 1000 | 0);
    }

    /**
     * @param leftSide - Shoot rocket to the left side
     */
    async playRocketAnimation(leftSide: boolean): Promise<void> {
        return new Promise(resolve => {
            console.log("Rocket goes brrrrrr to the " + (leftSide ? "left" : "right"));
            setTimeout(() => resolve(), 3000);
        });
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
            const playerUnits = player.units.map(e => e.gameTile()!);
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
