/* Sección ATS: la escena arranca cuando entra en pantalla y se pausa cuando sale. */
(() => {
    const escena = document.querySelector(".ats-stage");
    if (!escena || !("IntersectionObserver" in window)) return;

    // Arranca pausada para que el ciclo empiece desde cero cuando la persona llegue
    escena.classList.add("en-pausa");
    new IntersectionObserver(([e]) => {
        escena.classList.toggle("en-pausa", !e.isIntersecting);
    }, { threshold: .35 }).observe(escena);
})();