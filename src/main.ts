import GameScene from "./scenes/GameScene.js";
import Phaser from "phaser";
import GameConfig = Phaser.Types.Core.GameConfig;
import PreloadScene from "./scenes/PreloadScene.js";
import MenuScene from "./scenes/MenuScene.js";
import "./style.css";
import {SHARED_CONFIG} from "./model/config.js";
import ScoreScene from "./scenes/ScoreScene.js";
import PauseScene from "./scenes/PauseScene.js";

const config: GameConfig = {
    ...SHARED_CONFIG,
    type: Phaser.WEBGL,
    scene: [PreloadScene, MenuScene, GameScene, PauseScene, ScoreScene],

    render: {
        pixelArt: true,
    },
    physics: {
        default: "arcade",
        arcade: {
            debug: SHARED_CONFIG.debug.arcade,
        },
    },
    canvas: document.getElementById("cv1") as HTMLCanvasElement,
    // Fill the page while keeping the 16:9 aspect ratio; letterboxed on the page background
    scale: {parent: "root", mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
};

let game: Phaser.Game;
window.addEventListener("load", ev => {
    game = new Phaser.Game(config);
});

window.addEventListener("beforeunload", ev => {
    game.destroy(true, false);
});
