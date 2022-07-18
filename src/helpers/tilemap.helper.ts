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
