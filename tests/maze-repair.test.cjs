const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const context = vm.createContext({});
vm.runInContext(fs.readFileSync(path.join(__dirname, "../js/maze-content.js"), "utf8"), context);
const { levels, directions, task } = vm.runInContext("({ levels: MAZE_LEVELS, directions: MAZE_DIRECTIONS, task: MAZE_REPAIR_TASK })", context);
const level = levels.find(item => item.id === task.levelId);

function execute(program) {
    const row = level.map.findIndex(line => line.includes("S"));
    let x = level.map[row].indexOf("S");
    let y = row;
    for (let index = 0; index < program.length; index++) {
        const direction = directions[program[index]];
        x += direction.x;
        y += direction.y;
        const tile = level.map[y]?.[x];
        if (!tile || tile === "#") return { result: "collision", step: index + 1 };
        if (tile === "G") return { result: "goal", step: index + 1 };
    }
    return { result: "unfinished" };
}

test("repair task uses an existing level and fails at one visible command", () => {
    assert.ok(level);
    assert.ok(task.program.length <= 24);
    assert.deepEqual(execute(task.program), { result: "collision", step: 3 });
});

test("one replacement is sufficient and has only one winning choice", () => {
    const winning = [];
    for (let index = 0; index < task.program.length; index++) {
        for (const direction of Object.keys(directions)) {
            if (direction === task.program[index]) continue;
            const changed = task.program.slice();
            changed[index] = direction;
            if (execute(changed).result === "goal") winning.push({ step: index + 1, direction });
        }
    }
    assert.deepEqual(winning, [{ step: 3, direction: "right" }]);
});
