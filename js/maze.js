function createMaze(onExit) {
    const levels = [
        { name: "Алғашқы қадам", hint: "Жұлдызға дейінгі торкөздерді сана. Роботты соған жеткіз!", map: ["..#.", "S..G", "....", ".#.."] },
        { name: "Бұрылыс", hint: "Алдыңда қабырға бар. Оны айналып өтетін жол тап.", map: ["...#.", "S#...", "...#.", "##.#.", "...G."] },
        { name: "Жолды таңда", hint: "Бірнеше жол бар. Командаларды қоспас бұрын, жолды ойша жүріп өт.", map: ["S#...", "...#.", "##.#.", "...#G", ".#..."] },
        { name: "Ұзақ сапар", hint: "Бұрылыстарға мұқият қара. Ұзақ жолды қысқа бөліктерге бөліп ойлан.", map: ["S..#..", "##.#.#", "...#..", ".###.#", "...#G.", "#....."] }
    ];
    const directions = {
        up: { x: 0, y: -1, arrow: "↑", label: "Жоғары" },
        right: { x: 1, y: 0, arrow: "→", label: "Оңға" },
        down: { x: 0, y: 1, arrow: "↓", label: "Төмен" },
        left: { x: -1, y: 0, arrow: "←", label: "Солға" }
    };
    const screen = document.getElementById("maze-screen");
    const ui = {};
    for (const name of ["board", "level", "level-title", "hint", "position", "progress", "program", "count", "empty", "feedback", "run", "stop", "reset", "clear", "undo", "next", "menu"]) {
        ui[name] = document.getElementById(`maze-${name}`);
    }
    const palette = Array.from(screen.querySelectorAll("[data-direction]"));
    const completed = new Set();
    const limit = 24;
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
            button.textContent = `${index + 1} ${directions[command].arrow} ×`;
            button.setAttribute("aria-label", `${index + 1}. ${directions[command].label}. Команданы өшіру`);
            const current = index === activeCommand && ["running", "collision", "stopped"].includes(phase);
            button.classList.toggle("is-current", current);
            button.classList.toggle("is-done", index < activeCommand);
            button.classList.toggle("is-error", index === activeCommand && phase === "collision");
            if (current) button.setAttribute("aria-current", "step");
            button.disabled = phase === "running";
            button.addEventListener("click", function () {
                removeCommand(index);
                const remaining = ui.program.querySelectorAll("button");
                (remaining[Math.min(index, remaining.length - 1)] || palette[0]).focus();
            });
            item.append(button);
            ui.program.append(item);
        });
        ui.count.textContent = `${commands.length} / ${limit}`;
        ui.empty.hidden = commands.length > 0;
    }

    function renderControls() {
        const running = phase === "running";
        palette.forEach(function (button) { button.disabled = running; });
        ui.run.disabled = running;
        ui.stop.disabled = !running;
        ui.undo.disabled = running || commands.length === 0;
        ui.next.hidden = phase !== "won";
        ui.next.textContent = levelIndex < levels.length - 1 ? "Келесі деңгей →" : "Мәзірге оралу";
        ui.progress.textContent = `Өтілгені: ${completed.size} / ${levels.length}`;
    }

    function reset(text = "Бағыттарды таңда да, роботты іске қос!") {
        cancel();
        phase = "ready";
        activeCommand = -1;
        position = { ...start };
        visited = new Set();
        renderBoard();
        renderProgram();
        renderControls();
        message(text);
    }

    function setLevel(index) {
        cancel();
        levelIndex = index;
        commands = [];
        ui.level.value = String(index);
        ui["level-title"].textContent = `${index + 1}. ${levels[index].name}`;
        ui.hint.textContent = levels[index].hint;
        drawBoard();
        reset();
    }

    function addCommand(direction) {
        if (phase === "running") return;
        if (commands.length >= limit) {
            message(`Ең көбі ${limit} команда қосуға болады. Артық команданы өшіріп, жолды қысқартып көр.`, "warning");
            return;
        }
        commands.push(direction);
        reset(`${commands.length} команда дайын. Енді іске қос!`);
    }

    function removeCommand(index) {
        if (phase === "running" || index < 0 || index >= commands.length) return;
        commands.splice(index, 1);
        reset("Команда өшірілді. Жолды түзетіп, қайта іске қос.");
    }

    function finish(kind, text) {
        phase = kind;
        timer = null;
        renderBoard();
        renderProgram();
        renderControls();
        message(text, kind);
    }

    function run() {
        if (phase === "running" || !screen.classList.contains("active")) return;
        if (commands.length === 0) {
            message("Алдымен жебелерді басып, роботқа командалар қос.", "warning");
            return;
        }
        reset();
        phase = "running";
        const runId = generation;
        const program = commands.slice();
        renderProgram();
        renderControls();
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
                finish("warning", "Командалар аяқталды, бірақ мақсатқа әлі жетпедің. Жолға командалар қос немесе оларды түзетіп көр.");
                return;
            }
            activeCommand = index;
            const direction = directions[program[index]];
            const next = { x: position.x + direction.x, y: position.y + direction.y };
            const map = levels[levelIndex].map;
            const outside = next.y < 0 || next.y >= map.length || next.x < 0 || next.x >= map[0].length;
            if (outside || map[next.y][next.x] === "#") {
                finish("collision", `${index + 1}-командада ${outside ? "алаңның шетіне" : "қабырғаға"} тірелдің. Робот орнында қалды. Осы команданы түзетіп көр!`);
                return;
            }
            visited.add(`${position.x},${position.y}`);
            position = next;
            renderBoard();
            renderProgram();
            message(`${index + 1} / ${program.length}: ${direction.label}. Робот ${position.y + 1}-қатарда, ${position.x + 1}-бағанда.`, "running");
            if (map[next.y][next.x] === "G") {
                schedule(function () {
                    completed.add(levelIndex);
                    activeCommand = index + 1;
                    const allDone = completed.size === levels.length;
                    finish("won", allDone ? "Керемет! Барлық лабиринттен өттің! Енді басқа жолдарды да байқап көр." : `Жарайсың! Робот мақсатқа ${index + 1} қадамда жетті! Қалған командалар орындалмайды.`);
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
        finish("stopped", "Робот тоқтады. Қайта іске қосқанда, бастапқы орнынан жүреді. Бағдарламаң сақталды.");
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
    ui.level.addEventListener("change", function () { setLevel(Number(ui.level.value)); });
    ui.run.addEventListener("click", run);
    ui.stop.addEventListener("click", stop);
    ui.reset.addEventListener("click", function () { reset("Робот бастапқы орнына оралды. Бағдарламаң сақталды: түзет немесе қайта іске қос."); });
    ui.clear.addEventListener("click", function () {
        commands = [];
        reset("Бағдарлама тазартылды. Жаңа жол құрастыр!");
    });
    ui.undo.addEventListener("click", function () { removeCommand(commands.length - 1); });
    ui.menu.addEventListener("click", onExit);
    ui.next.addEventListener("click", function () {
        if (phase !== "won") return;
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

    setLevel(0);
    return {
        open(robotIcon) {
            icon = robotIcon;
            token.firstElementChild.textContent = icon;
            reset();
        },
        close() {
            cancel();
            phase = "ready";
        }
    };
}
