const MAZE_COMMAND_LIMIT = 24;

const MAZE_DIRECTIONS = {
    up: { x: 0, y: -1, arrow: "↑", label: "Жоғары" },
    right: { x: 1, y: 0, arrow: "→", label: "Оңға" },
    down: { x: 0, y: 1, arrow: "↓", label: "Төмен" },
    left: { x: -1, y: 0, arrow: "←", label: "Солға" }
};

const MAZE_LEVELS = [
    { id: "first-steps", name: "Алғашқы қадам", hint: "Жұлдызға дейінгі торкөздерді сана. Роботты соған жеткіз!", map: ["..#.", "S..G", "....", ".#.."] },
    { id: "around-the-wall", name: "Бұрылыс", hint: "Алдыңда қабырға бар. Оны айналып өтетін жол тап.", map: ["...#.", "S#...", "...#.", "##.#.", "...G."] },
    { id: "choose-the-path", name: "Жолды таңда", hint: "Бірнеше жол бар. Командаларды қоспас бұрын, жолды ойша жүріп өт.", map: ["S#...", "...#.", "##.#.", "...#G", ".#..."] },
    { id: "long-journey", name: "Ұзақ сапар", hint: "Бұрылыстарға мұқият қара. Ұзақ жолды қысқа бөліктерге бөліп ойлан.", map: ["S..#..", "##.#.#", "...#..", ".###.#", "...#G.", "#....."] }
];

const MAZE_REPAIR_TASK = {
    levelId: "around-the-wall",
    program: ["down", "right", "up", "down", "down", "right"]
};
