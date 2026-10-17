const CACHE = "robocode-offline-v2";
const FILES = ["./", "./index.html", "./css/style.css", "./css/maze.css", "./css/journey.css", "./css/theme.css", "./js/maze-content.js", "./js/maze-progress.js", "./js/maze.js", "./js/journey-core.js", "./js/journey-content.js", "./js/journey-progress.js", "./js/journey.js", "./js/rewards.js", "./js/feedback.js", "./js/main.js", "./js/offline.js", "./manifest.webmanifest", "./assets/robi.svg", "./assets/icon.svg", "./assets/icon-192.png", "./assets/icon-512.png"];
self.addEventListener("install", event => {
    event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener("activate", event => {
    event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("robocode-offline-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
    if (event.request.method !== "GET") return;
    const url = new URL(event.request.url);
    const known = FILES.some(file => new URL(file, self.registration.scope).href === url.href);
    if (!known) return;
    event.respondWith(caches.open(CACHE).then(cache => cache.match(event.request).then(saved => saved || fetch(event.request))));
});
