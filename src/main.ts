import GameScene from "./scenes/GameScene";
import Phaser from "phaser";
import GameConfig = Phaser.Types.Core.GameConfig;
import PreloadScene from "./scenes/PreloadScene";
import MenuScene from "./scenes/MenuScene";
import "./style.css";


const scenes = [PreloadScene, MenuScene, GameScene];
const createScene = scene => new scene(SHARED_CONFIG);
const initScenes = () => scenes.map(createScene);


export const SHARED_CONFIG = {
    width: 1280,
    height: 720,
    debug: {
        arcade: false,
        hexes: false,
        navMesh: false,
        autoLoadGame: true
    }
};

const config: GameConfig = {
    ...SHARED_CONFIG,
    type: Phaser.WEBGL,
    scene: initScenes(),
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
