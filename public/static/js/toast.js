/* Toasts: toast.ok(titulo, detalle), toast.error(...), toast.info(...). Se pausan al pasar el mouse. */
(() => {
    const svg = d => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const ICONOS = {
        ok: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
        error: svg('<path d="M12 6.5v7M12 17.5h.01"/>'),
        info: svg('<path d="M12 11v6M12 7.5h.01"/>')
    };
    const MAX_VISIBLES = 4;
    let caja = null;
    let ultimo = { clave: "", t: 0 };

    function contenedor() {
        if (!caja) {
            caja = document.createElement("div");
            caja.className = "toasts";
            caja.setAttribute("role", "region");
            caja.setAttribute("aria-label", "Notificaciones");
            document.body.append(caja);
        }
        return caja;
    }

    function mostrar(tipo, titulo, detalle = "", ms) {
        const clave = tipo + titulo + detalle;
        if (clave === ultimo.clave && Date.now() - ultimo.t < 1200) return; // evita duplicados por doble click
        ultimo = { clave, t: Date.now() };
        ms = ms ?? (tipo === "error" ? 7000 : 4500);

        const el = document.createElement("div");
        el.className = `toast toast-${tipo}`;
        el.setAttribute("role", tipo === "error" ? "alert" : "status");
        el.style.setProperty("--dur", ms + "ms");

        const icono = document.createElement("span");
        icono.className = "toast-icon";
        icono.innerHTML = ICONOS[tipo];

        const texto = document.createElement("div");
        const t = document.createElement("strong");
        t.textContent = titulo;
        texto.append(t);
        if (detalle) {
            const p = document.createElement("p");
            p.textContent = detalle;
            texto.append(p);
        }

        const x = document.createElement("button");
        x.type = "button";
        x.className = "toast-x";
        x.setAttribute("aria-label", "Cerrar notificación");
        x.innerHTML = svg('<path d="M6 6l12 12M18 6L6 18"/>');

        el.append(icono, texto, x);

        let resta = ms, inicio = 0, timer = 0;
        const cerrar = () => {
            clearTimeout(timer);
            el.classList.add("sale");
            setTimeout(() => el.remove(), 240);
        };
        const armar = () => { inicio = Date.now(); timer = setTimeout(cerrar, resta); };
        el.addEventListener("mouseenter", () => { clearTimeout(timer); resta -= Date.now() - inicio; });
        el.addEventListener("mouseleave", armar);
        x.addEventListener("click", cerrar);

        const cont = contenedor();
        while (cont.children.length >= MAX_VISIBLES) cont.firstElementChild.remove();
        cont.append(el);
        armar();
    }

    window.toast = {
        ok: (t, d, ms) => mostrar("ok", t, d, ms),
        error: (t, d, ms) => mostrar("error", t, d, ms),
        info: (t, d, ms) => mostrar("info", t, d, ms)
    };
})();