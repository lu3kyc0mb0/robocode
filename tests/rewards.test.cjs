const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const context = vm.createContext({});
for (const file of ["maze-content.js", "journey-content.js", "rewards.js"]) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, "../js", file), "utf8"), context);
}
const { create, chapters, achievements, mazes, journeys } = vm.runInContext("({create: createRewards, chapters: ROBO_CHAPTERS, achievements: ROBO_ACHIEVEMENTS, mazes: MAZE_LEVELS, journeys: JOURNEY_LEVELS})", context);
const plain = value => JSON.parse(JSON.stringify(value));
function disk(initial = {}) {
    const values = new Map(Object.entries(initial));
    return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}
test("new player earns 10 XP only once per task, including after reload", () => {
    const storage = disk(); const rewards = create(0, () => storage);
    const event = rewards.complete("maze:first-steps", 3);
    assert.equal(event.xp, 10); assert.deepEqual(plain(event.achievements), ["first-step"]);
    assert.equal(rewards.complete("maze:first-steps", 3).xp, 0);
    const loaded = create(0, () => storage);
    assert.equal(loaded.snapshot().xp, 10);
    assert.deepEqual(plain(loaded.complete("maze:first-steps", 3)), {xp: 0, achievements: [], chapters: []});
});
test("four original maps form one chapter, regardless of completion order", () => {
    const storage = disk(); const rewards = create(0, () => storage);
    assert.deepEqual(plain(chapters[0].tasks), plain(mazes.map(level => `maze:${level.id}`)));
    for (const id of ["long-journey", "first-steps", "choose-the-path"]) assert.equal(rewards.complete(`maze:${id}`, 3).chapters.length, 0);
    const event = rewards.complete("maze:around-the-wall", 6);
    assert.deepEqual(plain(event.chapters), ["maze"]);
    assert.ok(event.achievements.includes("first-chapter"));
    assert.ok(event.achievements.includes("programmer"));
    const savedBeforeAnimation = JSON.parse(storage.getItem("robocode-rewards"));
    assert.ok(savedBeforeAnimation.chapters.includes("maze"));
    assert.equal(savedBeforeAnimation.tasks.length, 4);
    assert.equal(create(0, () => storage).complete("maze:around-the-wall", 6).chapters.length, 0);
});
test("legacy completion migrates without rewriting profiles, drafts, ids or versions", () => {
    const storage = disk({"robocode-player": "profile bytes", "robocode-maze-progress": "maze bytes", "robocode-journey": "journey bytes"});
    const rewards = create(17, () => storage);
    rewards.sync(mazes.map(level => level.id), [journeys[0].id]);
    assert.equal(rewards.snapshot().xp, 67);
    assert.ok(rewards.snapshot().achievements.includes("first-chapter"));
    rewards.sync(mazes.map(level => level.id), [journeys[0].id]);
    assert.equal(rewards.snapshot().xp, 67);
    assert.equal(rewards.complete("maze:long-journey", 14).chapters.length, 0);
    assert.equal(storage.getItem("robocode-player"), "profile bytes");
    assert.equal(storage.getItem("robocode-maze-progress"), "maze bytes");
    assert.equal(storage.getItem("robocode-journey"), "journey bytes");
});
test("programmer differs from first step and requires a real long successful run", () => {
    const rewards = create(0, () => disk());
    rewards.complete("maze:first-steps", 3);
    assert.equal(rewards.snapshot().achievements.includes("programmer"), false);
    assert.equal(rewards.complete("maze:first-steps", 6).xp, 0);
    assert.ok(rewards.snapshot().achievements.includes("programmer"));
});
test("repair can unlock several achievements in one event but only one task reward", () => {
    const rewards = create(0, () => disk());
    const event = rewards.complete("repair:one-command", 6);
    assert.equal(event.xp, 10);
    assert.deepEqual(plain(event.achievements).sort(), ["programmer", "repair"]);
    assert.equal(rewards.complete("repair:one-command", 6).achievements.length, 0);
    assert.equal(rewards.snapshot().xp, 10);
});
test("village chapters and traveler require all existing main content", () => {
    const rewards = create(0, () => disk());
    for (const chapter of chapters) {
        for (const task of chapter.tasks) rewards.complete(task, 3);
        assert.ok(rewards.snapshot().chapters.includes(chapter.id));
    }
    assert.equal(rewards.snapshot().xp, 130);
    assert.ok(rewards.snapshot().achievements.includes("traveler"));
    assert.equal(new Set(rewards.snapshot().achievements).size, rewards.snapshot().achievements.length);
});
test("unknown tasks cannot award XP, chapters or skills", () => {
    const rewards = create(0, () => disk());
    rewards.complete("forged-task", 99); rewards.sync(["unknown"], ["unknown"]);
    assert.equal(rewards.snapshot().xp, 0);
    assert.equal(rewards.snapshot().longProgram, false);
    assert.equal(rewards.snapshot().achievements.length, 0);
});
test("corrupt or future reward data is never overwritten", () => {
    for (const raw of ["{broken", '{"version":99}']) {
        const storage = disk({"robocode-rewards": raw}); const rewards = create(0, () => storage);
        rewards.complete("maze:first-steps", 3);
        assert.equal(storage.getItem("robocode-rewards"), raw);
        assert.ok(rewards.snapshot().notice);
    }
});
test("quota failure remains playable and retries without duplicating rewards", () => {
    const storage = disk(); let denied = true;
    const rewards = create(0, () => ({getItem: storage.getItem, setItem: (key, value) => { if (denied) throw new Error("quota"); storage.setItem(key, value); }}));
    rewards.complete("maze:first-steps", 3); assert.ok(rewards.snapshot().notice);
    denied = false; assert.equal(rewards.complete("maze:first-steps", 3).xp, 0);
    assert.equal(create(0, () => storage).snapshot().xp, 10);
});
test("snapshot mutation cannot forge rewards and reset ledger overrides old XP baseline", () => {
    const rewards = create(0, () => disk()); const snapshot = rewards.snapshot(); snapshot.tasks.push("maze:first-steps");
    assert.equal(rewards.snapshot().xp, 0);
    const empty = {version: 1, tasks: [], chapters: [], achievements: [], longProgram: false, legacyXp: 0};
    assert.equal(create(99, () => disk({"robocode-rewards": JSON.stringify(empty)})).snapshot().xp, 0);
    assert.equal(new Set(achievements.map(item => item.id)).size, achievements.length);
});
