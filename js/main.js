const menuScreen = document.getElementById("menu-screen");
const mazeScreen = document.getElementById("maze-screen");
const settingsScreen = document.getElementById("settings-screen");
const progress = createMazeProgress(MAZE_LEVELS);
let storageNotice = "";
let toastTimer;
let currentPlayer = loadPlayer();
const audio = createGameAudio();
const rewards = createRewards(currentPlayer.xp);
const maze = createMaze(openMenu, progress, completed, audio.play);
const journey = createJourney(openMenu, completed, audio.play);
const byId = id => document.getElementById(id);

function loadPlayer() {
    const fallback = { name: "Дос", class: 3, robot: "blue", xp: 0, level: 1 };
    try {
        const raw = localStorage.getItem("robocode-player");
        if (raw === null) return fallback;
        const player = JSON.parse(raw);
        if (!player || typeof player !== "object" || Array.isArray(player)) throw new Error("profile");
        return { ...fallback, ...player, name: typeof player.name === "string" && player.name.trim() ? player.name : "Дос" };
    } catch {
        storageNotice = "Профиль ашылмады. Ойнай беруге болады; бұрынғы деректер өзгертілмейді.";
        return fallback;
    }
}
function hideToast() { clearTimeout(toastTimer); byId("reward-toast").hidden = true; }
function showScreen(screen) {
    hideToast();
    if (screen !== mazeScreen) maze.close();
    if (screen.id !== "journey-screen") journey.close();
    document.querySelectorAll("dialog[open]").forEach(dialog => dialog.close());
    document.querySelectorAll(".screen").forEach(item => item.classList.toggle("active", item === screen));
    const heading = screen.querySelector("h1, h2");
    if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
    window.scrollTo(0, 0);
}
function syncRewards() { rewards.sync(progress.snapshot().completed, journey.snapshot().completed); }
function updateMenu() {
    syncRewards();
    const earned = rewards.snapshot();
    const saved = progress.snapshot();
    const journeySaved = journey.snapshot();
    byId("menu-greeting").textContent = `Сәлем, ${currentPlayer.name}!`;
    byId("menu-robot-icon").replaceChildren(createRobi());
    byId("menu-xp").textContent = `${earned.xp} XP`;
    const allDone = saved.completed.length === MAZE_LEVELS.length;
    const resumeIndex = MAZE_LEVELS.findIndex(level => level.id === progress.resumeLevelId());
    byId("continue-learning-button").textContent = earned.tasks.length || saved.programs[progress.resumeLevelId()]?.length ? "Жалғастыру →" : "Жолға шығу →";
    byId("menu-next-task").textContent = allDone ? "Келесі ауылда Робиге жаңа ереже үйрет." : `Келесі жол: ${resumeIndex + 1}. ${MAZE_LEVELS[resumeIndex].name}`;
    byId("menu-progress-text").textContent = `${saved.completed.length} / ${MAZE_LEVELS.length} деңгей аяқталды`;
    byId("menu-progress-bar").value = saved.completed.length;
    byId("maze-chapter-status").textContent = allDone ? "✓ Аяқталды" : "Жолды аш";
    byId("menu-journey-message").textContent = allDone ? "Төрт жол да ашық. Қайта ойнауға болады!" : "Робиді жұлдызға жеткіз!";
    const list = byId("menu-levels"); list.replaceChildren();
    MAZE_LEVELS.forEach((level, index) => {
        const button = document.createElement("button"); button.type = "button"; button.className = "level-card";
        const done = saved.completed.includes(level.id); button.classList.toggle("is-complete", done);
        const number = document.createElement("span"); number.className = "level-number"; number.textContent = index + 1;
        const name = document.createElement("span"); name.className = "level-name"; name.textContent = level.name;
        const status = document.createElement("span"); status.className = "level-status"; status.textContent = done ? "✓ Аяқталды" : saved.programs[level.id]?.length ? "Жалғастыру" : "Бастау";
        button.append(number, name, status); button.addEventListener("click", () => openMaze(level.id)); list.append(button);
    });
    byId("journey-menu-progress").textContent = `${journeySaved.completed.length} / 9 тапсырма · ${earned.chapters.filter(id => id.startsWith("village-")).length} / 3 ауыл`;
    byId("menu-achievements-count").textContent = `${earned.achievements.length} / ${ROBO_ACHIEVEMENTS.length} белгі ашылды`;
    const last = ROBO_ACHIEVEMENTS.find(item => item.id === earned.achievements.at(-1));
    byId("menu-latest").textContent = last ? `Ашылған белгі: ${last.title}` : "Әр жаңа тапсырма үшін 10 XP аласың.";
    byId("menu-notice").textContent = [storageNotice, saved.notice, journeySaved.notice, earned.notice].filter(Boolean).join(" ");
}
function openMenu() { updateMenu(); showScreen(menuScreen); }
function openMaze(id = progress.resumeLevelId()) { showScreen(mazeScreen); maze.open(currentPlayer.robot, id); }
function openJourney() { showScreen(byId("journey-screen")); journey.open(currentPlayer.robot); }
function completed(taskId, steps) {
    const event = rewards.complete(taskId, steps);
    const titles = event.achievements.map(id => ROBO_ACHIEVEMENTS.find(item => item.id === id).title);
    audio.play(titles.length ? "achievement" : "win");
    if (event.chapters.length) {
        byId("celebration-chapter").textContent = event.chapters.map(id => `${ROBO_CHAPTERS.find(chapter => chapter.id === id).title} аяқталды!`).join(" ");
        byId("celebration-robi").replaceChildren(createRobi("happy"));
        byId("celebration-xp").textContent = `+${event.xp} XP · Барлығы ${rewards.snapshot().xp} XP`;
        const list = byId("celebration-achievements"); list.replaceChildren();
        titles.forEach(title => { const item = document.createElement("li"); item.textContent = `★ ${title}`; list.append(item); });
        byId("celebration-notice").textContent = [progress.snapshot().notice, journey.snapshot().notice, rewards.snapshot().notice].filter(Boolean).join(" ");
        showScreen(byId("celebration-screen"));
    } else if (event.xp || titles.length) {
        hideToast();
        byId("reward-toast-text").textContent = `${titles.length ? `Жаңа жетістік! ${titles.join(" · ")}. ` : "Тапсырма аяқталды! "}${event.xp ? `+${event.xp} XP` : ""}`;
        byId("reward-toast").hidden = false; toastTimer = setTimeout(hideToast, 6500);
    }
}
function openAchievements() {
    syncRewards(); const saved = rewards.snapshot(); byId("achievements-xp").textContent = `${saved.xp} XP`;
    const list = byId("achievements-list"); list.replaceChildren();
    ROBO_ACHIEVEMENTS.forEach(achievement => {
        const unlocked = saved.achievements.includes(achievement.id);
        const card = document.createElement("article"); card.className = `achievement-card${unlocked ? " is-unlocked" : ""}`; card.dataset.achievement = achievement.id;
        const icon = document.createElement("span"); icon.className = "achievement-icon"; icon.setAttribute("aria-hidden", "true"); icon.textContent = unlocked ? achievement.icon : "◇";
        const title = document.createElement("h2"); title.textContent = achievement.title;
        const description = document.createElement("p"); description.textContent = achievement.description;
        const status = document.createElement("strong"); status.textContent = unlocked ? "✓ Ашылды" : "Әлі ашылмады";
        card.append(icon, title, description, status); list.append(card);
    });
    showScreen(byId("achievements-screen"));
}
function openSettings() { byId("player-name").value = currentPlayer.name; byId("sound-toggle").checked = audio.enabled(); showScreen(settingsScreen); }
function on(id, action) { byId(id).addEventListener("click", action); }
on("continue-learning-button", () => { if (progress.snapshot().completed.length === MAZE_LEVELS.length) openJourney(); else openMaze(); });
on("repair-task-button", () => { showScreen(mazeScreen); maze.openRepair(currentPlayer.robot); });
on("journey-open", openJourney);
on("journey-options", () => { journey.stop(); byId("journey-options-dialog").showModal(); });
on("journey-options-close", () => byId("journey-options-dialog").close());
on("settings-open", openSettings);
on("settings-back", openMenu);
on("achievements-open", openAchievements);
on("achievements-back", openMenu);
on("celebration-menu", openMenu);
on("reward-toast-close", hideToast);
on("maze-help-open", () => { maze.stop(); byId("maze-help-dialog").showModal(); });
on("maze-help-close", () => byId("maze-help-dialog").close());
byId("name-form").addEventListener("submit", event => {
    event.preventDefault(); currentPlayer = { ...currentPlayer, name: byId("player-name").value.trim().slice(0, 20) || "Дос" };
    try { localStorage.setItem("robocode-player", JSON.stringify(currentPlayer)); storageNotice = ""; byId("settings-status").textContent = "Атың сақталды."; }
    catch { byId("settings-status").textContent = "Атың осы сеанста өзгерді, бірақ браузерге сақталмады."; }
});
byId("sound-toggle").addEventListener("change", event => {
    byId("settings-status").textContent = audio.set(event.target.checked) ? "Дыбыс таңдауы сақталды." : "Дыбыс өзгерді, бірақ таңдау браузерге сақталмады.";
});
document.addEventListener("click", event => { if (event.target.closest("button:not(:disabled)") && !event.target.closest("[data-direction], [data-card]")) audio.play("click"); });
on("teacher-open", () => showScreen(byId("teacher-screen")));
on("teacher-back", openSettings);
on("teacher-print", () => window.print());
on("journey-export", () => {
    const field = byId("journey-save-code"); field.value = journey.exportCode(); field.focus(); field.select();
    byId("journey-backup-status").textContent = "Код дайын. Ол тек саяхатты сақтайды; лабиринт, профиль және жетістік деректері кірмейді.";
});
on("journey-import", () => {
    const restored = journey.importCode(byId("journey-save-code").value); if (restored) syncRewards();
    byId("journey-backup-status").textContent = restored ? `Саяхат қалпына келтірілді. ${journey.snapshot().notice}` : "Код ашылмады. Бұрынғы деректер өзгерген жоқ.";
});
on("reset-progress-open", () => byId("reset-progress-dialog").showModal());
on("reset-progress-cancel", () => byId("reset-progress-dialog").close());
on("reset-progress-confirm", () => {
    const blank = {
        "robocode-maze-progress": { version: 1, currentLevelId: MAZE_LEVELS[0].id, completed: [], programs: {} },
        "robocode-journey": { version: 1, completed: [], verified: [], drafts: {}, examFailures: 0 },
        "robocode-rewards": { version: 1, tasks: [], achievements: [], chapters: [], longProgram: false, legacyXp: 0 }
    };
    const previous = {};
    try {
        for (const key of Object.keys(blank)) previous[key] = localStorage.getItem(key);
        for (const [key, value] of Object.entries(blank)) localStorage.setItem(key, JSON.stringify(value));
        location.reload();
    } catch {
        for (const [key, value] of Object.entries(previous)) { try { if (value === null) localStorage.removeItem(key); else localStorage.setItem(key, value); } catch {} }
        byId("reset-progress-dialog").close(); byId("settings-status").textContent = "Тазарту аяқталмады: браузер сақтау орнын өзгертуге рұқсат бермеді.";
    }
});
openMenu();
