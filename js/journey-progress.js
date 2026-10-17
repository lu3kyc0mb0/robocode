function createJourneyProgress(getStorage = () => window.localStorage) {
    const key = "robocode-journey";
    const ids = JOURNEY_LEVELS.map(level => level.id);
    let state = { version: 1, completed: [], verified: [], drafts: {}, examFailures: 0 };
    let notice = "";
    let writable = true;
    const copy = value => JSON.parse(JSON.stringify(value));
    function validate(value) {
        if (!value || value.version !== 1 || !Array.isArray(value.completed) || !Array.isArray(value.verified)
            || !value.drafts || typeof value.drafts !== "object" || Array.isArray(value.drafts)) throw new Error("invalid");
        const drafts = {};
        for (const level of JOURNEY_LEVELS) {
            const program = value.drafts[level.id];
            if (program !== undefined) {
                if (!JourneyCore.valid(program, level.palette) || JourneyCore.size(program) > level.slots) throw new Error("program");
                drafts[level.id] = copy(program);
            }
        }
        return { version: 1, completed: [...new Set(value.completed.filter(id => ids.includes(id)))], verified: [...new Set(value.verified.filter(id => ids.includes(id)))], drafts,
            examFailures: Number.isInteger(value.examFailures) ? Math.max(0, Math.min(2, value.examFailures)) : 0 };
    }
    try {
        const raw = getStorage().getItem(key);
        if (raw !== null) state = validate(JSON.parse(raw));
    } catch {
        writable = false;
        notice = "Саяхаттың сақталған деректері ашылмады. Олар өзгертілмейді. Осы жолы сақтау мүмкін емес.";
    }
    function save() {
        if (!writable) return;
        try { getStorage().setItem(key, JSON.stringify(state)); notice = ""; }
        catch { notice = "Сақтау мүмкін болмады. Бетті жаппай тұрып, сақтау кодын көшіріп ал."; }
    }
    return {
        snapshot: () => ({ ...copy(state), notice }),
        draft(id, program) {
            const level = JOURNEY_LEVELS.find(item => item.id === id);
            if (!level || !JourneyCore.valid(program, level.palette) || JourneyCore.size(program) > level.slots) return;
            state.drafts[id] = copy(program); save();
        },
        verify(id) { if (ids.includes(id) && !state.verified.includes(id)) { state.verified.push(id); save(); } },
        complete(id) { if (ids.includes(id) && !state.completed.includes(id)) { state.completed.push(id); save(); } },
        failExam() { state.examFailures = Math.min(2, state.examFailures + 1); save(); },
        exportCode: () => JSON.stringify(state),
        importCode(raw) {
            if (!writable || typeof raw !== "string" || raw.length > 30000) return false;
            try {
                const incoming = validate(JSON.parse(raw));
                state.completed = [...new Set([...state.completed, ...incoming.completed])];
                state.verified = [...new Set([...state.verified, ...incoming.verified])];
                state.drafts = { ...incoming.drafts, ...state.drafts };
                state.examFailures = Math.max(state.examFailures, incoming.examFailures);
                save(); return true;
            } catch { return false; }
        }
    };
}
