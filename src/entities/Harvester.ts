import Unit from "./Unit";
import type {UnitStat} from "./UnitsStats";
import type Player from "../model/player/Player";
import type Systems from "../model/Systems";


export default class Harvester extends Unit {

    harvesting = false;

    constructor(systems: Systems, x: number, y: number, texture: string, stat: UnitStat, player: Player, free: (unit: Unit) => Promise<void>) {
        super(systems, x, y, texture, stat, player, free);
        this.findNearestResource();
    }

    findNearestResource() {
        const resources = this.player.resources.filter(e => !e.occupied).sort((a, b) => {
            const aDist = a.gameTile.distance(this.gameTile());
            const bDist = b.gameTile.distance(this.gameTile());
            if (aDist === bDist) {
                return a.priority - b.priority;
            } else {
                return aDist - bDist;
            }
        });
        const targetResource = resources.length > 0 ? resources[0] : null;
        if (targetResource) {
            this.moveToGameTile(targetResource.gameTile);
        }
    }

    playAnimation() {
        const velocity = this.body.velocity;
        if (velocity.length() === 0) {
            if (this.harvesting && this.attackCoolDown === 0) {
                this.play(Unit.AnimationKeys.ATTACK_ + this.lastDirection, true);
                this.attackCoolDown = this.stat.rateOfFire * 1000;
                this.attackAnimationPlaying = true;
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

    prepForDestroy(): Promise<void> {
        const a = super.prepForDestroy();
        if (this.harvesting) {
            this.stopHarvesting();
        }
        return a;
    }

    startHarvesting() {
        this.harvesting = true;
        this.player.increaseHarvesterCount();
        console.log("Player harvesters", this.player.numberOfHarvesters);
    }

    stopHarvesting() {
        this.harvesting = false;
        this.player.decreaseHarvesterCount();
        console.log("Player harvesters", this.player.numberOfHarvesters);
    }

    update(delta: number) {
        super.update(delta);
        if (this.markedForDeletion) {
            return;
        }
        const resource = this.systems.resources.find(e => e.gameTile === this.gameTile());
        if (!this.moving && !this.harvesting) {
            if (resource) {
                resource.occupied = true;
                this.startHarvesting();
            }
        }
        if (this.moving && this.harvesting) {
            if (resource) {
                resource.occupied = false;
                this.stopHarvesting();
            }
        }
        if(this.harvesting && !resource) {
            this.stopHarvesting();
            this.findNearestResource();
        }
    }


}
