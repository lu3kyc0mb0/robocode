const startScreen = document.getElementById("start-screen");
const setupScreen = document.getElementById("setup-screen");
const menuScreen = document.getElementById("menu-screen");
const mazeScreen = document.getElementById("maze-screen");

const startButton = document.getElementById("start-button");
const continueButton = document.getElementById("continue-button");

const playerNameInput = document.getElementById("player-name");
const setupError = document.getElementById("setup-error");

const menuGreeting = document.getElementById("menu-greeting");
const menuClass = document.getElementById("menu-class");
const menuRobotIcon = document.getElementById("menu-robot-icon");
const menuLevels = document.getElementById("menu-levels");
const progress = createMazeProgress(MAZE_LEVELS);

let playerClass = null;
let selectedRobot = null;
let currentPlayer = null;
let storageNotice = "";
const maze = createMaze(function () { openMenu(currentPlayer); }, progress);

function showScreen(screenToShow) {
    if (screenToShow !== mazeScreen) maze.close();
    const screens = document.querySelectorAll(".screen");

    screens.forEach(function (screen) {
        screen.classList.remove("active");
    });

    screenToShow.classList.add("active");
    const heading = screenToShow.querySelector("h1, h2");
    if (heading) {
        heading.setAttribute("tabindex", "-1");
        heading.focus({ preventScroll: true });
    }
    window.scrollTo(0, 0);
}

function getRobotIcon(robot) {
    if (robot === "blue") {
        return "🤖";
    }

    if (robot === "red") {
        return "🦾";
    }

    if (robot === "gold") {
        return "👾";
    }

    return "🤖";
}

function savePlayer(player) {
    try {
        localStorage.setItem("robocode-player", JSON.stringify(player));
        storageNotice = "";
    } catch {
        storageNotice = "Профильді браузерде сақтау мүмкін болмады. Әзірге ойнай беруге болады, бірақ бетті жапқанда профиль жоғалуы мүмкін.";
    }
}

function loadPlayer() {
    try {
        const savedPlayer = localStorage.getItem("robocode-player");
        if (!savedPlayer) return null;
        const player = JSON.parse(savedPlayer);
        if (!player || typeof player.name !== "string" || !player.name.trim() ||
            ![1, 2, 3, 4].includes(player.class) || !["blue", "red", "gold"].includes(player.robot)) {
            storageNotice = "Сақталған профильді ашу мүмкін болмады. Профильді қайта толтыр.";
            return null;
        }
        return {
            ...player,
            xp: Number.isFinite(player.xp) && player.xp >= 0 ? player.xp : 0,
            level: Number.isInteger(player.level) && player.level > 0 ? player.level : 1
        };
    } catch {
        storageNotice = "Сақталған профильді ашу мүмкін болмады. Профильді толтырып, ойынды бастауға болады.";
        return null;
    }
}

function updateMenu(player) {
    menuGreeting.textContent = `Сәлем, ${player.name}!`;
    menuClass.textContent = `${player.class}-сынып`;
    menuRobotIcon.textContent = getRobotIcon(player.robot);
    const saved = progress.snapshot();
    const resumeId = progress.resumeLevelId();
    const resumeIndex = MAZE_LEVELS.findIndex(level => level.id === resumeId);
    const allDone = saved.completed.length === MAZE_LEVELS.length;
    document.getElementById("menu-progress-text").textContent = `${saved.completed.length} / ${MAZE_LEVELS.length} деңгей өтілді`;
    document.getElementById("menu-progress-bar").value = saved.completed.length;
    document.getElementById("menu-progress-bar").max = MAZE_LEVELS.length;
    document.getElementById("continue-learning-button").textContent = allDone ? "↺ Қайта ойнау" : `▶ ${resumeIndex + 1}-деңгейді ${saved.programs[resumeId]?.length ? "жалғастыру" : "бастау"}`;
    document.getElementById("menu-journey-message").textContent = allDone ? "Барлық жолды таптың! Қалаған деңгейіңді қайта ойнап көр." : "Жолды ойластыр. Роботты жұлдызға жеткіз!";
    menuLevels.replaceChildren();
    MAZE_LEVELS.forEach(function (level, index) {
        const button = document.createElement("button");
        const number = document.createElement("span");
        const name = document.createElement("span");
        const status = document.createElement("span");
        const done = saved.completed.includes(level.id);
        button.type = "button";
        button.className = "level-card";
        button.classList.toggle("is-complete", done);
        number.className = "level-number";
        number.textContent = String(index + 1);
        name.className = "level-name";
        name.textContent = level.name;
        status.className = "level-status";
        status.textContent = done ? "✓ Өтілді · Қайталау" : saved.programs[level.id]?.length ? "Жалғастыру" : "Бастау";
        button.append(number, name, status);
        button.addEventListener("click", function () { openMaze(level.id); });
        menuLevels.append(button);
    });
    document.getElementById("menu-notice").textContent = [storageNotice, saved.notice].filter(Boolean).join(" ");
    document.getElementById("menu-storage-note").hidden = Boolean(saved.notice);
}

function openMenu(player) {
    currentPlayer = player;
    updateMenu(player);
    showScreen(menuScreen);
}

startButton.addEventListener("click", function () {
    const savedPlayer = loadPlayer();

    if (savedPlayer) {
        openMenu(savedPlayer);
        return;
    }

    showScreen(setupScreen);
    setupError.textContent = storageNotice;
});

const classButtons = document.querySelectorAll(".class-button");

classButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        classButtons.forEach(function (otherButton) {
            otherButton.classList.remove("selected");
            otherButton.setAttribute("aria-pressed", "false");
        });

        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");

        playerClass = Number(button.dataset.class);
        setupError.textContent = "";
    });
});

const robotChoices = document.querySelectorAll(".robot-choice");

robotChoices.forEach(function (button) {
    button.addEventListener("click", function () {
        robotChoices.forEach(function (otherButton) {
            otherButton.classList.remove("selected");
            otherButton.setAttribute("aria-pressed", "false");
        });

        button.classList.add("selected");
        button.setAttribute("aria-pressed", "true");

        selectedRobot = button.dataset.robot;
        setupError.textContent = "";
    });
});

continueButton.addEventListener("click", function () {
    const playerName = playerNameInput.value.trim();

    if (playerName === "") {
        setupError.textContent = "Атыңды жаз.";
        return;
    }

    if (playerClass === null) {
        setupError.textContent = "Сыныбыңды таңда.";
        return;
    }

    if (selectedRobot === null) {
        setupError.textContent = "Роботыңды таңда.";
        return;
    }

    const player = {
        name: playerName,
        class: playerClass,
        robot: selectedRobot,
        xp: 0,
        level: 1
    };

    savePlayer(player);
    openMenu(player);
});

function openMaze(levelId = progress.resumeLevelId()) {
    if (!currentPlayer) return;
    showScreen(mazeScreen);
    maze.open(getRobotIcon(currentPlayer.robot), levelId);
}

document.getElementById("continue-learning-button").addEventListener("click", function () { openMaze(); });
document.getElementById("repair-task-button").addEventListener("click", function () {
    if (!currentPlayer) return;
    showScreen(mazeScreen);
    maze.openRepair(getRobotIcon(currentPlayer.robot));
});
