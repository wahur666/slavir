import type Unit from "../../entities/Unit";
import type GameTile from "../GameTile";

export type OrderStatus = "running" | "done";

/**
 * An order is what a single unit is currently doing because of a command.
 * The command hub starts it, steps it every frame, and drops it once it is done.
 */
export interface Order {
    start(unit: Unit): void;
    update(unit: Unit, delta: number): OrderStatus;
    cancel(unit: Unit): void;
}

/** Walk to a tile; done once the unit stopped moving */
export class MoveOrder implements Order {
    constructor(private readonly tile: GameTile) {}

    start(unit: Unit): void {
        unit.moveToGameTile(this.tile);
    }

    update(unit: Unit): OrderStatus {
        return unit.moving || unit.navPoints.length > 0 ? "running" : "done";
    }

    cancel(unit: Unit): void {
        unit.stopUnitWhenHexCenterIsReached();
    }
}

/** Chase and attack a unit; done once the unit lost its target (dead, invisible) */
export class AttackOrder implements Order {
    constructor(private readonly target: Unit) {}

    start(unit: Unit): void {
        unit.moveToGameTile(null, this.target);
    }

    update(unit: Unit): OrderStatus {
        return unit.target === this.target ? "running" : "done";
    }

    cancel(unit: Unit): void {
        unit.stopUnitWhenHexCenterIsReached();
    }
}
