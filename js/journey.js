function createJourney(onExit, onComplete = () => {}, sound = () => {}) {
    const storage = createJourneyProgress();
    const screen = document.getElementById("journey-screen");
    const ui = {};
    for (const name of ["back", "total", "map", "villages", "finale", "finish", "play", "chapter", "level-title", "task", "worlds", "feedback", "timeline", "frame", "frame-label", "slots", "target", "palette", "root", "program", "undo", "clear", "run", "stop", "step", "reset", "speed", "hint", "exam", "next", "notice"]) {
        ui[name] = document.getElementById(`journey-${name}`);
    }
    const labels = { step: "→ Қадам", jump: "↗ Секір", repeat: "↻ Қайтала", until: "💧 Құдыққа жеткенше", sense: "👁 Егер тас болса" };
    const results = { won: "✓ Құдыққа жетті", short: "Құдыққа жетпей тоқтады", overshot: "Құдықтан өтіп кетті", rock: "Тасқа тірелді", boundary: "Жолдың шетіне жетті", limit: "Қайталау тым ұзақ", empty: "Қайталаудың іші бос", invalid: "Бағдарламаны тексер" };
    const clone = value => JSON.parse(JSON.stringify(value));
    let index = 0;
    let program = [];
    let target = null;
    let history = [];
    let traces = [];
    let worlds = [];
    let frame = 0;
    let timer = null;
    let phase = "ready";
    let examMode = false;
    let verified = false;
    let robot = "🤖";
    let inLevel = false;

    function element(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined) node.textContent = text;
        return node;
    }
    function button(text, action, className = "") {
        const node = element("button", className, text);
        node.type = "button";
        node.addEventListener("click", action);
        return node;
    }
    function tell(text, kind = "ready") {
        ui.feedback.textContent = text;
        ui.feedback.dataset.kind = kind;
    }
    function cancel() { clearTimeout(timer); timer = null; }
    function notice() { ui.notice.textContent = storage.snapshot().notice; }
    function unlocked(levelIndex) {
        const done = storage.snapshot().completed;
        return levelIndex === 0 || done.includes(JOURNEY_LEVELS[levelIndex - 1].id) || done.includes(JOURNEY_LEVELS[levelIndex].id);
    }
    function showMap() {
        cancel(); phase = "ready"; inLevel = false;
        screen.classList.remove("is-playing");
        ui.map.hidden = false; ui.play.hidden = true;
        ui.back.textContent = "← Мәзір";
        const saved = storage.snapshot();
        ui.total.textContent = `${saved.completed.length} / ${JOURNEY_LEVELS.length} тапсырма`;
        ui.finale.hidden = saved.completed.length !== JOURNEY_LEVELS.length;
        ui.villages.replaceChildren();
        JOURNEY_CHAPTERS.forEach((chapter, chapterIndex) => {
            const levels = JOURNEY_LEVELS.filter(level => level.chapter === chapterIndex);
            const complete = levels.every(level => saved.completed.includes(level.id));
            const section = element("section", `journey-village${complete ? " is-restored" : ""}`);
            section.append(element("div", "village-icon", complete ? "🏡" : chapter.icon));
            section.append(element("span", "eyebrow", `${chapterIndex + 1}-АУЫЛ · ${chapter.skill}`));
            section.append(element("h2", "", chapter.name));
            section.append(element("p", "", complete ? "✓ Ауылға жол ашылды!" : chapter.story));
            const list = element("div", "journey-level-list");
            levels.forEach(level => {
                const levelIndex = JOURNEY_LEVELS.indexOf(level);
                const done = saved.completed.includes(level.id);
                const open = unlocked(levelIndex);
                const node = button(`${done ? "✓" : open ? "→" : "🔒"} ${level.name}`, () => load(levelIndex), "journey-level-button");
                node.disabled = !open;
                if (!open) node.title = "Алдыңғы тапсырманы аяқта";
                list.append(node);
            });
            section.append(list); ui.villages.append(section);
        });
        notice();
        document.getElementById("journey-title").focus({ preventScroll: true });
        window.scrollTo(0, 0);
    }
    function renderWorlds() {
        ui.worlds.replaceChildren();
        worlds.forEach((world, worldIndex) => {
            const trace = traces[worldIndex];
            const current = trace ? trace.trace[Math.min(frame, trace.trace.length - 1)] : { position: 0 };
            const finished = trace && frame >= trace.trace.length - 1 && phase !== "ready";
            const worldBox = element("article", "journey-world");
            const title = worldIndex === JOURNEY_LEVELS[index].worlds.length ? "🔭 Тосын ауыл" : `${worldIndex + 1}-жол`;
            worldBox.append(element("h3", "", title));
            const road = element("div", "journey-road");
            road.setAttribute("role", "img");
            road.setAttribute("aria-label", `${title}. Робот ${current.position + 1}-торкөзде, құдық ${world.goal + 1}-торкөзде. Тастар: ${world.rocks.map(p => p + 1).join(", ") || "жоқ"}.`);
            road.style.setProperty("--cells", world.length);
            for (let cell = 0; cell < world.length; cell++) {
                const tile = element("span", "journey-tile", cell === world.goal ? "💧" : world.rocks.includes(cell) ? "🪨" : "");
                tile.setAttribute("aria-hidden", "true");
                if (cell === world.goal) tile.classList.add("is-goal");
                if (cell === current.position) {
                    tile.classList.add("has-robot");
                    const character = element("b", "journey-robot");
                    character.append(createRobi(finished && trace.result === "won" ? "happy" : current.failure ? "thinking" : "normal"));
                    tile.append(character);
                }
                road.append(tile);
            }
            worldBox.append(road);
            const status = finished ? results[trace.result] : `Робот: ${current.position + 1}-торкөз`;
            worldBox.append(element("p", `world-status${finished && trace.result === "won" ? " is-won" : ""}`, status));
            if (current.sensed !== null && current.sensed !== undefined) {
                worldBox.append(element("p", "journey-small", current.sensed ? "👁 Алда тас бар → секірді" : "👁 Алда тас жоқ → қадам жасады"));
            }
            ui.worlds.append(worldBox);
        });
    }
    function renderProgram() {
        const focused = document.activeElement?.dataset.control;
        ui.program.replaceChildren();
        function build(cards, parent, prefix = "") {
            cards.forEach((card, cardIndex) => {
                const path = `${prefix}${cardIndex}`;
                const li = element("li", `journey-card${card.body ? " is-group" : ""}`);
                li.dataset.path = path;
                const head = element("div", "journey-card-head");
                head.append(element("span", "", labels[card.type]));
                if (card.type === "repeat") {
                    const select = element("select");
                    select.setAttribute("aria-label", "Қайталау саны");
                    select.dataset.control = `count-${path}`;
                    for (let count = 2; count <= 12; count++) {
                        const option = element("option", "", `${count} рет`); option.value = count; select.append(option);
                    }
                    select.value = card.count; select.disabled = phase === "running";
                    select.addEventListener("change", () => edit(() => { card.count = Number(select.value); }));
                    head.append(select);
                }
                const remove = button("×", () => edit(() => { cards.splice(cardIndex, 1); target = null; }), "journey-remove");
                remove.setAttribute("aria-label", `${labels[card.type]}: өшіру`);
                remove.disabled = phase === "running"; head.append(remove); li.append(head);
                if (card.type === "sense") li.append(element("p", "journey-small", "Тас болса — секір, әйтпесе — қадам."));
                if (card.body) {
                    const choose = button(target === cardIndex ? "✓ Әрекетті палитрадан таңда" : "＋ Ішіне қосу", () => { target = cardIndex; renderEditor(); }, "journey-group-target");
                    choose.disabled = phase === "running";
                    choose.setAttribute("aria-pressed", String(target === cardIndex));
                    li.append(choose);
                    const body = element("ol", "journey-body");
                    if (!card.body.length) body.append(element("li", "journey-placeholder", "Қайталанатын әрекетті қос"));
                    build(card.body, body, `${path}.`); li.append(body);
                }
                parent.append(li);
            });
        }
        build(program, ui.program);
        if (!program.length) ui.program.append(element("li", "journey-placeholder", "Карточканы басып, роботқа алғашқы әрекетті үйрет."));
        if (focused) ui.program.querySelector(`[data-control="${focused}"]`)?.focus({ preventScroll: true });
        highlight();
    }
    function highlight() {
        const activePaths = traces.map(trace => trace.trace[Math.min(frame, trace.trace.length - 1)]?.path);
        ui.program.querySelectorAll("[data-path]").forEach(card => {
            const active = frame > 0 && activePaths.includes(card.dataset.path);
            card.classList.toggle("is-active", active);
            if (active) card.setAttribute("aria-current", "step"); else card.removeAttribute("aria-current");
        });
    }
    function renderEditor() {
        const level = JOURNEY_LEVELS[index];
        ui.palette.replaceChildren();
        level.palette.forEach(type => {
            const node = button(labels[type], () => add(type));
            node.dataset.card = type;
            node.disabled = phase === "running" || target !== null && ["repeat", "until"].includes(type);
            ui.palette.append(node);
        });
        ui.slots.textContent = `${JourneyCore.size(program)} / ${level.slots} орын`;
        ui.target.textContent = target === null ? "Қадам оңға жүреді. Карточкаларды ретімен қос." : "Қазір әрекет қайталаудың ішіне қосылады. Дайын болсаң, «Дайын» батырмасын бас.";
        ui.root.hidden = target === null;
        ui.root.disabled = phase === "running";
        renderProgram(); controls();
    }
    function controls() {
        const running = phase === "running";
        ui.total.textContent = `${storage.snapshot().completed.length} / ${JOURNEY_LEVELS.length} тапсырма`;
        ui.run.disabled = running;
        ui.run.textContent = phase === "paused" ? "▶ Жалғастыру" : "▶ Іске қос";
        ui.stop.disabled = !running;
        ui.step.disabled = running;
        ui.undo.disabled = running || !history.length;
        ui.clear.disabled = running || !program.length;
        ui.speed.disabled = running;
        ui.exam.hidden = !verified || !JOURNEY_LEVELS[index].exam || examMode;
        ui.next.hidden = phase !== "won" || Boolean(JOURNEY_LEVELS[index].exam && !examMode);
        ui.next.textContent = index === JOURNEY_LEVELS.length - 1 ? "Саяхаттың қорытындысы →" : "Келесі тапсырма →";
        ui.timeline.hidden = traces.length === 0;
        ui.frame.disabled = running;
        ui.frame.max = String(Math.max(0, ...traces.map(trace => trace.trace.length - 1)));
        ui.frame.value = frame;
        ui["frame-label"].textContent = `· ${frame} / ${ui.frame.max}`;
        notice();
    }
    function reset() {
        cancel(); phase = "ready"; traces = []; frame = 0; verified = false;
        worlds = JOURNEY_LEVELS[index].worlds.concat(examMode ? [JOURNEY_LEVELS[index].exam] : []);
        renderWorlds(); renderEditor();
        tell("Бағдарламаны құрастыр да, іске қос. Робот бағдарлама біткенде құдықта тоқтасын.");
    }
    function edit(action) {
        if (phase === "running") return;
        history.push(clone(program)); if (history.length > 40) history.shift();
        action(); storage.draft(JOURNEY_LEVELS[index].id, program); reset();
    }
    function add(type) {
        if (phase === "running") return;
        const level = JOURNEY_LEVELS[index];
        if (JourneyCore.size(program) >= level.slots) {
            tell("Орын толды. Артық карточканы алып таста немесе қайталауды қолдан.", "warning"); return;
        }
        edit(() => {
            const card = ["repeat", "until"].includes(type) ? { type, ...(type === "repeat" ? { count: 2 } : {}), body: [] } : { type };
            if (target !== null) program[target].body.push(card);
            else { program.push(card); if (card.body) target = program.length - 1; }
        });
        sound("add");
        const last = ui.palette.querySelector(`[data-card="${type}"]`);
        if (last && !last.disabled) last.focus({ preventScroll: true });
    }
    function load(levelIndex) {
        if (!unlocked(levelIndex)) return;
        index = levelIndex; inLevel = true; target = null; history = [];
        screen.classList.add("is-playing");
        const level = JOURNEY_LEVELS[index];
        const saved = storage.snapshot();
        program = clone(saved.drafts[level.id] || []);
        examMode = Boolean(level.exam && saved.examFailures >= 2);
        ui.map.hidden = true; ui.play.hidden = false; ui.back.textContent = "← Ауылдар";
        ui.chapter.textContent = `${JOURNEY_CHAPTERS[level.chapter].icon} ${JOURNEY_CHAPTERS[level.chapter].name} · ${index + 1} / ${JOURNEY_LEVELS.length}`;
        ui["level-title"].textContent = level.name;
        ui.task.textContent = level.text;
        ui.hint.textContent = level.hint;
        screen.querySelector(".journey-help").open = false;
        reset(); ui["level-title"].focus({ preventScroll: true }); window.scrollTo(0, 0);
    }
    function prepare() {
        if (!program.length) { tell("Алдымен роботқа бір әрекет қос.", "warning"); return false; }
        if (program.some(card => card.body && !card.body.length)) { tell("Қайталаудың іші бос. Оның ішіне әрекет қос.", "warning"); return false; }
        cancel(); frame = 0; verified = false;
        traces = worlds.map(world => JourneyCore.simulate(world, program));
        return true;
    }
    function finish() {
        cancel();
        const success = traces.every(trace => trace.result === "won");
        phase = success ? "won" : "failed";
        const level = JOURNEY_LEVELS[index];
        if (success) {
            storage.verify(level.id); verified = true;
            if (!level.exam || examMode) storage.complete(level.id);
            tell(level.exam && !examMode ? "Екі жолда да сәтті! Роби жаңа ауылға баруға дайын. Осы бағдарламаны өзгертпей тексеріп көр." : worlds.length > 1 ? "Бір ереже барлық жолда жұмыс істеді! Сен Робиге жаңа жолды да түсінуді үйреттің." : "Құдыққа жеттік! Роби сенің бағдарламаңды үйренді.", "won");
        } else {
            if (examMode) storage.failExam();
            tell("Жол бізге не көрсетті? Қадамдар жолағын қарап, бағдарламаны түзетіп көр. Көмек те бар.", "warning");
        }
        renderWorlds(); renderEditor();
        if (document.activeElement === ui.stop) (ui.next.hidden ? ui.run : ui.next).focus({ preventScroll: true });
        if (success && (!level.exam || examMode)) onComplete(`journey:${level.id}`, Math.max(...traces.map(trace => trace.trace.length - 1)));
        else sound(success ? "win" : "collision");
    }
    function advance() {
        frame = Math.min(frame + 1, Math.max(...traces.map(trace => trace.trace.length - 1)));
        renderWorlds(); highlight(); controls();
        if (frame >= Number(ui.frame.max)) { finish(); return false; }
        return true;
    }
    function run() {
        if (!inLevel || !screen.classList.contains("active") || phase === "running") return;
        if (phase !== "paused" && !prepare()) return;
        phase = "running"; renderEditor(); tell("Роби бағдарламаңды орындап жатыр…", "running");
        ui.stop.focus({ preventScroll: true });
        function tick() {
            if (phase !== "running" || !inLevel || !screen.classList.contains("active")) return;
            if (advance()) timer = setTimeout(tick, Number(ui.speed.value));
        }
        timer = setTimeout(tick, Number(ui.speed.value));
    }
    function pause() {
        if (phase !== "running") return;
        cancel(); phase = "paused"; renderEditor(); tell("Роби тоқтады. Бір қадаммен жалғастыр немесе бағдарламаны түзет.");
        if (document.activeElement === ui.stop) ui.run.focus({ preventScroll: true });
    }
    ui.back.addEventListener("click", () => { if (inLevel) showMap(); else onExit(); });
    ui.finish.addEventListener("click", onExit);
    ui.root.addEventListener("click", () => { target = null; renderEditor(); ui.palette.querySelector("button")?.focus(); });
    ui.undo.addEventListener("click", () => {
        if (phase === "running" || !history.length) return;
        program = history.pop(); target = null; storage.draft(JOURNEY_LEVELS[index].id, program); reset();
    });
    ui.clear.addEventListener("click", () => edit(() => { program = []; target = null; }));
    ui.run.addEventListener("click", run);
    ui.stop.addEventListener("click", pause);
    ui.reset.addEventListener("click", reset);
    ui.step.addEventListener("click", () => {
        if (phase === "running") return;
        if (phase !== "paused" && !prepare()) return;
        phase = "paused"; advance(); renderEditor();
        if (phase === "paused") tell("Бір қадам орындалды. Келесі әрекетті болжап көр.");
    });
    ui.frame.addEventListener("input", () => {
        if (phase === "running") return;
        frame = Number(ui.frame.value);
        if (phase === "paused") phase = "review";
        renderWorlds(); highlight(); controls();
    });
    ui.exam.addEventListener("click", () => { if (!verified) return; examMode = true; reset(); run(); });
    ui.next.addEventListener("click", () => {
        if (phase !== "won" || !storage.snapshot().completed.includes(JOURNEY_LEVELS[index].id)) return;
        if (index === JOURNEY_LEVELS.length - 1) showMap(); else load(index + 1);
    });
    document.addEventListener("keydown", event => {
        if (!screen.classList.contains("active") || !inLevel || document.querySelector("dialog[open]") || event.target.closest("input, textarea, select")) return;
        if (event.key === "Escape") { event.preventDefault(); pause(); }
        if (event.ctrlKey && event.key === "Enter" && !event.repeat) { event.preventDefault(); run(); }
    });
    document.addEventListener("visibilitychange", () => { if (document.hidden) pause(); });
    window.addEventListener("pagehide", pause);
    return {
        open(icon) { robot = icon; showMap(); },
        close() { cancel(); phase = "ready"; inLevel = false; screen.classList.remove("is-playing"); },
        stop: pause,
        snapshot: storage.snapshot,
        exportCode: storage.exportCode,
        importCode: storage.importCode
    };
}
