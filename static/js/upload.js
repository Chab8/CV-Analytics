document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".formulario-contenedor");
    if (!form) return;

    const boton = document.getElementById("boton-comparar");
    const error = document.getElementById("error");
    const overlay = document.getElementById("overlay");
    const areas = [...document.querySelectorAll(".drop-area")];
    const inputDe = a => document.getElementById(a.dataset.target);
    const VALIDO = /\.(pdf|docx?|jpe?g|png)$/i;
    const MAX = 10 * 1024 * 1024;
    const tam = b => (b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB");

    function mostrarError(msg) { error.textContent = msg; error.hidden = !msg; }

    function pintar() {
        areas.forEach(a => {
            const f = inputDe(a).files[0];
            a.classList.toggle("filled", !!f);
            a.querySelector(".file-name").textContent = f ? f.name : "Arrastrá un archivo o hacé click";
            a.querySelector(".file-meta").textContent = f ? tam(f.size) : "";
        });
        boton.disabled = !areas.every(a => inputDe(a).files.length);
    }

    function aceptar(area, file) {
        if (!VALIDO.test(file.name)) return mostrarError("Ese formato no está permitido. Usá PDF, Word, JPG o PNG.");
        if (file.size > MAX) return mostrarError("El archivo supera los 10 MB. Probá con uno más liviano.");
        mostrarError("");
        const dt = new DataTransfer();
        dt.items.add(file);
        inputDe(area).files = dt.files;
        pintar();
        area.classList.remove("pop"); void area.offsetWidth; area.classList.add("pop");
    }

    areas.forEach(a => {
        const input = inputDe(a);
        a.addEventListener("click", () => input.click());
        a.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
        a.addEventListener("dragover", e => { e.preventDefault(); a.classList.add("dragover"); });
        a.addEventListener("dragleave", () => a.classList.remove("dragover"));
        a.addEventListener("drop", e => {
            e.preventDefault();
            a.classList.remove("dragover");
            if (e.dataTransfer.files.length) aceptar(a, e.dataTransfer.files[0]);
        });
        input.addEventListener("change", () => { if (input.files[0]) aceptar(a, input.files[0]); else pintar(); });
    });

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (boton.disabled) return;
        mostrarError("");
        overlay.hidden = false;
        const minimo = new Promise(r => setTimeout(r, 2400));
        try {
            const [r] = await Promise.all([fetch(form.action, { method: "POST", body: new FormData(form) }), minimo]);
            if (!r.ok) {
                let msg = "No pudimos procesar los archivos.";
                try { msg = (await r.json()).error || msg; } catch (_) { }
                throw new Error(msg);
            }
            const html = await r.text();
            document.open(); document.write(html); document.close();
        } catch (ex) {
            overlay.hidden = true;
            mostrarError(ex instanceof TypeError
                ? "No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo."
                : ex.message);
        }
    });

    pintar();
});