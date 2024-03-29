export const enum TILESETS {
    Hex_v01_grid = "Hex_v01_grid"
}

export const enum LAYERS {
    BASE = "base"
}

export function findObjectByProperty(objects: Phaser.Types.Tilemaps.TiledObject[], property: string, value: any): Phaser.Types.Tilemaps.TiledObject | undefined {
    for (const object of objects) {
        for (const property1 of object.properties) {
            if (property1.name === property && property1.value === value) {
                return object;
            }
        }
    }
    return undefined;
}

export function getPropertyValue<T>(object: Phaser.Types.Tilemaps.TiledObject, property: string): T | undefined {
    return object.properties.find(e => e.name === property)?.value;
}
