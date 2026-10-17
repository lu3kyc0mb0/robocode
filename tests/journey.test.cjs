const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
for (const file of ["journey-core.js", "journey-content.js", "journey-progress.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", file), "utf8"), context);
}
const { core, levels, create } = vm.runInContext("({core: JourneyCore, levels: JOURNEY_LEVELS, create: createJourneyProgress})", context);
const step = () => ({ type: "step" });
const jump = () => ({ type: "jump" });
const repeat = (count, body) => ({ type: "repeat", count, body });
const until = body => ({ type: "until", body });
const solutions = [Array.from({length: 3}, step), Array.from({length: 5}, step), [step(), jump(), step()], [repeat(6, [step()])], [repeat(9, [step()])], [repeat(3, [jump(), step()])], [until([step()])], [until([{type: "sense"}])], [until([{type: "sense"}])]];
const plain = value => JSON.parse(JSON.stringify(value));
const key = "robocode-journey";
function disk(initial = {}) {
    const data = new Map(Object.entries(initial));
    return { getItem: name => data.get(name) ?? null, setItem: (name, value) => data.set(name, value) };
}
for (let index = 0; index < levels.length; index++) {
    const level = levels[index];
    test(`${level.id}: legal program solves all worlds including unseen exam`, () => {
        assert.equal(core.valid(solutions[index], level.palette), true);
        assert.ok(core.size(solutions[index]) <= level.slots);
        for (const world of [...level.worlds, ...(level.exam ? [level.exam] : [])]) {
            assert.ok(world.goal > 0 && world.goal < world.length);
            assert.ok(world.rocks.every(rock => rock > 0 && rock < world.length && rock !== world.goal));
            assert.equal(new Set(world.rocks).size, world.rocks.length);
            const result = core.simulate(world, solutions[index]);
            assert.equal(result.result, "won");
            assert.equal(result.trace.at(-1).position, world.goal);
        }
    });
}
test("program must end on goal; touching it is not enough", () => {
    const world = { length: 8, goal: 3, rocks: [] };
    assert.equal(core.simulate(world, [step()]).result, "short");
    assert.equal(core.simulate(world, Array.from({length: 4}, step)).result, "overshot");
    assert.equal(core.simulate(world, Array.from({length: 8}, step)).result, "boundary");
});
test("collisions stop at previous position; jumps validate landing", () => {
    assert.equal(core.simulate({ length: 6, goal: 4, rocks: [1] }, [step()]).trace.at(-1).position, 0);
    assert.equal(core.simulate({ length: 6, goal: 4, rocks: [2] }, [jump()]).result, "rock");
});
test("until checks before acting; empty loops and runaway programs terminate", () => {
    assert.equal(core.simulate({length: 4, goal: 0, rocks: []}, [until([step()])]).trace.length, 1);
    assert.equal(core.simulate({length: 10, goal: 5, rocks: []}, [until([])]).result, "empty");
    const result = core.simulate({length: 300, goal: 250, rocks: []}, [until([step()])]);
    assert.equal(result.result, "limit");
    assert.equal(result.trace.length, 201);
});
test("fixed repetition fits a known world but fails another; rule generalizes", () => {
    const [first, second] = levels[6].worlds;
    assert.equal(core.simulate(first, [repeat(3, [step()])]).result, "won");
    assert.notEqual(core.simulate(second, [repeat(3, [step()])]).result, "won");
    for (const world of [first, second]) assert.equal(core.simulate(world, [until([step()])]).result, "won");
});
test("trace is deterministic, includes branch and card path, and does not mutate inputs", () => {
    const world = levels[7].worlds[1];
    const program = solutions[7];
    const before = JSON.stringify({world, program});
    const first = core.simulate(world, program);
    assert.deepEqual(first, core.simulate(world, program));
    assert.equal(first.trace[1].sensed, true);
    assert.equal(first.trace[1].path, "0.0");
    assert.equal(first.trace[1].action, "jump");
    assert.equal(JSON.stringify({world, program}), before);
});
test("unseen world exposes a fixed-count solution that passed all visible worlds", () => {
    const level = levels.at(-1);
    const memorized = [repeat(4, [{type: "sense"}])];
    assert.ok(core.size(memorized) <= level.slots);
    for (const world of level.worlds) assert.equal(core.simulate(world, memorized).result, "won");
    assert.notEqual(core.simulate(level.exam, memorized).result, "won");
    assert.equal(core.simulate(level.exam, [until([{type: "sense"}])]).result, "won");
});
test("invalid, unavailable and deeply nested cards are rejected", () => {
    for (const program of [[{type: "constructor"}], [repeat(99, [step()])], [until([until([step()])])], [{type: "step", body: [step()]}], null, [null]]) assert.equal(core.valid(program), false);
    assert.equal(core.valid([jump()], ["step"]), false);
});
test("progress reloads; old profile and maze bytes remain unchanged", () => {
    const storage = disk({"robocode-player": "original-profile", "robocode-maze-progress": "original-maze"});
    const progress = create(() => storage);
    progress.draft(levels[3].id, solutions[3]); progress.complete(levels[0].id); progress.complete(levels[0].id); progress.verify(levels[8].id); progress.failExam();
    const restored = create(() => storage).snapshot();
    assert.deepEqual(plain(restored.completed), [levels[0].id]);
    assert.deepEqual(plain(restored.drafts[levels[3].id]), solutions[3]);
    assert.equal(restored.examFailures, 1);
    assert.equal(storage.getItem("robocode-player"), "original-profile");
    assert.equal(storage.getItem("robocode-maze-progress"), "original-maze");
});
test("backup merges completion without replacing existing drafts or accepting bad input", () => {
    const progress = create(() => disk());
    progress.draft(levels[0].id, [step()]);
    const other = create(() => disk()); other.draft(levels[0].id, solutions[0]); other.complete(levels[1].id);
    assert.equal(progress.importCode(other.exportCode()), true);
    assert.deepEqual(plain(progress.snapshot().drafts[levels[0].id]), [step()]);
    assert.deepEqual(plain(progress.snapshot().completed), [levels[1].id]);
    const before = progress.exportCode();
    assert.equal(progress.importCode('{"version":99}'), false);
    assert.equal(progress.importCode('x'.repeat(30001)), false);
    assert.equal(progress.exportCode(), before);
});
test("future versions and corrupt storage are preserved; unavailable storage stays playable", () => {
    for (const raw of ['{"version":99}', '{broken']) {
        const storage = disk({[key]: raw});
        const progress = create(() => storage); progress.draft(levels[0].id, [step()]);
        assert.equal(storage.getItem(key), raw); assert.ok(progress.snapshot().notice);
    }
    const blocked = create(() => { throw new Error("blocked"); });
    blocked.complete(levels[0].id); assert.equal(blocked.snapshot().completed.length, 1);
});
test("quota failure retains in-memory progress and export; invalid draft does not save", () => {
    const progress = create(() => ({getItem: () => null, setItem: () => { throw new Error("quota"); }}));
    progress.complete(levels[0].id); assert.ok(progress.snapshot().notice);
    assert.equal(JSON.parse(progress.exportCode()).completed.length, 1);
    progress.draft(levels[0].id, [jump()]); assert.deepEqual(plain(progress.snapshot().drafts), {});
    const snapshot = progress.snapshot(); snapshot.completed.length = 0;
    assert.equal(progress.snapshot().completed.length, 1);
});
