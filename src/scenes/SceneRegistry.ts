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

/** URL of the site's homepage; the game pages (/play/, /networkgame/) live one folder below it */
export const HOME_PAGE_URL = "../";

/** Adds a "← Home page" link to the top left corner that leaves the game for the site's homepage */
export function addHomePageLink(scene: Phaser.Scene, fontFamily: string): Phaser.GameObjects.Text {
    return scene.add
        .text(20, 20, "← Home page", {
            fontFamily,
            fontSize: "26px",
            color: "#ffd27a",
            stroke: "#000000",
            strokeThickness: 4,
        })
        .setInteractive({useHandCursor: true})
        .on("pointerup", () => {
            window.location.href = HOME_PAGE_URL;
        });
}

/** Goes to the main menu, or wherever the page registered under {@link RETURN_TO_MENU_KEY} */
export function returnToMenu(scene: Phaser.Scene): void {
    const handler = scene.registry.get(RETURN_TO_MENU_KEY);
    if (typeof handler === "function") {
        handler();
    } else {
        scene.scene.start(SceneRegistry.MENU);
    }
}
