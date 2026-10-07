const startScreen = document.getElementById("start-screen");
const setupScreen = document.getElementById("setup-screen");
const menuScreen = document.getElementById("menu-screen");

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

function showScreen(screenToShow) {
    const screens = document.querySelectorAll(".screen");

    screens.forEach(function (screen) {
        screen.classList.remove("active");
    });

    screenToShow.classList.add("active");
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
    localStorage.setItem("robocode-player", JSON.stringify(player));
}

function loadPlayer() {
    const savedPlayer = localStorage.getItem("robocode-player");

    if (!savedPlayer) {
        return null;
    }

    return JSON.parse(savedPlayer);
}

function updateMenu(player) {
    menuGreeting.textContent = `Сәлем, ${player.name}!`;
    menuClass.textContent = `${player.class}-сынып`;
    menuXp.textContent = player.xp;
    menuRobotIcon.textContent = getRobotIcon(player.robot);
}

function openMenu(player) {
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
});

const classButtons = document.querySelectorAll(".class-button");

classButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        classButtons.forEach(function (otherButton) {
            otherButton.classList.remove("selected");
        });

        button.classList.add("selected");

        playerClass = Number(button.dataset.class);
        setupError.textContent = "";
    });
});

const robotChoices = document.querySelectorAll(".robot-choice");

robotChoices.forEach(function (button) {
    button.addEventListener("click", function () {
        robotChoices.forEach(function (otherButton) {
            otherButton.classList.remove("selected");
        });

        button.classList.add("selected");

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