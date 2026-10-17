const JourneyCore = (() => {
    const types = ["step", "jump", "repeat", "until", "sense"];
    function valid(program, allowed = types, depth = 0) {
        return Array.isArray(program) && program.length <= 24 && program.every(card => {
            if (!card || typeof card !== "object" || !allowed.includes(card.type)) return false;
            if (["repeat", "until"].includes(card.type)) {
                return depth === 0 && (card.type !== "repeat" || Number.isInteger(card.count) && card.count >= 2 && card.count <= 12)
                    && valid(card.body, allowed.filter(type => !["repeat", "until"].includes(type)), depth + 1);
            }
            return !Object.hasOwn(card, "body");
        }) && size(program) <= 24;
    }
    function size(program) {
        return program.reduce((sum, card) => sum + 1 + (Array.isArray(card.body) ? size(card.body) : 0), 0);
    }
    function simulate(world, program) {
        let position = 0;
        let failure = "";
        let steps = 0;
        const trace = [{ position, path: "", action: "start" }];
        if (!valid(program)) return { trace, result: "invalid" };
        function execute(cards, prefix = "") {
            for (let index = 0; index < cards.length && !failure; index++) {
                const card = cards[index];
                const path = `${prefix}${index}`;
                if (card.body) {
                    if (!card.body.length) { failure = "empty"; return; }
                    let count = 0;
                    while (!failure && (card.type === "repeat" ? count < card.count : position !== world.goal)) {
                        execute(card.body, `${path}.`);
                        count++;
                    }
                    continue;
                }
                if (steps >= 200) { failure = "limit"; return; }
                steps++;
                const blocked = world.rocks.includes(position + 1);
                const action = card.type === "sense" ? (blocked ? "jump" : "step") : card.type;
                const next = position + (action === "jump" ? 2 : 1);
                failure = next >= world.length ? "boundary" : world.rocks.includes(next) ? "rock" : "";
                if (!failure) position = next;
                trace.push({ position, path, action, failure, sensed: card.type === "sense" ? blocked : null });
            }
        }
        execute(program);
        return { trace, result: failure || (position === world.goal ? "won" : position > world.goal ? "overshot" : "short") };
    }
    return { valid, size, simulate };
})();
