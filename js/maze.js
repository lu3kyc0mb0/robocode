function createMaze(onExit, progress) {
    const levels = MAZE_LEVELS;
    const directions = MAZE_DIRECTIONS;
    const screen = document.getElementById("maze-screen");
    const ui = {};
    for (const name of ["board", "level", "level-title", "hint", "position", "progress", "program", "count", "empty", "feedback", "notice", "run", "stop", "reset", "clear", "undo", "next", "menu", "repair-instructions", "repair-help", "repair-hint", "direction-help"]) {
        ui[name] = document.getElementById(`maze-${name}`);
    }
    const palette = Array.from(screen.querySelectorAll("[data-direction]"));
    const help = screen.querySelector(".maze-help");
    const limit = MAZE_COMMAND_LIMIT;
    let levelIndex = 0;
    let commands = [];
    let position;
    let start;
    let token;
    let cells = [];
    let visited = new Set();
    let icon = "🤖";
    let phase = "ready";
    let activeCommand = -1;
    let timer = null;
    let generation = 0;
    let mode = "free";
    let selectedCommand = -1;
    let repairHintRevealed = false;

    function cancel() {
        generation += 1;
        clearTimeout(timer);
        timer = null;
    }

    function message(text, kind = "ready") {
        ui.feedback.textContent = text;
        ui.feedback.dataset.kind = kind;
    }

    function drawBoard() {
        const map = levels[levelIndex].map;
        ui.board.replaceChildren();
        ui.board.style.setProperty("--size", map.length);
        cells = [];
        map.forEach(function (row, y) {
            const rowElement = document.createElement("div");
            rowElement.className = "maze-row";
            rowElement.setAttribute("role", "row");
            Array.from(row).forEach(function (tile, x) {
                const cell = document.createElement("div");
                cell.className = "maze-cell";
                cell.dataset.tile = tile;
                cell.setAttribute("role", "cell");
                cell.textContent = tile === "S" ? "Б" : tile === "G" ? "★" : "";
                if (tile === "S") start = { x, y };
                cells.push({ element: cell, x, y, tile });
                rowElement.append(cell);
            });
            ui.board.append(rowElement);
        });
        token = document.createElement("div");
        token.className = "maze-token";
        token.setAttribute("aria-hidden", "true");
        const face = document.createElement("span");
        face.textContent = icon;
        token.append(face);
        ui.board.append(token);
    }

    function renderBoard() {
        token.style.setProperty("--x", position.x);
        token.style.setProperty("--y", position.y);
        ui.board.dataset.phase = phase;
        cells.forEach(function ({ element, x, y, tile }) {
            const here = x === position.x && y === position.y;
            const label = tile === "#" ? "қабырға" : tile === "G" ? "мақсат" : tile === "S" ? "бастау" : "бос жол";
            element.classList.toggle("maze-visited", visited.has(`${x},${y}`));
            element.setAttribute("aria-label", `${y + 1}-қатар, ${x + 1}-баған: ${label}${here ? ", робот осында" : ""}`);
        });
        ui.position.textContent = `Робот: ${position.y + 1}-қатар, ${position.x + 1}-баған.`;
    }

    function renderProgram() {
        ui.program.replaceChildren();
        commands.forEach(function (command, index) {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "maze-command";
            button.textContent = mode === "repair" ? `${index + 1} ${directions[command].arrow}` : `${index + 1} ${directions[command].arrow} ×`;
            button.setAttribute("aria-label", mode === "repair" ? `${index + 1}. ${directions[command].label}. Команданы таңдау` : `${index + 1}. ${directions[command].label}. Команданы өшіру`);
            const showSteps = mode === "free" || repairHintRevealed;
            const current = showSteps && index === activeCommand && ["running", "collision", "stopped"].includes(phase);
            button.classList.toggle("is-current", current);
            button.classList.toggle("is-done", showSteps && index < activeCommand);
            button.classList.toggle("is-error", current && phase === "collision");
            if (mode === "repair" && current && phase === "collision") {
                button.setAttribute("aria-label", `${index + 1}. ${directions[command].label}. Робот осы командада тоқтады. Команданы таңдау`);
            }
            button.classList.toggle("is-selected", mode === "repair" && index === selectedCommand);
            if (mode === "repair") button.setAttribute("aria-pressed", String(index === selectedCommand));
            if (current) button.setAttribute("aria-current", "step");
            button.disabled = phase === "running";
            button.addEventListener("click", function () {
                if (mode === "repair") {
                    selectedCommand = index;
                    renderProgram();
                    ui.program.querySelectorAll("button")[index].focus({ preventScroll: true });
                    message(`${index + 1}-команда таңдалды. Оны ауыстыру үшін бағытты бас.`, "ready");
                    return;
                }
                removeCommand(index);
                const remaining = ui.program.querySelectorAll("button");
                (remaining[Math.min(index, remaining.length - 1)] || palette[0]).focus();
            });
            item.append(button);
            ui.program.append(item);
        });
        ui.count.textContent = mode === "repair" ? `${commands.length} команда` : `${commands.length} / ${limit}`;
        ui.empty.hidden = commands.length > 0;
    }

    function renderControls() {
        const completed = progress.snapshot().completed;
        const running = phase === "running";
        palette.forEach(function (button) { button.disabled = running; });
        ui.run.disabled = running;
        ui.stop.disabled = !running;
        ui.undo.disabled = mode === "repair" || running || commands.length === 0;
        ui.clear.disabled = mode === "repair" || commands.length === 0;
        ui.next.hidden = mode === "repair" || phase !== "won";
        ui["repair-help"].hidden = mode !== "repair" || !["collision", "warning"].includes(phase);
        ui["repair-hint"].hidden = mode !== "repair" || !repairHintRevealed;
        ui["repair-hint"].textContent = repairHintRevealed ? (phase === "collision"
            ? `Робот ${activeCommand + 1}-командада тоқтады. Белгіленген команданың бағытын алаңмен салыстыр. Оған дейінгі жолды да тексер.`
            : "Командаларды басынан бастап ойша орында. Қай қадам роботты мақсаттан алыстатты?") : "";
        ui.next.textContent = levelIndex < levels.length - 1 ? "Келесі деңгей →" : "Мәзірге оралу";
        ui.progress.textContent = `Өтілгені: ${completed.length} / ${levels.length}`;
        Array.from(ui.level.options).forEach(function (option, index) {
            option.textContent = `${index + 1}. ${levels[index].name}${completed.includes(levels[index].id) ? " · Өтілді ✓" : ""}`;
        });
        ui.notice.textContent = progress.snapshot().notice;
    }

    function renderMode() {
        const repairing = mode === "repair";
        screen.dataset.mode = mode;
        ui["repair-instructions"].hidden = !repairing;
        ui.level.parentElement.hidden = repairing;
        ui.progress.hidden = repairing;
        help.hidden = repairing;
        ui.menu.textContent = repairing ? "← Еркін ойын" : "← Мәзір";
        ui.reset.textContent = repairing ? "↺ Тапсырманы қайта бастау" : "↺ Қайта бастау";
        ui["direction-help"].textContent = repairing ? "Команданы таңда, содан кейін жаңа бағытты бас." : "Бір рет басу — бір торкөз жүру. Алдымен жолды ойша жүріп өт.";
    }

    function saveProgram() {
        progress.setProgram(levels[levelIndex].id, commands);
    }

    function reset(text = "Бағыттарды таңда да, роботты іске қос!") {
        cancel();
        phase = "ready";
        activeCommand = -1;
        selectedCommand = -1;
        repairHintRevealed = false;
        position = { ...start };
        visited = new Set();
        renderBoard();
        renderProgram();
        renderControls();
        message(text);
    }

    function setLevel(index, remember = true) {
        if (!Number.isInteger(index) || index < 0 || index >= levels.length) return;
        cancel();
        levelIndex = index;
        const id = levels[index].id;
        commands = progress.snapshot().programs[id] || [];
        if (remember) progress.select(id);
        ui.level.value = String(index);
        ui["level-title"].textContent = `${index + 1}. ${levels[index].name}`;
        ui.hint.textContent = levels[index].hint;
        drawBoard();
        renderMode();
        reset(commands.length ? "Бағдарламаң дайын. Жолды тексеріп, іске қос немесе командаларды өзгерт." : undefined);
    }

    function addCommand(direction) {
        if (phase === "running") return;
        if (mode === "repair") {
            if (selectedCommand < 0) {
                message("Алдымен ауыстыратын команданы таңда.", "warning");
                return;
            }
            if (commands[selectedCommand] === direction) {
                message("Бұл бағыт өзгерген жоқ. Басқа бағытты таңда.", "warning");
                return;
            }
            commands[selectedCommand] = direction;
            reset("Команда ауыстырылды. Бағдарламаны қайта іске қосып, жолды тексер!");
            return;
        }
        if (commands.length >= limit) {
            message(`Ең көбі ${limit} команда қосуға болады. Артық команданы өшіріп, жолды қысқартып көр.`, "warning");
            return;
        }
        commands.push(direction);
        saveProgram();
        reset(`${commands.length} команда дайын. Енді іске қос!`);
    }

    function removeCommand(index) {
        if (mode === "repair" || phase === "running" || index < 0 || index >= commands.length) return;
        commands.splice(index, 1);
        saveProgram();
        reset("Команда өшірілді. Жолды түзетіп, қайта іске қос.");
    }

    function finish(kind, text) {
        const focusedStop = document.activeElement === ui.stop;
        phase = kind;
        timer = null;
        renderBoard();
        renderProgram();
        renderControls();
        message(text, kind);
        if (focusedStop) (kind === "won" && mode === "free" ? ui.next : ui.run).focus({ preventScroll: true });
    }

    function run() {
        if (phase === "running" || !screen.classList.contains("active")) return;
        if (commands.length === 0) {
            message("Алдымен жебелерді басып, роботқа командалар қос.", "warning");
            return;
        }
        selectedCommand = -1;
        reset();
        phase = "running";
        const runId = generation;
        const program = commands.slice();
        renderProgram();
        renderControls();
        ui.stop.focus({ preventScroll: true });
        message("Робот жүріп келеді…", "running");
        if (window.matchMedia("(max-width: 760px)").matches) {
            ui.board.scrollIntoView({ block: "start" });
        }

        function schedule(action, delay) {
            timer = setTimeout(function () {
                if (runId !== generation || !screen.classList.contains("active")) return;
                action();
            }, delay);
        }

        function step(index) {
            if (index === program.length) {
                activeCommand = program.length;
                finish("warning", mode === "repair" ? "Командалар аяқталды, бірақ робот мақсатқа жетпеді. Жолды тексеріп, команданы ауыстырып көр." : "Командалар аяқталды, бірақ мақсатқа әлі жетпедің. Жолға командалар қос немесе оларды түзетіп көр.");
                return;
            }
            activeCommand = index;
            const direction = directions[program[index]];
            const next = { x: position.x + direction.x, y: position.y + direction.y };
            const map = levels[levelIndex].map;
            const outside = next.y < 0 || next.y >= map.length || next.x < 0 || next.x >= map[0].length;
            if (outside || map[next.y][next.x] === "#") {
                finish("collision", mode === "repair"
                    ? `Робот ${outside ? "алаңның шетіне" : "қабырғаға"} тірелді. Қай команданы өзгерту керек? Команданы таңдап, басқа бағытпен ауыстыр. Қиналсаң, «Көмек» батырмасын бас.`
                    : `${index + 1}-командада ${outside ? "алаңның шетіне" : "қабырғаға"} тірелдің. Робот орнында қалды. Осы команданы түзетіп көр!`);
                return;
            }
            visited.add(`${position.x},${position.y}`);
            position = next;
            renderBoard();
            renderProgram();
            message(`${mode === "repair" ? "" : `${index + 1} / ${program.length}: ${direction.label}. `}Робот ${position.y + 1}-қатарда, ${position.x + 1}-бағанда.`, "running");
            if (map[next.y][next.x] === "G") {
                schedule(function () {
                    activeCommand = index + 1;
                    if (mode === "repair") {
                        finish("won", "Жарайсың! Қате команданы түзеттің. Робот мақсатқа жетті! Қай команданы өзгерттің? Неліктен?");
                    } else {
                        progress.complete(levels[levelIndex].id);
                        const allDone = progress.snapshot().completed.length === levels.length;
                        finish("won", allDone ? "Керемет! Барлық лабиринттен өттің! Енді басқа жолдарды да байқап көр." : `Жарайсың! Робот мақсатқа ${index + 1} қадамда жетті! Қалған командалар орындалмайды.`);
                    }
                }, 450);
                return;
            }
            schedule(function () { step(index + 1); }, 650);
        }

        schedule(function () { step(0); }, 450);
    }

    function stop() {
        if (phase !== "running") return;
        cancel();
        finish("stopped", mode === "repair" ? "Робот тоқтады. Бағдарламаны қайта іске қосып, қатені таба аласың." : "Робот тоқтады. Қайта іске қосқанда, бастапқы орнынан жүреді. Бағдарламаң сақталды.");
    }

    function leaveRepair() {
        cancel();
        mode = "free";
        const savedId = progress.snapshot().currentLevelId;
        const index = levels.findIndex(level => level.id === savedId);
        setLevel(index < 0 ? 0 : index, false);
    }

    levels.forEach(function (level, index) {
        const option = document.createElement("option");
        option.value = String(index);
        option.textContent = `${index + 1}. ${level.name}`;
        ui.level.append(option);
    });
    palette.forEach(function (button) {
        button.addEventListener("click", function () { addCommand(button.dataset.direction); });
    });
    ui.level.addEventListener("change", function () { if (mode === "free") setLevel(Number(ui.level.value)); });
    ui.run.addEventListener("click", run);
    ui.stop.addEventListener("click", stop);
    ui.reset.addEventListener("click", function () {
        if (mode === "repair") {
            commands = MAZE_REPAIR_TASK.program.slice();
            reset("Бастапқы тапсырма қалпына келді. Бағдарламада бір қате бар. Оны тауып, түзетіп көр!");
        } else {
            reset("Робот бастапқы орнына оралды. Бағдарламаң сақталды: түзет немесе қайта іске қос.");
        }
    });
    ui["repair-help"].addEventListener("click", function () {
        if (mode !== "repair" || !["collision", "warning"].includes(phase)) return;
        repairHintRevealed = true;
        renderProgram();
        renderControls();
    });
    ui.clear.addEventListener("click", function () {
        if (mode === "repair") return;
        commands = [];
        saveProgram();
        reset("Бағдарлама тазартылды. Жаңа жол құрастыр!");
    });
    ui.undo.addEventListener("click", function () { removeCommand(commands.length - 1); });
    ui.menu.addEventListener("click", function () { if (mode === "repair") leaveRepair(); else onExit(); });
    ui.next.addEventListener("click", function () {
        if (mode !== "free" || phase !== "won") return;
        if (levelIndex === levels.length - 1) {
            onExit();
        } else {
            setLevel(levelIndex + 1);
            document.getElementById("maze-title").focus();
        }
    });
    document.addEventListener("keydown", function (event) {
        if (!screen.classList.contains("active") || event.target.closest("input, select, textarea, [contenteditable]")) return;
        if (event.key === "Escape") {
            event.preventDefault();
            stop();
            return;
        }
        if (event.ctrlKey && event.key === "Enter") {
            event.preventDefault();
            if (!event.repeat) run();
            return;
        }
        if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
        const keys = { ArrowUp: "up", ArrowRight: "right", ArrowDown: "down", ArrowLeft: "left" };
        if (keys[event.key] || event.key === "Backspace") {
            event.preventDefault();
            if (event.repeat) return;
            if (event.key === "Backspace") removeCommand(commands.length - 1);
            else addCommand(keys[event.key]);
        }
    });
    window.addEventListener("pagehide", stop);
    document.addEventListener("visibilitychange", function () {
        if (document.hidden) stop();
    });

    setLevel(0, false);
    return {
        open(robotIcon, levelId) {
            mode = "free";
            icon = robotIcon;
            const index = levels.findIndex(level => level.id === levelId);
            setLevel(index < 0 ? 0 : index);
        },
        openRepair(robotIcon) {
            mode = "free";
            icon = robotIcon;
            const index = levels.findIndex(level => level.id === MAZE_REPAIR_TASK.levelId);
            if (index < 0) return;
            setLevel(index, false);
            mode = "repair";
            commands = MAZE_REPAIR_TASK.program.slice();
            renderMode();
            reset("Бағдарламаны іске қосып, роботтың қай жерде тоқтайтынын бақыла.");
        },
        close() {
            cancel();
            phase = "ready";
            mode = "free";
            selectedCommand = -1;
        }
    };
}
