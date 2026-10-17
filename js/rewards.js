const ROBO_CHAPTERS = [
    { id: "maze", title: "1-тарау · Лабиринт", tasks: MAZE_LEVELS.map(level => `maze:${level.id}`) },
    ...JOURNEY_CHAPTERS.map((chapter, index) => ({ id: `village-${index}`, title: `${index + 2}-тарау · ${chapter.name}`, tasks: JOURNEY_LEVELS.filter(level => level.chapter === index).map(level => `journey:${level.id}`) }))
];
const ROBO_ACHIEVEMENTS = [
    { id: "first-step", title: "Алғашқы қадам", description: "Кез келген негізгі деңгейді алғаш рет аяқта.", icon: "★", condition: state => state.tasks.some(id => id.startsWith("maze:") || id.startsWith("journey:")) },
    { id: "first-chapter", title: "Бірінші тарау", description: "Лабиринттің төрт деңгейін аяқта.", icon: "⚑", condition: state => state.chapters.includes("maze") },
    { id: "programmer", title: "Бағдарламашы", description: "Кемінде 6 қадам орындалатын бағдарламамен мақсатқа жет.", icon: "⌘", condition: state => state.longProgram },
    { id: "repair", title: "Қатені тап!", description: "Қате команданы түзету тапсырмасын аяқта.", icon: "✓", condition: state => state.tasks.includes("repair:one-command") },
    { id: "traveler", title: "Саяхатшы", description: "4 лабиринт пен саяхаттың 9 тапсырмасын аяқта.", icon: "◎", condition: state => ROBO_CHAPTERS.every(chapter => state.chapters.includes(chapter.id)) },
    ...JOURNEY_CHAPTERS.map((chapter, index) => ({ id: `village-${index}`, title: chapter.name, description: `${chapter.name}: үш тапсырманы аяқта.`, icon: ["❧", "◈", "✦"][index], condition: state => state.chapters.includes(`village-${index}`) }))
];

function createRewards(legacyXp = 0, getStorage = () => window.localStorage) {
    const key = "robocode-rewards";
    const tasks = [...ROBO_CHAPTERS.flatMap(chapter => chapter.tasks), "repair:one-command"];
    const empty = () => ({ version: 1, tasks: [], achievements: [], chapters: [], longProgram: false, legacyXp: Number.isFinite(legacyXp) ? Math.max(0, legacyXp) : 0 });
    let state = empty();
    let writable = true;
    let notice = "";
    try {
        const raw = getStorage().getItem(key);
        if (raw !== null) {
            const value = JSON.parse(raw);
            if (!value || value.version !== 1 || !Array.isArray(value.tasks) || !Array.isArray(value.achievements) || !Array.isArray(value.chapters)) throw new Error("format");
            state.tasks = [...new Set(value.tasks.filter(id => tasks.includes(id)))];
            state.longProgram = value.longProgram === true;
            state.legacyXp = Number.isFinite(value.legacyXp) ? Math.max(0, value.legacyXp) : state.legacyXp;
        }
    } catch {
        writable = false;
        notice = "Жетістіктерді сақтау қолжетімсіз. Бұрынғы деректер өзгертілмейді.";
    }
    function derive() {
        state.chapters = ROBO_CHAPTERS.filter(chapter => chapter.tasks.every(id => state.tasks.includes(id))).map(chapter => chapter.id);
        state.achievements = ROBO_ACHIEVEMENTS.filter(achievement => achievement.condition(state)).map(achievement => achievement.id);
    }
    function save() {
        if (!writable) return;
        try { getStorage().setItem(key, JSON.stringify(state)); notice = ""; }
        catch { notice = "XP мен жетістіктер осы сеанста бар, бірақ браузерге сақталмады."; }
    }
    derive();
    return {
        snapshot() { return { ...JSON.parse(JSON.stringify(state)), xp: state.legacyXp + state.tasks.length * 10, notice }; },
        sync(mazeCompleted, journeyCompleted) {
            const before = JSON.stringify(state);
            state.tasks = [...new Set([...state.tasks, ...mazeCompleted.map(id => `maze:${id}`), ...journeyCompleted.map(id => `journey:${id}`)].filter(id => tasks.includes(id)))];
            derive();
            if (JSON.stringify(state) !== before) save();
        },
        complete(taskId, steps) {
            if (!tasks.includes(taskId)) return { xp: 0, achievements: [], chapters: [] };
            const oldAchievements = state.achievements.slice();
            const oldChapters = state.chapters.slice();
            const fresh = !state.tasks.includes(taskId);
            if (fresh) state.tasks.push(taskId);
            if (Number.isInteger(steps) && steps >= 6) state.longProgram = true;
            derive(); save();
            return { xp: fresh ? 10 : 0, achievements: state.achievements.filter(id => !oldAchievements.includes(id)), chapters: state.chapters.filter(id => !oldChapters.includes(id)) };
        }
    };
}
