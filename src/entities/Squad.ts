import type {UnitStat} from "./UnitsStats.js";
import {type VolleyStat, volleyStatOf} from "./Volley.js";

/**
 * Squad rules, kept free of Phaser so they can be unit tested.
 *
 * A squad shares one health pool of `health * squadSize`. Damage always hits the front member: every time the pool
 * crosses a multiple of the per-member `health`, one member dies. All living members fire together, so a volley deals
 * the per-member damage once per living member.
 */

/** Full health of the whole squad */
export function maxSquadHealth(stat: Pick<UnitStat, "health" | "squadSize">): number {
    return stat.health * stat.squadSize;
}

/** Members still alive for the given pool, 0 when the squad is wiped out */
export function aliveMembers(currentHealth: number, stat: Pick<UnitStat, "health" | "squadSize">): number {
    if (currentHealth <= 0) return 0;
    return Math.min(stat.squadSize, Math.ceil(currentHealth / stat.health));
}

/** Damage a single member of the attacker deals to one shot's target */
export function damagePerMember(attacker: UnitStat, target: Pick<UnitStat, "type">): number {
    switch (target.type) {
        case "aircraft":
            return attacker.damageAgainstAir;
        case "infantry":
            return attacker.damageAgainstInfantry;
        case "vehicle":
            return attacker.damageAgainstVehicle;
    }
}

/**
 * Display offsets of the members around the hex center, in world pixels. Member 0 is the squad leader (the unit
 * itself, which owns the physics body) and always stands on the center; the rest form a ring around it.
 */
export function formationOffsets(squadSize: number, radius: number): {x: number; y: number}[] {
    const offsets = [{x: 0, y: 0}];
    const ring = squadSize - 1;
    for (let i = 0; i < ring; i++) {
        // Start at the top so a 3 member ring is a triangle pointing up behind the leader
        const angle = -Math.PI / 2 + (i * 2 * Math.PI) / ring;
        // Flatten vertically, the map is seen at an angle
        offsets.push({x: Math.round(Math.cos(angle) * radius), y: Math.round(Math.sin(angle) * radius * 0.6)});
    }
    return offsets;
}

/**
 * The squad's weapon timings. A rotating squad turns its members' single-shot weapons into one magazine with a slot per
 * member: after the members' wind-up, one slot comes up every `reload / squadSize` seconds and each member reloads for
 * the full `reload` after its own shot.
 */
export function squadVolleyStat(stat: Pick<UnitStat, "volley" | "rateOfFire" | "squadSize" | "squadFire">): VolleyStat {
    const member = volleyStatOf(stat);
    if (stat.squadFire !== "rotating" || stat.squadSize <= 1 || member.shots !== 1) return member;
    return {shots: stat.squadSize, initialChargeUp: member.initialChargeUp, shotInterval: member.reload / stat.squadSize, reload: member.reload};
}

/**
 * Members that shoot when the squad fires its next shot: every living member for a volley squad, otherwise the member
 * whose turn it is, or none when that member is dead.
 * @param ammo shots left in the magazine before firing
 */
export function shootingMembers(stat: Pick<UnitStat, "squadSize" | "squadFire">, alive: number, ammo: number): number[] {
    if (stat.squadFire !== "rotating" || stat.squadSize <= 1) {
        return Array.from({length: alive}, (_, i) => i);
    }
    const turn = stat.squadSize - ammo;
    return turn < alive ? [turn] : [];
}
