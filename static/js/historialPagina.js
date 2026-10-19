document.addEventListener("DOMContentLoaded", () => {
    const raiz = document.getElementById("historial");
    if (!raiz) return;

    const BORRADOR = "cvAnalytics.cvDraft"; // misma clave que usa crearCV.js
    const ANCHO_A4 = 794;
    const lista = document.getElementById("hist-lista");
    const vacio = document.getElementById("hist-vacio");
    const vacioTxt = document.getElementById("hist-vacio-txt");
    const btnVaciar = document.getElementById("hist-vaciar");
    const filtros = [...raiz.querySelectorAll(".hist-filtro")];
    const modal = document.getElementById("hist-modal");
    const modalTitulo = document.getElementById("hist-modal-titulo");
    const hoja = document.getElementById("hist-hoja");
    const frame = document.getElementById("hist-frame");
    const fecha = new Intl.DateTimeFormat("es-AR", { dateStyle: "medium", timeStyle: "short" });
    let filtro = "todo";

    // Todo el contenido del usuario entra como texto, nunca como HTML
    const el = (tag, props = {}, ...hijos) => {
        const n = document.createElement(tag);
        Object.entries(props).forEach(([k, v]) => {
            if (k === "class") n.className = v;
            else if (k === "style") n.setAttribute("style", v);
            else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
            else n.setAttribute(k, v);
        });
        n.append(...hijos.filter(h => h != null));
        return n;
    };
    const boton = (txt, clase, onclick) => el("button", { type: "button", class: clase, onclick }, txt);

    /* ---------- Tarjetas ---------- */
    function tarjetaComparacion(e) {
        const sugerencias = Array.isArray(e.sugerencias) ? e.sugerencias : [];
        const detalle = el("details", { class: "hist-detalle" },
            el("summary", {}, "Ver feedback y sugerencias"),
            e.feedback ? el("p", { class: "hist-feedback" }, e.feedback) : null,
            sugerencias.length
                ? el("ol", { class: "hist-tips" }, ...sugerencias.map(s => el("li", {}, s)))
                : el("p", { class: "hist-feedback" }, "No se generaron sugerencias en este análisis.")
        );
        return el("li", { class: "hist-item" },
            el("div", { class: "ring", style: `--p:${Number(e.puntaje) || 0}` }, el("b", {}, (Number(e.puntaje) || 0) + "%")),
            el("div", { class: "hist-info" },
                el("span", { class: "hist-tipo" }, "Comparación"),
                el("h2", {}, e.cv || "Tu CV", el("span", { class: "hist-vs" }, " vs "), e.oferta || "Oferta"),
                el("time", { datetime: new Date(e.creado).toISOString() }, fecha.format(e.creado)),
                detalle
            ),
            el("div", { class: "hist-acciones" }, boton("Eliminar", "link", () => borrar(e.id)))
        );
    }

    function tarjetaCv(e) {
        const sub = [e.titulo, e.plantillaNombre && "Plantilla " + e.plantillaNombre].filter(Boolean).join(" · ");
        return el("li", { class: "hist-item" },
            el("div", { class: "hist-icono", "aria-hidden": "true" }, "CV"),
            el("div", { class: "hist-info" },
                el("span", { class: "hist-tipo" }, "CV creado"),
                el("h2", {}, e.nombre || "CV sin nombre"),
                sub ? el("p", { class: "hist-sub" }, sub) : null,
                el("time", { datetime: new Date(e.actualizado || e.creado).toISOString() },
                    "Editado " + fecha.format(e.actualizado || e.creado))
            ),
            el("div", { class: "hist-acciones" },
                boton("Ver", "cta cta-ghost hist-btn", () => verCv(e)),
                boton("Abrir para editar", "cta cta-primary hist-btn", () => editarCv(e)),
                boton("Eliminar", "link", () => borrar(e.id))
            )
        );
    }

    function pintar() {
        const todo = historial.listar();
        const visibles = todo.filter(e => filtro === "todo" || e.tipo === filtro);
        lista.replaceChildren(...visibles.map(e => e.tipo === "cv" ? tarjetaCv(e) : tarjetaComparacion(e)));
        vacio.hidden = visibles.length > 0;
        btnVaciar.hidden = todo.length === 0;
        vacioTxt.textContent = todo.length
            ? "No hay elementos de este tipo todavía."
            : "Todavía no hay nada acá. Tus comparaciones y CVs aparecen apenas los hagas.";
    }

    /* ---------- Acciones ---------- */
    function borrar(id) {
        historial.eliminar(id);
        pintar();
        toast.info("Eliminado del historial");
    }

    function editarCv(e) {
        if (!e.borrador) return toast.error("No se pudo abrir", "Esa entrada no tiene datos guardados.");
        try {
            const actual = JSON.parse(localStorage.getItem(BORRADOR) || "null");
            const hayOtro = actual && actual.historialId !== e.id &&
                actual.personal && (actual.personal.nombre || "").trim();
            if (hayOtro && !confirm("Esto reemplaza el CV que tenés en el asistente ahora. ¿Continuar?")) return;
            localStorage.setItem(BORRADOR, JSON.stringify(e.borrador));
        } catch (_) {
            return toast.error("No se pudo abrir", "El navegador bloqueó el almacenamiento.");
        }
        location.href = raiz.dataset.crearUrl;
    }

    function escalar() {
        const w = hoja.clientWidth;
        if (!w) return;
        const k = w / ANCHO_A4;
        let alto = 1123;
        try { alto = Math.max(1123, frame.contentDocument.documentElement.scrollHeight); } catch (_) { }
        frame.style.height = alto + "px";
        frame.style.transform = `scale(${k})`;
        hoja.style.height = alto * k + "px";
    }

    async function verCv(e) {
        if (!e.payload) return toast.error("No se pudo mostrar", "Esa entrada no tiene datos guardados.");
        try {
            const r = await fetch(raiz.dataset.renderUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(e.payload)
            });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const html = await r.text();
            modalTitulo.textContent = e.nombre || "Vista previa";
            frame.onload = escalar;
            frame.srcdoc = html;
            modal.showModal();
            requestAnimationFrame(escalar);
        } catch (err) {
            console.error("[Historial]", err);
            toast.error("No pudimos mostrar el CV", "Probá de nuevo en unos segundos.");
        }
    }

    /* ---------- Eventos ---------- */
    filtros.forEach(b => b.addEventListener("click", () => {
        filtro = b.dataset.filtro;
        filtros.forEach(x => x.setAttribute("aria-pressed", String(x === b)));
        pintar();
    }));

    btnVaciar.addEventListener("click", () => {
        if (!confirm("Se borrará todo el historial. ¿Continuar?")) return;
        historial.vaciar();
        pintar();
    });

    document.getElementById("hist-modal-cerrar").addEventListener("click", () => modal.close());
    modal.addEventListener("click", ev => { if (ev.target === modal) modal.close(); }); // clic en el fondo
    window.addEventListener("resize", () => { if (modal.open) escalar(); });

    pintar();
});