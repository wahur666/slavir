import Phaser from "phaser";
import PreloadScene, {START_SCENE_KEY} from "../scenes/PreloadScene.js";
import SandboxScene from "../scenes/SandboxScene.js";
import {SceneRegistry} from "../scenes/SceneRegistry.js";
import {SHARED_CONFIG} from "../model/config.js";
import "../style.css";

/** Sandbox entry, served at /sandbox/: loads the assets, then opens the sandbox scene instead of the menu */
const config: Phaser.Types.Core.GameConfig = {
    ...SHARED_CONFIG,
    type: Phaser.WEBGL,
    scene: [PreloadScene, SandboxScene],
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
    callbacks: {
        preBoot: game => game.registry.set(START_SCENE_KEY, SceneRegistry.SANDBOX),
    },
};

let game: Phaser.Game;
window.addEventListener("load", () => {
    game = new Phaser.Game(config);
});

window.addEventListener("beforeunload", () => {
    game.destroy(true, false);
});
