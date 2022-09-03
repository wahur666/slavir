import Vector2 = Phaser.Math.Vector2;

/** Return (0..num-1) values */
export const range = (num: number): number[] => [...Array(num).keys()];

/** Converts Vector2 to [x, y] */
export function vector2ToArray(p: Vector2): [number, number] {
    return [p.x, p.y];
}

export const defaultFont = "Anton Regular, Arial, sans-serif";
