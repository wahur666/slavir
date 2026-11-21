import Player from "./Player.js";
import HumanPlayer from "./HumanPlayer.js";
import type Systems from "../Systems.js";
import type Unit from "../../entities/Unit.js";
import type {UnitStat} from "../../entities/UnitsStats.js";

/**
 * Sandbox player 1: selects and commands its units like in a match, but has no cards, resources or unit cap.
 * Units are added by the sandbox scene's spawn buttons.
 */
export class SandboxHumanPlayer extends HumanPlayer {
    constructor(index: number, systems: Systems) {
        super(index, systems);
    }

    protected createCards() {}
    /** Commander powers need the economy, which the sandbox does not run */
    protected createPowerCards() {}
    setupResourceUI() {}
    setupUnitCapUI() {}
    updateTicks() {}
    updateUnitCounter() {}
    /** No economy and no create cooldown in the sandbox */
    update(_delta: number) {}

    placeUnit(unitStat: UnitStat): Unit | null {
        const unit = super.placeUnit(unitStat);
        if (unit) this.selectUnit(unit);
        return unit;
    }
}

/** Sandbox player 2: no AI and no input. Its units stand where they spawn and only fire at what comes in range. */
export class SandboxEnemyPlayer extends Player {
    constructor(index: number, systems: Systems) {
        super(index, systems);
    }

    update(_delta: number) {}

    placeUnit(unitStat: UnitStat): Unit | null {
        const unit = super.placeUnit(unitStat);
        // Same tint as the AI's units
        if (unit) unit.tint = 0xf6c5c5;
        return unit;
    }
}
