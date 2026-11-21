import type GameTile from "../GameTile.js";

/**
 * Tile occupancy rules ("body blocking"). Every unit claims the hex it stands on, see {@link TileOccupant.claimedTile}.
 * - Moving: ground and flying units live on separate layers and never block each other. Within a layer, enemy units never
 *   enter a hex claimed by the other side; the one that tries retreats to the hex it came from. Friendly units walk through.
 * - Standing: never two units on one hex, whatever their side or layer. A flying unit may pass over a ground unit
 *   (and the other way round), but must not stop there; nor may two units pick the same end hex.
 */
export interface TileOccupant {
    readonly player: object;
    readonly stat: {readonly flying: boolean};
    /** The hex the unit holds; while it bounces back from an enemy hex it still holds the hex it came from */
    readonly claimedTile: GameTile;
    /** The hex the unit is heading to, null when it is not moving */
    readonly destination: GameTile | null;
    /** Standing still on its claimed hex, with nowhere to go */
    readonly parked: boolean;
    readonly markedForDeletion: boolean;
}

/** Ground units only interact with ground units, flying units with flying units */
export function sameLayer(a: TileOccupant, b: TileOccupant): boolean {
    return a.stat.flying === b.stat.flying;
}

/** Every other living unit, on both layers */
function others(unit: TileOccupant, occupants: readonly TileOccupant[]): TileOccupant[] {
    return occupants.filter(other => other !== unit && !other.markedForDeletion);
}

/** The enemy on the unit's layer that holds the tile, if any */
export function enemyHolding(unit: TileOccupant, tile: GameTile, occupants: readonly TileOccupant[]): TileOccupant | undefined {
    return others(unit, occupants).find(other => sameLayer(unit, other) && other.player !== unit.player && other.claimedTile === tile);
}

/** A unit may step into a hex unless an enemy on its layer holds it; friendly units are walked through */
export function canEnter(unit: TileOccupant, tile: GameTile, occupants: readonly TileOccupant[]): boolean {
    return !enemyHolding(unit, tile, occupants);
}

/**
 * A unit arriving at a hex may stop there unless another unit (either layer) stands on it,
 * or an enemy of its own layer holds it
 */
export function canPark(unit: TileOccupant, tile: GameTile, occupants: readonly TileOccupant[]): boolean {
    return !others(unit, occupants).some(
        other => other.claimedTile === tile && (other.parked || (sameLayer(unit, other) && other.player !== unit.player))
    );
}

/** A hex is a valid end of a path if the unit may stop there and no friendly unit (either layer) is already heading to it */
export function isFreeEndTile(unit: TileOccupant, tile: GameTile, occupants: readonly TileOccupant[]): boolean {
    return canPark(unit, tile, occupants) && !others(unit, occupants).some(other => other.player === unit.player && other.destination === tile);
}

/**
 * Free end tiles around `origin`, closest first (ties: closest to the unit first)
 * @param candidates every tile the unit can walk on
 * @param accept extra condition, e.g. the target is in attack range from the tile
 */
export function freeTilesNear(
    unit: TileOccupant,
    origin: GameTile,
    candidates: readonly GameTile[],
    occupants: readonly TileOccupant[],
    maxRadius = 4,
    accept: (tile: GameTile) => boolean = () => true
): GameTile[] {
    return candidates
        .map(tile => ({tile, distance: origin.distance(tile), fromUnit: unit.claimedTile.distance(tile)}))
        .filter(({tile, distance}) => distance <= maxRadius && accept(tile) && isFreeEndTile(unit, tile, occupants))
        .sort((a, b) => a.distance - b.distance || a.fromUnit - b.fromUnit)
        .map(({tile}) => tile);
}
