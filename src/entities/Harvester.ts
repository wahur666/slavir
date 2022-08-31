import Unit from "./Unit";
import type GameScene from "../scenes/GameScene";
import type {UnitStat} from "./UnitsStats";
import type Player from "../model/player/Player";
import type {Navigation} from "../model/navigation";


export default class Harvester extends Unit {

    harvesting = false;

    constructor(scene: GameScene, x: number, y: number, texture: string, stat: UnitStat, player: Player, navigation: Navigation, free: (unit: Unit) => Promise<void>) {
        super(scene, x, y, texture, stat, player, navigation, free);
        this.findNearestResource();
        this.player.numberOfHarvesters += 1;
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
            this.setNav(this.navigation.findPath(this.gameTile(), targetResource.gameTile, this.pathfinding).map(e => this.navigation.calculateNavPoint(e)));
        }
    }

    playAnimation() {
        const velocity = this.body.velocity;
        if (velocity.length() === 0) {
            if (this.harvesting) {
                this.play(Unit.AnimationKeys.ATTACK_ + this.lastDirection, true);
            } else {
                this.play(Unit.AnimationKeys.IDLE_ + this.lastDirection, true);
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

    prepForDestroy(): Promise<void> {
        const a = super.prepForDestroy();
        this.player.numberOfHarvesters -= 1;
        return a;
    }

    update() {
        super.update();
        const resource = this.scene.resources.find(e => e.gameTile === this.gameTile());
        if (!this.moving && !this.harvesting) {
            if (resource) {
                resource.occupied = true;
                this.harvesting = true;
            }
        }
        if (this.moving && this.harvesting) {
            if (resource) {
                resource.occupied = true;
                this.harvesting = false;
            }
        }
        if(this.harvesting && !resource) {
            this.harvesting = false;
            this.findNearestResource();
        }
    }


}