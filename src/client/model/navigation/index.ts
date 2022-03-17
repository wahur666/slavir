import GameTile from "../GameTile";

export class Node {
    constructor(public tile: GameTile,
                public walkable = true) {
    }
}

export class Navigation {

    edges: Map<Node, Node[]>;

    constructor() {

    }

}
