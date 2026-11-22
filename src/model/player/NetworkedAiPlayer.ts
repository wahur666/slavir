import Phaser from "phaser";
import type Building from "../../entities/Building.js";
import type Unit from "../../entities/Unit.js";
import type {UnitName} from "../../entities/UnitsStats.js";
import {defaultFont} from "../../helpers/utils.js";
import type NetClient from "../../net/NetClient.js";
import type {WireCommand} from "../../net/Observation.js";
import type {Command} from "../command/Command.js";
import type Systems from "../Systems.js";
import {buildMatchInfo, buildObservation, updateSeenBuildings} from "./ObservationBuilder.js";
import Player from "./Player.js";

/** Same cadence as the built-in AI's decisions */
export const OBSERVATION_INTERVAL_MS = 1000;
/** Command batches decided on an observation older than this many ticks (3 s) are dropped */
const MAX_COMMAND_AGE_TICKS = 180;

const COMMAND_KINDS = new Set<Command["kind"]>(["move", "attack", "attackBase", "stop", "disband", "build", "createUnit", "power", "surrender"]);

/**
 * Player 2 played by a remote AI over the network. The host's browser runs the simulation: this player sends the
 * remote AI its {@link buildObservation fair view} of the match every second and issues the commands it answers with.
 *
 * Commands arrive from the WebSocket handler, between simulation ticks, so the hub treats them as external input:
 * they take effect on the next tick and the replay recorder keeps them. Without a client (watching a replay of a
 * network match) the player does nothing; the recorded commands drive it.
 */
export default class NetworkedAiPlayer extends Player {
    private observationCoolDown = 0;
    private readonly seenEnemyBuildings = new Set<Building>();
    private readonly unsubscribe: (() => void)[] = [];
    connected: boolean;
    private statusText?: Phaser.GameObjects.Text;

    constructor(
        index: number,
        systems: Systems,
        private readonly client: NetClient | null
    ) {
        super(index, systems);
        this.connected = !!client;
        if (client) {
            this.unsubscribe.push(
                client.on("commands", message => this.receive(message.tick, message.commands)),
                client.on("peerLeft", ({member}) => {
                    if (member.role === "bot") this.setConnected(false);
                }),
                client.onStatus(status => {
                    if (status === "closed") this.setConnected(false);
                })
            );
            this.gameScene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.unsubscribe.forEach(off => off()));
        }
    }

    create(): void {
        super.create();
        this.client?.send({type: "matchStart", info: buildMatchInfo(this.systems, this, OBSERVATION_INTERVAL_MS)});
    }

    update(delta: number) {
        super.update(delta);
        if (!this.client) return;
        updateSeenBuildings(this, this.seenEnemyBuildings);
        this.observationCoolDown = Math.max(0, this.observationCoolDown - delta);
        if (this.observationCoolDown === 0 && this.gameScene.canIssueCommands) {
            this.client.send({type: "observation", obs: buildObservation(this.systems, this, this.gameScene.tick, this.seenEnemyBuildings)});
            this.observationCoolDown = OBSERVATION_INTERVAL_MS;
        }
    }

    createUnit(e: UnitName): Unit | null {
        const unit = super.createUnit(e);
        // Same tint as the built-in AI's units
        if (unit) unit.tint = 0xf6c5c5;
        return unit;
    }

    /** Issues a batch from the remote AI, always on this player's behalf */
    private receive(tick: number, commands: WireCommand[]) {
        if (this.gameScene.gameEnded || !Array.isArray(commands)) return;
        if (typeof tick !== "number" || this.gameScene.tick - tick > MAX_COMMAND_AGE_TICKS) return;
        for (const command of commands) {
            if (!command || !COMMAND_KINDS.has(command.kind)) continue;
            // The remote side may only ever command this player
            this.systems.commands.issue({...(command as unknown as Command), playerIndex: this.index});
        }
    }

    private setConnected(connected: boolean) {
        if (this.connected === connected) return;
        this.connected = connected;
        if (connected || this.gameScene.gameEnded) {
            this.statusText?.destroy();
            this.statusText = undefined;
            return;
        }
        this.statusText = this.gameScene.add
            .text(this.gameScene.scale.width / 2, 90, "Networked AI disconnected", {
                fontFamily: defaultFont,
                fontSize: "24px",
                color: "#ff6b6b",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(20);
    }
}
