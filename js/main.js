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
const menuXp = document.getElementById("menu-xp");
const menuRobotIcon = document.getElementById("menu-robot-icon");

let playerClass = null;
let selectedRobot = null;
let currentPlayer = null;
let storageNotice = "";
const maze = createMaze(function () { openMenu(currentPlayer); });

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
    menuXp.textContent = player.xp;
    menuRobotIcon.textContent = getRobotIcon(player.robot);
}

function openMenu(player) {
    currentPlayer = player;
    updateMenu(player);
    document.getElementById("menu-notice").textContent = storageNotice;
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

function openMaze() {
    if (!currentPlayer) return;
    showScreen(mazeScreen);
    maze.open(getRobotIcon(currentPlayer.robot));
}

document.getElementById("continue-learning-button").addEventListener("click", openMaze);
document.getElementById("games-button").addEventListener("click", openMaze);
