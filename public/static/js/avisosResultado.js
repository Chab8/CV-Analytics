document.addEventListener("DOMContentLoaded", () => {
    const r = document.querySelector(".result");
    if (!r) return;
    const puntaje = Number(r.dataset.puntaje) || 0;

    if (puntaje > 0) {
        toast.ok("Análisis listo", `Tu CV coincide un ${puntaje}% con la oferta.`);
    } else {
        toast.error("No pudimos calcular la coincidencia", "Revisá que los archivos tengan texto legible.");
    }
    if (r.dataset.sugerenciasError === "1") {
        toast.error("No pudimos generar las sugerencias", "Probá de nuevo en unos minutos.");
    }
});