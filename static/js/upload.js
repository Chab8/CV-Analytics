document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".formulario-contenedor");
    if (!form) return;

    const inputs = { cv: document.getElementById("cv"), req: document.getElementById("requisitos") };
    const boton = document.getElementById("boton-comparar");
    const hint = document.getElementById("hint");
    const error = document.getElementById("error");
    const overlay = document.getElementById("overlay");
    const flow = [...document.querySelectorAll("#flow li")];
    const areas = [...document.querySelectorAll(".drop-area")];
    const VALIDO = /\.(pdf|docx?|jpe?g|png)$/i;
    const MAX = 10 * 1024 * 1024;
    const tam = b => (b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB");

    function mostrarError(msg) { error.textContent = msg; error.hidden = !msg; }

    function pintar() {
        areas.forEach(a => {
            const f = document.getElementById(a.dataset.target).files[0];
            a.classList.toggle("filled", !!f);
            a.querySelector(".file-name").textContent = f ? f.name : "Arrastrá el archivo acá o hacé clic para elegirlo";
            a.querySelector(".file-meta").textContent = f ? tam(f.size) + " · hacé clic para cambiarlo" : "PDF, Word, JPG o PNG · hasta 10 MB";
        });
        const tieneCV = inputs.cv.files.length > 0, tieneReq = inputs.req.files.length > 0;
        const faltan = 2 - (tieneCV + tieneReq);
        flow[0].classList.toggle("done", tieneCV);
        flow[1].classList.toggle("done", tieneReq);
        flow[2].classList.toggle("done", false);
        boton.disabled = faltan > 0;
        hint.textContent = faltan === 2 ? "Elegí tu CV y la oferta para continuar." : faltan === 1 ? "Falta 1 archivo." : "Todo listo.";
    }

    function aceptar(input, file) {
        if (!VALIDO.test(file.name)) return mostrarError("Ese formato no está permitido. Usá PDF, Word, JPG o PNG.");
        if (file.size > MAX) return mostrarError("El archivo supera los 10 MB. Probá con uno más liviano.");
        mostrarError("");
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        pintar();
    }

    areas.forEach(a => {
        const input = document.getElementById(a.dataset.target);
        a.addEventListener("click", () => input.click());
        a.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); input.click(); } });
        a.addEventListener("dragover", e => { e.preventDefault(); a.classList.add("dragover"); });
        a.addEventListener("dragleave", () => a.classList.remove("dragover"));
        a.addEventListener("drop", e => {
            e.preventDefault();
            a.classList.remove("dragover");
            if (e.dataTransfer.files.length) aceptar(input, e.dataTransfer.files[0]);
        });
        input.addEventListener("change", () => { if (input.files[0]) aceptar(input, input.files[0]); else pintar(); });
    });

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (boton.disabled) return;
        mostrarError("");
        const pasos = [...overlay.querySelectorAll("li")];
        let k = 0;
        pasos.forEach(p => (p.className = ""));
        pasos[0].className = "on";
        overlay.hidden = false;
        flow[2].classList.add("done");

        const reloj = setInterval(() => {
            if (k < pasos.length - 1) { pasos[k].className = "done"; pasos[++k].className = "on"; }
        }, 1100);
        const minimo = new Promise(r => setTimeout(r, 2400));

        try {
            const [r] = await Promise.all([fetch(form.action, { method: "POST", body: new FormData(form) }), minimo]);
            if (!r.ok) {
                let msg = "No pudimos procesar los archivos.";
                try { msg = (await r.json()).error || msg; } catch (_) { }
                throw new Error(msg);
            }
            const html = await r.text();
            clearInterval(reloj);
            pasos.forEach(p => (p.className = "done"));
            await new Promise(r => setTimeout(r, 600));
            document.open();
            document.write(html);
            document.close();
        } catch (ex) {
            clearInterval(reloj);
            overlay.hidden = true;
            flow[2].classList.remove("done");
            mostrarError(ex instanceof TypeError
                ? "No pudimos conectar con el servidor. Revisá tu conexión y probá de nuevo."
                : ex.message);
        }
    });

    pintar();
});