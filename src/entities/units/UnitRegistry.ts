import type {UnitName, UnitStat} from "../UnitsStats.js";
import Fantasy8 from "./Fantasy8.js";
import FemaleArcher from "./FemaleArcher.js";
import Robot5 from "./Robot5.js";
import Guard from "./Guard.js";
import DemonDragon from "./DemonDragon.js";
import BlackDragon from "./BlackDragon.js";
import Wolverine from "./Wolverine.js";
import Titan from "./Titan.js";
import Harvester from "./Harvester.js";

/** Every playable unit class, in card order */
export const unitClasses = [Fantasy8, FemaleArcher, Robot5, Guard, DemonDragon, BlackDragon, Wolverine, Titan, Harvester] as const;

export const unitStatMap: Map<UnitName, UnitStat> = new Map(unitClasses.map(unitClass => [unitClass.stat.texture, unitClass.stat] as const));
