document.addEventListener("DOMContentLoaded", () => {
    const circle = document.querySelector(".progress-ring__circle");
    const label = document.querySelector(".progress-label");
    if (!circle || !label) return;

    const objetivo = parseFloat(label.textContent) || 0;
    const c = 2 * Math.PI * circle.r.baseVal.value;
    const pintar = k => {
        circle.style.strokeDashoffset = c - (objetivo / 100) * c * k;
        label.textContent = Math.round(objetivo * k) + "%";
    };

    circle.style.strokeDasharray = c;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return pintar(1);

    pintar(0);
    const t0 = performance.now(), DUR = 1400;
    requestAnimationFrame(function paso(now) {
        const t = Math.min((now - t0) / DUR, 1);
        pintar(1 - Math.pow(1 - t, 3)); // ease-out
        if (t < 1) requestAnimationFrame(paso);
    });
});