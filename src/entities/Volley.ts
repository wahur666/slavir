/** Burst-fire timings, all in seconds */
export interface VolleyStat {
    /** Shots in a full magazine */
    shots: number;
    /** Wind-up after the unit settles on a hex center with a target in range, before the first shot */
    initialChargeUp: number;
    /** Minimum time between two consecutive shots */
    shotInterval: number;
    /** Time to refill the whole magazine; starts as soon as the magazine is no longer full */
    reload: number;
}

/**
 * Tracks the ammo and timers of a unit's weapon.
 *
 * A single-shot weapon ({shots: 1, initialChargeUp: 0, shotInterval: 0, reload: rateOfFire}) behaves exactly like a
 * plain rate-of-fire cooldown.
 */
export default class Volley {
    ammo: number;
    /** ms of wind-up left before the first shot can be fired */
    chargeLeft: number;
    /** ms until the next shot of the current magazine may be fired */
    shotCoolDown = 0;
    /** ms until the magazine is full again, 0 when not reloading */
    reloadLeft = 0;

    constructor(readonly stat: VolleyStat) {
        this.ammo = stat.shots;
        this.chargeLeft = stat.initialChargeUp * 1000;
    }

    /**
     * Advance the timers
     * @param delta elapsed ms
     * @param engaged the unit stands on a hex center with its target in range; when not, the wind-up starts over
     */
    update(delta: number, engaged: boolean) {
        if (this.reloadLeft > 0) {
            this.reloadLeft = Math.max(0, this.reloadLeft - delta);
            if (this.reloadLeft === 0) {
                this.ammo = this.stat.shots;
            }
        }
        this.shotCoolDown = Math.max(0, this.shotCoolDown - delta);
        this.chargeLeft = engaged ? Math.max(0, this.chargeLeft - delta) : this.stat.initialChargeUp * 1000;
    }

    get ready(): boolean {
        return this.ammo > 0 && this.shotCoolDown === 0 && this.chargeLeft === 0;
    }

    fire() {
        this.ammo--;
        this.shotCoolDown = this.stat.shotInterval * 1000;
        if (this.reloadLeft === 0) {
            this.reloadLeft = this.stat.reload * 1000;
        }
    }

    /** ms until the weapon could fire again, ignoring the wind-up */
    get coolDown(): number {
        return this.ammo > 0 ? this.shotCoolDown : this.reloadLeft;
    }

    /** 0..1 progress of the running reload, 1 when not reloading */
    get reloadProgress(): number {
        return this.reloadLeft === 0 ? 1 : 1 - this.reloadLeft / (this.stat.reload * 1000);
    }

    /** Full magazine, no cooldowns */
    reset() {
        this.ammo = this.stat.shots;
        this.shotCoolDown = 0;
        this.reloadLeft = 0;
        this.chargeLeft = this.stat.initialChargeUp * 1000;
    }
}

export function volleyStatOf(stat: {volley?: VolleyStat; rateOfFire: number}): VolleyStat {
    return stat.volley ?? {shots: 1, initialChargeUp: 0, shotInterval: 0, reload: stat.rateOfFire};
}
