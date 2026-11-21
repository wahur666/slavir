import Phaser from "phaser";
import PreloadScene, {START_SCENE_KEY} from "../scenes/PreloadScene.js";
import GameScene from "../scenes/GameScene.js";
import NetworkGameScene, {NET_CLIENT_KEY} from "../scenes/NetworkGameScene.js";
import PauseScene from "../scenes/PauseScene.js";
import ScoreScene from "../scenes/ScoreScene.js";
import {RETURN_TO_MENU_KEY, SceneRegistry} from "../scenes/SceneRegistry.js";
import {SHARED_CONFIG} from "../model/config.js";
import type NetClient from "../net/NetClient.js";

/**
 * Boots Phaser on a fresh canvas for one network match, straight into the network game scene once the assets are
 * loaded. "Return to menu" calls `onExit` instead of opening the main menu.
 * @returns destroys the game and its canvas
 */
export function bootGame(container: HTMLElement, client: NetClient, onExit: () => void): () => void {
    const canvas = document.createElement("canvas");
    canvas.id = "cv1";
    container.appendChild(canvas);
    const game = new Phaser.Game({
        ...SHARED_CONFIG,
        type: Phaser.WEBGL,
        // The plain game scene stays registered for watching a replay from the score screen
        scene: [PreloadScene, NetworkGameScene, GameScene, PauseScene, ScoreScene],
        render: {pixelArt: true},
        physics: {default: "arcade", arcade: {debug: SHARED_CONFIG.debug.arcade}},
        canvas,
        scale: {parent: container, mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH},
        callbacks: {
            preBoot: game => {
                game.registry.set(START_SCENE_KEY, SceneRegistry.NETWORK_GAME);
                game.registry.set(NET_CLIENT_KEY, client);
                game.registry.set(RETURN_TO_MENU_KEY, onExit);
            },
        },
    });
    return () => {
        game.destroy(true, false);
        canvas.remove();
    };
}
