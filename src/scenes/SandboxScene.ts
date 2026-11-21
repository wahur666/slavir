import Phaser from "phaser";
import GameScene from "./GameScene.js";
import {SceneRegistry} from "./SceneRegistry.js";
import Systems from "../model/Systems.js";
import {SandboxEnemyPlayer, SandboxHumanPlayer} from "../model/player/SandboxPlayers.js";
import type Player from "../model/player/Player.js";
import type {UnitStat} from "../entities/UnitsStats.js";
import {unitStatMap} from "../entities/units/UnitRegistry.js";
import {defaultFont} from "../helpers/utils.js";
import {SHARED_CONFIG} from "../model/config.js";

const BUTTON_WIDTH = 108;
const BUTTON_HEIGHT = 40;
const BUTTON_GAP = 8;
const ROWS_LEFT = 110;
const PLAYER_ROW_Y = 620;
const ENEMY_ROW_Y = 670;
const PLAYER_COLOR = 0x2b4a7a;
const ENEMY_COLOR = 0x7a2b2b;

/**
 * Unit testing ground, served at /sandbox/. Same map and unit rules as a match, but:
 * - no countdown, timer, objective, economy, AI or end of game
 * - no fog of war: the whole map is shown and both sides see every enemy unit (firing still needs attack range)
 * - buttons spawn any unit for either side for free; enemy units cannot be controlled and never move
 */
export default class SandboxScene extends GameScene {
    private messageText: Phaser.GameObjects.Text;

    constructor() {
        super(SceneRegistry.SANDBOX);
    }

    create() {
        super.create();
        this.countdownRemaining = 0;
    }

    protected createSystems(): Systems {
        return new Systems(this, {scaleFactor: this.scaleFactor, width: SHARED_CONFIG.width, height: SHARED_CONFIG.height}, systems => [
            new SandboxHumanPlayer(1, systems),
            new SandboxEnemyPlayer(2, systems),
        ]);
    }

    protected setupHud() {
        this.add
            .text(12, 16, "SANDBOX  ·  click your unit to select it, click a hex to move, click an enemy to attack, F removes the selected unit", {
                fontFamily: defaultFont,
                fontSize: "16px",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setDepth(20);
        this.messageText = this.add
            .text(SHARED_CONFIG.width / 2, 580, "", {
                fontFamily: defaultFont,
                fontSize: "16px",
                color: "#ffd27a",
                stroke: "#000000",
                strokeThickness: 4,
            })
            .setOrigin(0.5)
            .setDepth(20);
        this.addRow("You", PLAYER_ROW_Y, PLAYER_COLOR, this.player1);
        this.addRow("Enemy", ENEMY_ROW_Y, ENEMY_COLOR, this.player2);
        const clearX = ROWS_LEFT + unitStatMap.size * (BUTTON_WIDTH + BUTTON_GAP) + 50;
        this.addButton(clearX, (PLAYER_ROW_Y + ENEMY_ROW_Y) / 2, 100, BUTTON_HEIGHT * 2 + BUTTON_GAP, 0x444444, "Clear all", "", () =>
            this.clearUnits()
        );
    }

    private addRow(label: string, y: number, color: number, player: Player) {
        this.add.text(20, y, label, {fontFamily: defaultFont, fontSize: "20px", stroke: "#000000", strokeThickness: 4}).setOrigin(0, 0.5);
        [...unitStatMap.values()].forEach((stat, index) => {
            const x = ROWS_LEFT + index * (BUTTON_WIDTH + BUTTON_GAP) + BUTTON_WIDTH / 2;
            this.addButton(x, y, BUTTON_WIDTH, BUTTON_HEIGHT, color, stat.reference, stat.texture, () => this.spawn(player, stat));
        });
    }

    private addButton(x: number, y: number, width: number, height: number, color: number, title: string, subtitle: string, onClick: () => void) {
        const bg = this.add.rectangle(x, y, width, height, color).setStrokeStyle(2, 0xffffff, 0.6).setDepth(20).setInteractive({useHandCursor: true});
        this.add
            .text(x, subtitle ? y - 7 : y, title, {fontFamily: defaultFont, fontSize: "15px"})
            .setOrigin(0.5)
            .setDepth(21);
        if (subtitle) {
            this.add
                .text(x, y + 10, subtitle, {fontFamily: "sans-serif", fontSize: "11px", color: "#c8d0dc"})
                .setOrigin(0.5)
                .setDepth(21);
        }
        bg.on("pointerover", () => bg.setFillStyle(Phaser.Display.Color.IntegerToColor(color).lighten(15).color));
        bg.on("pointerout", () => bg.setFillStyle(color));
        bg.on("pointerup", onClick);
    }

    private spawn(player: Player, stat: UnitStat) {
        const unit = player.placeUnit(stat);
        this.messageText.setText(unit ? "" : `No free hex left for ${stat.reference}`);
    }

    private clearUnits() {
        for (const player of this.systems.players) {
            for (const unit of [...player.units]) {
                player.disband(unit);
            }
        }
        this.messageText.setText("");
    }

    drawVisibleTiles() {
        // No fog of war: both sides see every enemy unit, so any unit can be ordered to attack anything.
        // Units still only fire at targets within their attack range.
        for (const player of this.systems.players) {
            player.visibleEnemyUnits = player.enemyPlayer.units.filter(unit => !unit.markedForDeletion);
        }
        for (const unit of this.player2.units) {
            unit.setActivelyVisible(true);
        }
        for (const building of this.player2.buildings) {
            if (!building.revealed) building.setRevealed(true);
        }
        for (const tile of this.systems.map.tiles) {
            this.drawVisibility(tile, true);
        }
    }

    update(_time: number, delta: number) {
        this.fpsText.setText(`${(1000 / delta) | 0} FPS`);
        this.drawVisibleTiles();
        for (const unit of this.player1.units) {
            unit.update(delta);
        }
        for (const unit of this.player2.units) {
            unit.update(delta);
        }
        this.systems.commands.update(delta);
    }
}
