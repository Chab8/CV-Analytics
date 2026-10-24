/* Sincroniza el haz del hero con el resaltado: cada marca se enciende
   justo cuando el borde del haz pasa por encima de ella. */
(() => {
    const paper = document.querySelector(".paper");
    if (!paper || matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const BEAM = 70;      // alto del haz (igual que .paper::after)
    const DUR = 2.2;      // segundos del recorrido
    const INICIO = 0.3;   // retraso inicial del haz

    paper.dataset.sync = "pend"; // congela las animaciones hasta medir

    const sincronizar = () => {
        const alto = paper.offsetHeight;
        paper.style.setProperty("--paper-h", alto + "px");
        paper.querySelectorAll("mark").forEach(m => {
            const y = m.offsetTop + m.offsetHeight / 2;
            const t = Math.min(Math.max(y / (alto + BEAM), 0), 1);
            m.style.animationDelay = (INICIO + DUR * t).toFixed(2) + "s";
        });
        delete paper.dataset.sync;
    };

    const listo = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    listo.then(() => requestAnimationFrame(sincronizar));
})();