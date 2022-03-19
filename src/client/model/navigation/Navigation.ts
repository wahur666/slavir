import GameTile from "../GameTile";
import HexMap from "../HexMap";
import Heap from 'heap-js';
import GetLineToPolygon = Phaser.Geom.Intersects.GetLineToPolygon;
import Line = Phaser.Geom.Line;
import Vector4 = Phaser.Math.Vector4;

class Node {
    public parent: Node | undefined = undefined;
    public gCost: number;
    public hCost: number;

    constructor(public tile: GameTile,
                public walkable: boolean,
                start: GameTile,
                end: GameTile) {
        this.gCost = this.cost(start);
        this.hCost = this.cost(end);
    }

    get fCost(): number {
        return this.gCost + this.hCost;
    }

    cost(tile: GameTile) {
        return this.tile.distance(tile);
    }

}


export class Navigation {

    constructor(public hexMap: HexMap) {}

    createNode(tile: GameTile, mask: number, start: GameTile, end: GameTile): Node {
        return new Node(tile, Boolean(tile.pathfinding & mask), start, end);
    }

    nodeNeighbours(node: Node, mask: number, start: GameTile, end: GameTile): Node[] {
        const neighbours: Node[] = [];
        for (const hex of node.tile.hex.neighbours()) {
            const tile = this.hexMap.hexToTile(hex);
            if (tile) {
                neighbours.push(this.createNode(tile, mask, start, end));
            }
        }
        return neighbours;
    }

    findPath(start: GameTile, end: GameTile, mask: number): GameTile[] {
        if ((!Boolean(start.pathfinding & mask) || !Boolean(end.pathfinding & mask))) {
            return [];
        }
        const open = new Heap<Node>((a, b) => {
            return a.fCost - b.fCost || a.hCost - b.hCost;
        });
        open.push(this.createNode(start, mask, start, end));
        const closed = new Set<Node>();
        while (open.size() !== 0) {
            const current = open.pop();
            if (!current) {
                continue;
            }
            closed.add(current);
            if (current.tile === end) {
                return this.retracePath(start, current, mask);
            }

            for (const node of this.nodeNeighbours(current, mask, start, end)) {
                if (!node.walkable || closed.has(node)) {
                    continue;
                }
                const newMovementCostToNeighbour = current.cost(start) + current.cost(node.tile);
                if (newMovementCostToNeighbour < node.cost(start) || !open.contains(node)) {
                    node.gCost = newMovementCostToNeighbour;
                    node.hCost = node.cost(end);
                    node.parent = current;
                    if (!open.contains(node)) {
                        open.add(node);
                    }
                }
            }
        }
        return [];
    }

    retracePath(start: GameTile, current: Node, mask: number): GameTile[] {
        const path: GameTile[] = [];
        while (current.parent) {
            path.unshift(current.tile);
            current = current.parent;
        }
        path.unshift(start);
        if (path.length > 2) {
            const tilesToRemove: Set<number> = new Set();
            let currentIndex = 0;
            let currentTile = path[currentIndex];
            for (let i = 1; i < path.length; i++) {
                if (i - currentIndex === 1) {
                    continue;
                }
                const tileToCheck = path[i];
                if (this.hexMap.getTileHits(currentTile, tileToCheck)
                    .every(e => (e.tile.pathfinding & mask) && this.checkNavMesh(currentTile, tileToCheck, mask))) {
                    tilesToRemove.add(i - 1);
                } else {
                    currentIndex = i;
                    currentTile = path[currentIndex];
                }
            }
            return path.filter((value, index) => !tilesToRemove.has(index));
        }
        return path;
    }

    private checkNavMesh(currentTile: GameTile, tileToCheck: GameTile, mask: number): boolean {
        const polygons = this.hexMap.generateNavigationPolygons(mask);
        const point1 = this.hexMap.layout.hexToPixel(currentTile.hex);
        const point2 = this.hexMap.layout.hexToPixel(tileToCheck.hex);
        return polygons.filter(e => {
            let out: Vector4 = new Vector4();
            GetLineToPolygon(new Line(point1.x, point1.y, point2.x, point2.y), e, out);
            return out.length() > 0 && 0 < out.z && out.z <= 1;
        }).length === 0;
    }
}
