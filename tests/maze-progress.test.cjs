const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sandbox = vm.createContext({});
for (const file of ["maze-content.js", "maze-progress.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", file), "utf8"), sandbox);
}
const { create, levels, limit } = vm.runInContext("({ create: createMazeProgress, levels: MAZE_LEVELS, limit: MAZE_COMMAND_LIMIT })", sandbox);
const key = "robocode-maze-progress";
const ids = levels.map(level => level.id);
const plain = value => JSON.parse(JSON.stringify(value));

function storage(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test("existing profile is preserved while progress and drafts survive reload", () => {
    const profile = JSON.stringify({ name: "Бала", class: 3, robot: "red", xp: 17, level: 2, extra: true });
    const disk = storage({ "robocode-player": profile });
    const first = create(levels, () => disk);
    first.setProgram(ids[0], ["right", "right", "right"]);
    first.complete(ids[0]);
    first.select(ids[1]);
    first.setProgram(ids[1], ["down"]);
    const restored = create(levels, () => disk);
    assert.equal(disk.getItem("robocode-player"), profile);
    assert.deepEqual(plain(restored.snapshot().completed), [ids[0]]);
    assert.deepEqual(plain(restored.snapshot().programs), { [ids[0]]: ["right", "right", "right"], [ids[1]]: ["down"] });
    assert.equal(restored.resumeLevelId(), ids[1]);
});

test("completion is idempotent, skips completed levels and supports all complete", () => {
    const progress = create(levels, () => storage());
    progress.complete(ids[0]);
    progress.complete(ids[0]);
    assert.equal(progress.snapshot().completed.length, 1);
    assert.equal(progress.resumeLevelId(), ids[1]);
    for (const id of ids) progress.complete(id);
    assert.equal(progress.resumeLevelId(), ids.at(-1));
    assert.equal(progress.snapshot().completed.length, 4);
});

test("stable level ids preserve progress when content order changes", () => {
    const disk = storage();
    const progress = create(levels, () => disk);
    progress.complete(ids[0]);
    progress.setProgram(ids[2], ["right"]);
    const restored = create([...levels].reverse(), () => disk);
    assert.deepEqual(plain(restored.snapshot().completed), [ids[0]]);
    assert.equal(restored.snapshot().currentLevelId, ids[2]);
    assert.deepEqual(plain(restored.snapshot().programs[ids[2]]), ["right"]);
});

test("invalid saved values cannot become commands or inflate completion", () => {
    const disk = storage({ [key]: JSON.stringify({ version: 1, currentLevelId: 99, completed: [ids[0], ids[0], "unknown", null], programs: {
        [ids[0]]: ["right"], [ids[1]]: ["constructor"], [ids[2]]: Array(25).fill("up"), [ids[3]]: [null]
    } }) });
    const progress = create(levels, () => disk);
    assert.deepEqual(plain(progress.snapshot().completed), [ids[0]]);
    assert.deepEqual(plain(progress.snapshot().programs), { [ids[0]]: ["right"] });
    assert.equal(progress.snapshot().currentLevelId, ids[0]);
    assert.ok(progress.snapshot().notice);
});

test("broken JSON does not crash or overwrite data during loading", () => {
    const disk = storage({ [key]: "{broken" });
    const progress = create(levels, () => disk);
    assert.ok(progress.snapshot().notice);
    assert.equal(disk.getItem(key), "{broken");
    progress.setProgram(ids[0], ["up"]);
    assert.deepEqual(JSON.parse(disk.getItem(key)).programs[ids[0]], ["up"]);
});

test("unknown storage versions are never overwritten", () => {
    const saved = JSON.stringify({ version: 2, important: "future data" });
    const disk = storage({ [key]: saved });
    const progress = create(levels, () => disk);
    progress.complete(ids[0]);
    progress.setProgram(ids[1], ["up"]);
    assert.equal(disk.getItem(key), saved);
    assert.ok(progress.snapshot().notice);
    assert.equal(progress.snapshot().completed.length, 1);
});

test("denied storage still allows a complete in-memory session", () => {
    const progress = create(levels, () => { throw new Error("SecurityError"); });
    progress.setProgram(ids[0], ["right"]);
    progress.complete(ids[0]);
    assert.ok(progress.snapshot().notice);
    assert.equal(progress.snapshot().completed.length, 1);
    assert.deepEqual(plain(progress.snapshot().programs[ids[0]]), ["right"]);
});

test("write failure retains old data and retries on a later change", () => {
    const disk = storage();
    let full = false;
    const storageAccess = { getItem: disk.getItem, setItem(key, value) {
        if (full) throw new Error("QuotaExceededError");
        disk.setItem(key, value);
    } };
    const progress = create(levels, () => storageAccess);
    progress.setProgram(ids[0], ["up"]);
    full = true;
    progress.setProgram(ids[0], ["down"]);
    assert.ok(progress.snapshot().notice);
    assert.deepEqual(JSON.parse(disk.getItem(key)).programs[ids[0]], ["up"]);
    assert.deepEqual(plain(progress.snapshot().programs[ids[0]]), ["down"]);
    full = false;
    progress.setProgram(ids[0], ["down", "right"]);
    assert.equal(progress.snapshot().notice, "");
    assert.deepEqual(JSON.parse(disk.getItem(key)).programs[ids[0]], ["down", "right"]);
});

test("clearing one draft preserves completion and other drafts", () => {
    const disk = storage();
    const progress = create(levels, () => disk);
    progress.setProgram(ids[0], ["right"]);
    progress.setProgram(ids[1], ["down"]);
    progress.complete(ids[0]);
    progress.setProgram(ids[0], []);
    const restored = create(levels, () => disk).snapshot();
    assert.deepEqual(plain(restored.programs[ids[0]]), []);
    assert.deepEqual(plain(restored.programs[ids[1]]), ["down"]);
    assert.deepEqual(plain(restored.completed), [ids[0]]);
});

test("callers cannot mutate progress snapshots or save invalid programs", () => {
    const progress = create(levels, () => storage());
    const commands = ["up"];
    progress.setProgram(ids[0], commands);
    commands.push("left");
    const snapshot = progress.snapshot();
    snapshot.programs[ids[0]].push("down");
    snapshot.completed.push(ids[0]);
    progress.setProgram(ids[0], ["toString"]);
    progress.setProgram(ids[0], Array(25).fill("up"));
    progress.complete("unknown");
    assert.deepEqual(plain(progress.snapshot().programs[ids[0]]), ["up"]);
    assert.equal(progress.snapshot().completed.length, 0);
});

test("all shipped maps have unique ids, one start, one goal and a route within the command limit", () => {
    assert.equal(new Set(ids).size, levels.length);
    for (const { id, map } of levels) {
        assert.ok(map.every(row => row.length === map.length && /^[.#SG]+$/.test(row)), id);
        const tiles = map.join("");
        assert.equal([...tiles].filter(tile => tile === "S").length, 1, id);
        assert.equal([...tiles].filter(tile => tile === "G").length, 1, id);
        const y = map.findIndex(row => row.includes("S"));
        const queue = [[map[y].indexOf("S"), y, 0]];
        const visited = new Set();
        let distance = Infinity;
        for (let i = 0; i < queue.length; i++) {
            const [x, y, steps] = queue[i];
            if (visited.has(`${x},${y}`)) continue;
            visited.add(`${x},${y}`);
            if (map[y][x] === "G") { distance = steps; break; }
            for (const [dx, dy] of [[1, 0], [0, 1], [-1, 0], [0, -1]]) {
                const tile = map[y + dy]?.[x + dx];
                if (tile && tile !== "#") queue.push([x + dx, y + dy, steps + 1]);
            }
        }
        assert.ok(distance <= limit, id);
    }
});
