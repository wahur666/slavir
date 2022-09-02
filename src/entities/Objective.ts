import type Player from "../model/player/Player";
import type GameTile from "../model/GameTile";


const enum ObjectivePadState {
    PLAYER1 = -1,
    CONTESTED = 0,
    PLAYER2 = 1
}

const sum = (arr: ObjectivePadState[]) => arr.reduce((acc, item) => acc + item, 0);

export default class Objective {

    maxCoolDown = 60_000;
    currentCoolDown = 0;
    bufferZone = 55_000;

    maxPeaceCoolDown = 10_000;
    peaceCoolDown = 0;

    pads: ObjectivePadState[] = [];

    player1: Player;
    player2: Player;

    constructor(padTiles: {[key: string]: GameTile[]}, player1: Player, player2: Player) {
        this.player1 = player1;
        this.player2 = player2;
    }

    update(delta: number) {
        if (this.peaceCoolDown > 0) {
            this.peaceCoolDown = Math.max(0, this.peaceCoolDown - delta);
            return;
        }
        const padState = sum(this.pads);
        if (padState !== 0) {
            this.currentCoolDown += delta | 0;
            if (this.currentCoolDown >= this.maxCoolDown) {
                const leftSide = padState > 0;
                this.playRocketAnimation(leftSide).then(() => (leftSide ? this.player1 : this.player2).takeObjectiveDamage());
                this.currentCoolDown = 0;
                this.peaceCoolDown = this.maxPeaceCoolDown;
            }
        } else if (this.currentCoolDown > this.bufferZone) {
            this.currentCoolDown = Math.max(this.bufferZone, this.currentCoolDown - delta | 0);
        }
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

}
