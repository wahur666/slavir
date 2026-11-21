import Phaser from "phaser";
import GameScene, {type GameSceneData} from "./GameScene.js";
import {SceneRegistry} from "./SceneRegistry.js";
import Systems from "../model/Systems.js";
import HumanPlayer from "../model/player/HumanPlayer.js";
import NetworkedAiPlayer from "../model/player/NetworkedAiPlayer.js";
import type NetClient from "../net/NetClient.js";
import type {Replay} from "../model/replay/Replay.js";
import {SHARED_CONFIG} from "../model/config.js";

/** Registry key of the lobby's {@link NetClient}, set by the network game page before the game boots */
export const NET_CLIENT_KEY = "netClient";

/**
 * A match against a networked AI: the human is player 1 as usual, player 2 is a {@link NetworkedAiPlayer} that
 * talks to a bot over the lobby's WebSocket connection. This browser runs the simulation.
 */
export default class NetworkGameScene extends GameScene {
    private client: NetClient;
    private matchEndSent = false;

    constructor() {
        super(SceneRegistry.NETWORK_GAME);
    }

    create(data?: GameSceneData) {
        this.client = this.registry.get(NET_CLIENT_KEY) as NetClient;
        this.matchEndSent = false;
        super.create(data);
        // Leaving mid-match (pause menu, closing the game) tells the bot the match is over
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.sendMatchEnd(null));
        this.events.once(Phaser.Scenes.Events.DESTROY, () => this.sendMatchEnd(null));
    }

    protected createSystems(): Systems {
        const dimensions = {scaleFactor: this.scaleFactor, width: SHARED_CONFIG.width, height: SHARED_CONFIG.height};
        return new Systems(this, dimensions, systems => [new HumanPlayer(1, systems), new NetworkedAiPlayer(2, systems, this.client)]);
    }

    protected get replayMode(): Replay["mode"] {
        return "network";
    }

    endGame(result: boolean) {
        const alreadyEnded = this.gameEnded;
        super.endGame(result);
        if (!alreadyEnded) this.sendMatchEnd(result ? this.player1.index : this.player2.index);
    }

    private sendMatchEnd(winnerIndex: number | null) {
        if (this.matchEndSent) return;
        this.matchEndSent = true;
        this.client?.send({type: "matchEnd", winnerIndex});
    }
}
