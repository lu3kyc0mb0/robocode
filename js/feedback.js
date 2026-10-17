function createRobi(mood = "normal") {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 180 180");
    svg.setAttribute("aria-hidden", "true");
    svg.classList.add("robi");
    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `assets/robi.svg#${["normal", "thinking", "happy"].includes(mood) ? mood : "normal"}`);
    svg.append(use);
    return svg;
}
function createGameAudio() {
    let enabled = true;
    let context;
    let interacted = false;
    try { enabled = localStorage.getItem("robocode-sound") !== "off"; } catch {}
    document.addEventListener("pointerdown", () => { interacted = true; }, { capture: true });
    document.addEventListener("keydown", () => { interacted = true; }, { capture: true });
    function play(kind) {
        if (!enabled || !interacted) return;
        try {
            const Audio = window.AudioContext || window.webkitAudioContext;
            if (!Audio) return;
            context ||= new Audio();
            if (context.state === "suspended") context.resume().catch(() => {});
            const notes = { click: [440], add: [520, 660], collision: [220, 170], win: [523, 659, 784], achievement: [659, 784, 1047] }[kind] || [440];
            notes.forEach((frequency, index) => {
                const start = context.currentTime + index * 0.09;
                const oscillator = context.createOscillator();
                const gain = context.createGain();
                oscillator.type = "sine"; oscillator.frequency.value = frequency;
                gain.gain.setValueAtTime(0, start);
                gain.gain.linearRampToValueAtTime(0.045, start + 0.01);
                gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
                oscillator.connect(gain); gain.connect(context.destination);
                oscillator.start(start); oscillator.stop(start + 0.12);
                oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            });
        } catch {}
    }
    return {
        play,
        enabled: () => enabled,
        set(value) {
            enabled = Boolean(value);
            try { localStorage.setItem("robocode-sound", enabled ? "on" : "off"); return true; }
            catch { return false; }
        }
    };
}
