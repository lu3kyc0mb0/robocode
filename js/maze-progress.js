function createMazeProgress(levels, getStorage = () => window.localStorage) {
    const key = "robocode-maze-progress";
    const ids = levels.map(level => level.id);
    let state = { version: 1, currentLevelId: ids[0], completed: [], programs: {} };
    let notice = "";
    let writable = true;

    function isRecord(value) {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    try {
        const saved = getStorage().getItem(key);
        if (saved !== null) {
            const value = JSON.parse(saved);
            if (!isRecord(value) || value.version !== 1) {
                writable = false;
                notice = "Сақталған ойын деректерінің пішімі сәйкес келмейді. Әзірге ойнай беруге болады, бірақ жаңа нәтиже сақталмайды.";
            } else {
                const programs = {};
                let repaired = !ids.includes(value.currentLevelId) || !Array.isArray(value.completed) || !isRecord(value.programs);
                const completed = Array.isArray(value.completed) ? value.completed.filter(id => ids.includes(id)) : [];
                if (Array.isArray(value.completed) && completed.length !== value.completed.length) repaired = true;
                if (isRecord(value.programs)) {
                    for (const id of ids) {
                        if (!Object.hasOwn(value.programs, id)) continue;
                        const program = value.programs[id];
                        if (Array.isArray(program) && program.length <= MAZE_COMMAND_LIMIT &&
                            program.every(command => typeof command === "string" && Object.hasOwn(MAZE_DIRECTIONS, command))) {
                            programs[id] = program.slice();
                        } else {
                            repaired = true;
                        }
                    }
                }
                state = {
                    version: 1,
                    currentLevelId: ids.includes(value.currentLevelId) ? value.currentLevelId : ids[0],
                    completed: [...new Set(completed)],
                    programs
                };
                if (repaired) notice = "Кейбір ойын деректері ашылмады. Дұрыс сақталған деңгейлер мен командалар қалпына келтірілді.";
            }
        }
    } catch {
        notice = "Сақталған ойынды ашу мүмкін болмады. Ойнай беруге болады. Бетті жаппай тұрып, сақтау туралы хабарға назар аудар.";
    }

    function save() {
        if (!writable) return;
        try {
            getStorage().setItem(key, JSON.stringify(state));
            notice = "";
        } catch {
            notice = "Ойын барысын сақтау мүмкін болмады. Әзірге ойнай беруге болады, бірақ бетті жапқанда соңғы өзгерістер жоғалуы мүмкін.";
        }
    }

    return {
        snapshot() {
            return {
                currentLevelId: state.currentLevelId,
                completed: state.completed.slice(),
                programs: Object.fromEntries(Object.entries(state.programs).map(([id, program]) => [id, program.slice()])),
                notice
            };
        },
        resumeLevelId() {
            const index = ids.indexOf(state.currentLevelId);
            const ordered = [...ids.slice(index), ...ids.slice(0, index)];
            return ordered.find(id => !state.completed.includes(id)) || state.currentLevelId;
        },
        select(id) {
            if (!ids.includes(id) || state.currentLevelId === id) return;
            state.currentLevelId = id;
            save();
        },
        setProgram(id, program) {
            if (!ids.includes(id) || !Array.isArray(program) || program.length > MAZE_COMMAND_LIMIT ||
                !program.every(command => typeof command === "string" && Object.hasOwn(MAZE_DIRECTIONS, command))) return;
            state.programs[id] = program.slice();
            state.currentLevelId = id;
            save();
        },
        complete(id) {
            if (!ids.includes(id)) return;
            if (!state.completed.includes(id)) state.completed.push(id);
            state.currentLevelId = id;
            save();
        }
    };
}
