const startScreen = document.getElementById("start-screen");
const setupScreen = document.getElementById("setup-screen");

const startButton = document.getElementById("start-button");
const continueButton = document.getElementById("continue-button");

const playerNameInput = document.getElementById("player-name");
const setupError = document.getElementById("setup-error");

let playerClass = null;
let selectedRobot = null;

function showScreen(screenToShow) {
    const screens = document.querySelectorAll(".screen");

    screens.forEach(function (screen) {
        screen.classList.remove("active");
    });

    screenToShow.classList.add("active");
}

startButton.addEventListener("click", function () {
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

        console.log("Таңдалған сынып:", playerClass);
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

        console.log("Таңдалған робот:", selectedRobot);
    });
});

continueButton.addEventListener("click", function () {
    const playerName = playerNameInput.value.trim();

    if (playerName === "") {
        setupError.textContent = "Атыңызды енгізіңіз.";
        return;
    }

    if (playerClass === null) {
        setupError.textContent = "Сыныбын таңдаңыз.";
        return;
    }

    if (selectedRobot === null) {
        setupError.textContent = "Робоңызды таңдаңыз.";
        return;
    }

    console.log("Аты:", playerName);
    console.log("Сынып:", playerClass);
    console.log("Робот:", selectedRobot);

    setupError.textContent = "Профиль жасалды!";
});