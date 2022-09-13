import type GameTile from "../GameTile";
import type HexMap from "../HexMap";
import {Pathfinding} from "../HexMap";
import Heap from "heap-js";
import Vector2 = Phaser.Math.Vector2;

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

    constructor(private hexMap: HexMap, private baseOffset: Vector2, private scaleFactor: number) {
    }

    private createNode(tile: GameTile, mask: number, start: GameTile, end: GameTile): Node {
        return new Node(tile, Boolean(tile.pathfinding & mask), start, end);
    }

    private nodeNeighbours(node: Node, mask: number, start: GameTile, end: GameTile): Node[] {
        const neighbours: Node[] = [];
        for (const hex of node.tile.hex.neighbours()) {
            const tile = this.hexMap.hexToTile(hex);
            if (tile) {
                neighbours.push(this.createNode(tile, mask, start, end));
            }
        }
        return neighbours;
    }

    private findPath(start: GameTile, end: GameTile, mask: number, nearestFree = 0, dynamicObstacles: GameTile[]): GameTile[] {
        if ((!Boolean(start.pathfinding & mask) || !Boolean(end.pathfinding & mask))) {
            return [];
        }
        const open = new Heap<Node>((a, b) => {
            return a.fCost - b.fCost || a.hCost - b.hCost;
        });
        open.push(this.createNode(start, mask, start, end));
        const closed: Node[] = [];
        while (open.size() !== 0) {
            const current = open.pop();
            if (!current) {
                continue;
            }
            closed.push(current);
            if (current.tile === end) {
                return this.retracePath(start, current, mask, nearestFree, dynamicObstacles);
            }

            for (const node of this.nodeNeighbours(current, mask, start, end)) {
                if (!node.walkable || closed.find(e => e.tile.equals(node.tile))) {
                    continue;
                }
                if (dynamicObstacles.find(dynOb => node.tile.equals(dynOb))) {
                    continue;
                }
                const newMovementCostToNeighbour = current.cost(start) + current.cost(node.tile);
                if (newMovementCostToNeighbour < node.cost(start) || !open.contains(node)) {
                    node.gCost = newMovementCostToNeighbour;
                    node.hCost = node.cost(end);
                    node.parent = current;
                    if (!open.contains(node, (a, b) => a.tile.equals(b.tile))) {
                        open.add(node);
                    }
                }
            }
        }
        return [];
    }

    public findPathAsVector2(start: GameTile, end: GameTile, mask: number, nearestFree = 0, dynamicObstacles: GameTile[]): Vector2[] {
        return this.findPath(start, end, mask, nearestFree, dynamicObstacles).map(e => this.calculateNavPoint(e));
    }

    public checkBlockade(start: GameTile, end: GameTile): boolean {
        return this.hexMap.getTileHits(start, end).every(e => e.tile.pathfinding !== Pathfinding.OBSTACLE);
    }

    private retracePath(start: GameTile, current: Node, mask: number, nearestFree: number, dynamicObstacles: GameTile[]): GameTile[] {
        let path: GameTile[] = [];
        while (current.parent) {
            path.unshift(current.tile);
            current = current.parent;
        }
        path.unshift(start);
        for (let i = 0; i < nearestFree; i++) {
            path.pop();
        }
        if (path.length > 2) {
            while (true) {
                const tilesToRemove: Set<number> = new Set();
                for (let i = 0; i < path.length - 1; i++) {
                    let bestForwardPosition = -1;
                    for (let j = i + 1; j < path.length; j++) {
                        const currentTile = path[i];
                        const destTile = path[j];
                        if (this.hexMap.getTileHits(currentTile, destTile).every(e => {
                            return (e.tile.pathfinding & mask)
                                && (!dynamicObstacles.find(dynOb => dynOb.equals(e.tile)))
                                && this.checkNavMesh(currentTile, destTile, mask);
                        })) {
                            bestForwardPosition = j;
                        } else {
                            break;
                        }
                    }
                    if (bestForwardPosition !== -1) {
                        const point1 = this.hexMap.layout.hexToPixel(path[i].hex);
                        const point2 = this.hexMap.layout.hexToPixel(path[bestForwardPosition].hex);
                        let sumOfBetweenPoints = 0;
                        for (let start = i; start < bestForwardPosition; start++) {
                            const point1 = this.hexMap.layout.hexToPixel(path[start].hex);
                            const point2 = this.hexMap.layout.hexToPixel(path[start + 1].hex);
                            sumOfBetweenPoints += point1.distance(point2);
                        }

                        const currentDistance = point1.distance(point2);
                        if (currentDistance < sumOfBetweenPoints) {
                            for (let c = i + 1; c < bestForwardPosition; c++) {
                                tilesToRemove.add(c);
                            }
                        }
                    }
                }
                if (tilesToRemove.size > 0) {
                    path = path.filter((value, index) => !tilesToRemove.has(index));
                } else {
                    break;
                }
            }
        }
        return path;
    }

    // returns true if the line from (a,b)->(c,d) intersects with (p,q)->(r,s)
    private intersects(a: number, b: number, c: number, d: number, p: number, q: number, r: number, s: number): boolean {
        const det = (c - a) * (s - q) - (r - p) * (d - b);
        if (det === 0) {
            return false;
        } else {
            const lambda = ((s - q) * (r - a) + (p - r) * (s - b)) / det;
            const gamma = ((b - d) * (r - a) + (c - a) * (s - b)) / det;
            return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
        }
    }

    private intersects2(start1: Vector2, end1: Vector2, start2: Vector2, end2: Vector2) {
        return this.intersects(start1.x, start1.y, end1.x, end1.y, start2.x, start2.y, end2.x, end2.y);
    }

    private checkNavMesh(currentTile: GameTile, tileToCheck: GameTile, mask: number): boolean {
        const point1 = this.hexMap.layout.hexToPixel(currentTile.hex);
        const point2 = this.hexMap.layout.hexToPixel(tileToCheck.hex);
        return this.checkNavMeshBetweenPoints(point1, point2, mask);
    }

    private checkNavMeshBetweenPoints(point1: Vector2, point2: Vector2, mask: number): boolean {
        const polygons = this.hexMap.generateNavigationPolygons2(mask);
        const intersections: Vector2[][] = [];
        for (const polygon of polygons) {
            for (let i = 0; i < polygon.length - 1; i++) {
                const point3 = polygon[i];
                const point4 = polygon[i + 1];
                if (this.intersects2(point1, point2, point3, point4)) {
                    intersections.push(polygon);
                    break;
                }
            }
        }
        return intersections.length === 0;
    }

    private calculateNavPoint(gameTile: GameTile): Vector2 {
        return this.hexMap.getCenter(gameTile).add(this.baseOffset).scale(this.scaleFactor);
    }
}
