function lerp(a: number, b: number, t: number) {
    return a * (1 - t) + b * t;
}


export class Hex {
    constructor(public q: number, public r: number, public s = -q-r) {
    }

    equals(hex: Hex): boolean {
        return this.q === hex.q && this.r === hex.r && this.s === hex.s;
    }

    add(hex: Hex): Hex {
        return new Hex(this.q + hex.q, this.r + hex.r, this.s + hex.s);
    }

    sub(hex: Hex): Hex {
        return new Hex(this.q - hex.q, this.r - hex.r, this.s - hex.s);
    }

    mul(hex: Hex): Hex {
        return new Hex(this.q * hex.q, this.r * hex.r, this.s * hex.s);
    }

    length(): number {
        return (Math.abs(this.q) + Math.abs(this.r) + Math.abs(this.s)) / 2 | 0;
    }

    distance(hex: Hex): number {
        return this.sub(hex).length();
    }

    static directions:Hex[] = [new Hex(1, 0, -1), new Hex(1, -1, 0), new Hex(0, -1, 1), new Hex(-1, 0, 1), new Hex(-1, 1, 0), new Hex(0, 1, -1)];

    static direction(direction:number):Hex
    {
        return Hex.directions[direction];
    }

    neighbor(direction:number):Hex
    {
        return this.add(Hex.direction(direction));
    }


    round(): Hex {
        let q = Math.round(this.q) | 0;
        let r = Math.round(this.r) | 0;
        let s = Math.round(this.s) | 0;
        const qDiff = Math.abs(q - this.q);
        const rDiff = Math.abs(r - this.r);
        const sDiff = Math.abs(s - this.s);
        if (qDiff > rDiff && qDiff > sDiff) {
            q = -r - s;
        } else if (rDiff > sDiff) {
            r = -q - s;
        } else {
            s = -q - r;
        }
        return new Hex(q, r, s);
    }

    lerp(b: Hex, t: number): Hex {
        return new Hex(lerp(this.q, b.q, t), lerp(this.r, b.r, t), lerp(this.s, b.s, t));
    }

    lineDraw(b: Hex): Hex[] {
        const N = this.distance(b);
        const aNudge: Hex = new Hex(this.q + 1e-06, this.r + 1e-06, this.s - 2e-06);
        const bNudge: Hex = new Hex(b.q + 1e-06, b.r + 1e-06, b.s - 2e-06);
        const results: Hex[] = [];
        const step = 1 / Math.max(N, 1);
        for (let i = 0; i <= N; i++) {
            results.push(aNudge.lerp(bNudge, step * i).round());
        }
        const cNudge: Hex = new Hex(this.q - 1e-06, this.r - 1e-06, this.s + 2e-06);
        const dNudge: Hex = new Hex(b.q - 1e-06, b.r - 1e-06, b.s + 2e-06);
        for (let i = 0; i <= N; i++) {
            const hex = cNudge.lerp(dNudge, step * i).round();
            if (!results.find(e => e.equals(hex))) {
                results.push(hex);
            }
        }
        return results;
    }

    neighbours(): Hex[] {
        const res: Hex[] = [];
        for (let i = 0; i < 6; i++) {
            const neighbour = this.neighbor(i);
            res.push(neighbour);
        }
        return res;
    }
}
