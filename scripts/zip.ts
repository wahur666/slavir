/**
 * Packs a build output folder into a zip, with the folder's contents at the archive root.
 * Usage: tsx scripts/zip.ts [sourceDir=public] [outFile=slavir.zip], both relative to the repo root.
 * Dependency-free so `npm run release` works the same on Windows, Linux and macOS without a zip binary.
 */
import {readdirSync, readFileSync, statSync, writeFileSync} from "node:fs";
import {join, relative, resolve, sep} from "node:path";
import {crc32, deflateRawSync} from "node:zlib";

const root = resolve(import.meta.dirname, "..");
const sourceDir = resolve(root, process.argv[2] ?? "public");
const outFile = resolve(root, process.argv[3] ?? "slavir.zip");

function listFiles(dir: string): string[] {
    return readdirSync(dir, {withFileTypes: true}).flatMap(entry => {
        const path = join(dir, entry.name);
        return entry.isDirectory() ? listFiles(path) : entry.isFile() ? [path] : [];
    });
}

/** MS-DOS time and date fields used by the zip format */
function dosDateTime(date: Date): {time: number; date: number} {
    return {
        time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
        date: ((Math.max(date.getFullYear(), 1980) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
    };
}

const localParts: Buffer[] = [];
const centralParts: Buffer[] = [];
let offset = 0;

const files = listFiles(sourceDir).sort();
if (files.length === 0) {
    throw new Error(`${sourceDir} is empty, run the build first`);
}

for (const file of files) {
    const name = Buffer.from(relative(sourceDir, file).split(sep).join("/"), "utf8");
    const data = readFileSync(file);
    const deflated = deflateRawSync(data, {level: 9});
    // Store already-compressed files (images, audio) when deflate does not help
    const useDeflate = deflated.length < data.length;
    const body = useDeflate ? deflated : data;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(data);
    const {time, date} = dosDateTime(statSync(file).mtime);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); // local file header signature
    local.writeUInt16LE(20, 4); // version needed to extract
    local.writeUInt16LE(0x0800, 6); // flags: UTF-8 file names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28); // extra field length

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); // central directory header signature
    central.writeUInt16LE(20, 4); // version made by
    central.writeUInt16LE(20, 6); // version needed to extract
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    // extra field, comment, disk number, attributes stay 0
    central.writeUInt32LE(offset, 42); // offset of the local header

    localParts.push(local, name, body);
    centralParts.push(central, name);
    offset += local.length + name.length + body.length;
}

const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end of central directory signature
end.writeUInt16LE(files.length, 8); // entries on this disk
end.writeUInt16LE(files.length, 10); // total entries
end.writeUInt32LE(centralSize, 12);
end.writeUInt32LE(offset, 16); // central directory offset

// Written fresh every time, so files removed from the build never linger in the archive
writeFileSync(outFile, Buffer.concat([...localParts, ...centralParts, end]));
console.log(`Wrote ${relative(root, outFile)} (${files.length} files, ${(offset / 1024 / 1024).toFixed(2)} MiB)`);
