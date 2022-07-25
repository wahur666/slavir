import Player from "./Player";
import type GameScene from "../../scenes/GameScene";
import Pointer = Phaser.Input.Pointer;


export default class HumanPlayer extends Player {

    constructor(index: number, private gameScene: GameScene) {
        super(index);
        this.setupHandlers();
    }

    setupHandlers() {
        this.gameScene.input.on("pointerdown", (ev: Pointer) => {

        });
    }

}
