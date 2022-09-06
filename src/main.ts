import GameScene from "./scenes/GameScene";
import Phaser from "phaser";
import GameConfig = Phaser.Types.Core.GameConfig;
import PreloadScene from "./scenes/PreloadScene";
import MenuScene from "./scenes/MenuScene";
import "./style.css";
import {SHARED_CONFIG} from "./model/config";


const config: GameConfig = {
    ...SHARED_CONFIG,
    type: Phaser.WEBGL,
    scene: [PreloadScene, MenuScene, GameScene],

    render: {
        pixelArt: true,
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: SHARED_CONFIG.debug.arcade
        }
    },
    canvas: document.getElementById("cv1") as HTMLCanvasElement,
};

let game: Phaser.Game;
window.addEventListener("load", ev => {
    game = new Phaser.Game(config);
});


window.addEventListener("beforeunload", ev => {
    game.destroy(true, false);
});
