import type Phaser from "phaser";

export enum SceneRegistry {
    PRELOAD = "PreloadScene",
    GAME = "GameScene",
    PAUSE = "PauseScene",
    HEX_TEST = "HexTextScene",
    MENU = "MenuScene",
    SCORE = "ScoreScene",
    SANDBOX = "SandboxScene",
    NETWORK_GAME = "NetworkGameScene",
}

/** Registry key of a function that replaces "return to menu" (the network game page goes back to its lobby) */
export const RETURN_TO_MENU_KEY = "returnToMenu";

/** Goes to the main menu, or wherever the page registered under {@link RETURN_TO_MENU_KEY} */
export function returnToMenu(scene: Phaser.Scene): void {
    const handler = scene.registry.get(RETURN_TO_MENU_KEY);
    if (typeof handler === "function") {
        handler();
    } else {
        scene.scene.start(SceneRegistry.MENU);
    }
}
