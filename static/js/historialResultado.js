/* Guarda la comparación recién hecha en el historial. */
document.addEventListener("DOMContentLoaded", () => {
    const nodo = document.getElementById("datos-historial");
    if (!nodo || !window.historial) return;
    let d;
    try { d = JSON.parse(nodo.textContent); } catch (_) { return; }
    if (!d || !(d.puntaje > 0)) return; // análisis fallido: no se guarda

    historial.guardar({
        id: d.id || historial.nuevoId(),
        tipo: "comparacion",
        cv: d.cv,
        oferta: d.oferta,
        puntaje: d.puntaje,
        feedback: d.feedback,
        sugerencias: d.sugerencias
    });
});