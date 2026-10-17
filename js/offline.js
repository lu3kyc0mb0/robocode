(() => {
    const status = document.getElementById("offline-status");
    if (location.protocol === "file:") {
        status.textContent = "Ойынды файлдан аштың. Офлайн орнату үшін оны localhost немесе HTTPS арқылы аш.";
        return;
    }
    if (!("serviceWorker" in navigator) || !window.isSecureContext) {
        status.textContent = "Бұл браузерде офлайн орнату қолжетімсіз.";
        return;
    }
    status.textContent = "Офлайн ойнауға дайындалып жатыр…";
    navigator.serviceWorker.register("./sw.js").then(registration => {
        navigator.serviceWorker.ready.then(() => {
            status.textContent = "Офлайн ойнауға дайын. Қаласаң, браузер мәзірінен құрылғыға орнат.";
        });
        function watch() {
            const worker = registration.installing;
            if (!worker) return;
            worker.addEventListener("statechange", () => {
                if (worker.state === "redundant") status.textContent = "Офлайн сақтау аяқталмады. Интернетпен қайта ашып көр.";
                if (worker.state === "installed" && navigator.serviceWorker.controller) status.textContent = "Жаңарту дайын. Ойын сақталады: RoboCode қойындыларын жауып, қайта аш.";
            });
        }
        watch(); registration.addEventListener("updatefound", watch);
    }).catch(() => {
        status.textContent = "Офлайн сақтау қолжетімсіз. Интернет қосулы кезде ойнай беруге болады.";
    });
})();
