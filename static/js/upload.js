document.addEventListener("DOMContentLoaded", () => {
    const form = document.querySelector(".formulario-contenedor");
    if (!form) return;

    const boton = document.getElementById("boton-comparar");
    const overlay = document.getElementById("overlay");
    const areas = [...document.querySelectorAll(".drop-area")];
    const [areaCv, areaOferta] = areas;
    const cajaTexto = document.getElementById("texto-oferta");
    const texto = document.getElementById("requisitos_texto");
    const cambiar = document.getElementById("cambiar-oferta");
    const contador = document.getElementById("contador");
    const inputDe = a => document.getElementById(a.dataset.target);
    const tituloOverlay = document.getElementById("overlay-msg");
    // [milisegundos desde el inicio, texto]. El último queda fijo: si tarda, no se reinicia.
    const MENSAJES = [
        [0, "Analizando tu CV…"],
        [3500, "Corrigiendo errores…"],
        [7000, "Analizando el puesto de trabajo…"],
        [11000, "Comparando tu experiencia con los requisitos…"],
        [15000, "Buscando las palabras clave que te faltan…"],
        [19000, "Verificando compatibilidad con sistemas ATS…"],
        [23000, "Calculando el porcentaje de coincidencia…"],
        [27000, "Preparando tus sugerencias…"],
        [32000, "Últimos detalles…"]
    ];
    let timersMsg = [];

    function detenerMensajes() {
        timersMsg.forEach(clearTimeout);
        timersMsg = [];
    }

    function cambiarMensaje(txt) {
        tituloOverlay.classList.add("cambia");
        timersMsg.push(setTimeout(() => {
            tituloOverlay.textContent = txt;
            tituloOverlay.classList.remove("cambia");
        }, 250));
    }

    function iniciarMensajes() {
        detenerMensajes();
        tituloOverlay.classList.remove("cambia");
        tituloOverlay.textContent = MENSAJES[0][1];
        MENSAJES.slice(1).forEach(([ms, txt]) => timersMsg.push(setTimeout(() => cambiarMensaje(txt), ms)));
    }

    const VALIDO = /\.(pdf|docx?|txt|jpe?g|png)$/i;
    const MAX = 10 * 1024 * 1024;
    const MIN_TEXTO = 30;
    const tam = b => (b < 1048576 ? Math.round(b / 1024) + " KB" : (b / 1048576).toFixed(1) + " MB");
    let modo = "archivo"; // "archivo" | "texto" (solo para la oferta)

    function pintar() {
        areas.forEach(a => {
            const f = inputDe(a).files[0];
            a.classList.toggle("filled", !!f);
            a.querySelector(".file-name").textContent = f ? f.name : "Arrastrá un archivo o hacé click";
            a.querySelector(".file-meta").textContent = f ? tam(f.size) : "";
        });
        const cvListo = inputDe(areaCv).files.length > 0;
        const ofertaLista = modo === "texto"
            ? texto.value.trim().length >= MIN_TEXTO
            : inputDe(areaOferta).files.length > 0;
        boton.disabled = !(cvListo && ofertaLista);
    }

    function fijarModo(nuevo) {
        modo = nuevo;
        areaOferta.hidden = nuevo === "texto";
        cajaTexto.hidden = nuevo !== "texto";
        contador.hidden = nuevo !== "texto";
        cambiar.textContent = nuevo === "texto"
            ? "Subir un archivo en vez de pegar el texto"
            : "Pegar el texto del puesto en vez de subir un archivo";
        if (nuevo === "texto") texto.focus();
        pintar();
    }

    function aceptar(area, file) {
        if (!VALIDO.test(file.name)) {
            return toast.error("Formato no permitido", "Usá PDF, Word, TXT, JPG o PNG.");
        }
        if (file.size > MAX) {
            return toast.error("El archivo es muy pesado", "Supera los 10 MB. Probá con uno más liviano.");
        }
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

    cambiar.addEventListener("click", () => fijarModo(modo === "texto" ? "archivo" : "texto"));
    texto.addEventListener("input", () => {
        const n = texto.value.trim().length;
        contador.textContent = n ? n.toLocaleString("es-AR") + " caracteres" : "";
        pintar();
    });

    form.addEventListener("submit", async e => {
        e.preventDefault();
        if (boton.disabled) return;

        // Solo viaja lo que el usuario eligió: el texto pegado o el archivo de la oferta
        const datos = new FormData(form);
        datos.delete(modo === "texto" ? "requisitos" : "requisitos_texto");

        overlay.hidden = false;
        iniciarMensajes();
        const minimo = new Promise(r => setTimeout(r, 2400));
        try {
            const [r] = await Promise.all([fetch(form.action, { method: "POST", body: datos }), minimo]);
            if (!r.ok) {
                let msg = "No pudimos procesar los archivos.";
                try { msg = (await r.json()).error || msg; } catch (_) { }
                throw new Error(msg);
            }
            const html = await r.text();
            document.open(); document.write(html); document.close();
        } catch (ex) {
            detenerMensajes();
            overlay.hidden = true;
            if (ex instanceof TypeError) {
                toast.error("Sin conexión con el servidor", "Revisá tu conexión y probá de nuevo.");
            } else {
                toast.error("No pudimos analizar tu CV", ex.message);
            }
        }
    });

    pintar();
});