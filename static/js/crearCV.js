document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "cvAnalytics.cvDraft";
    const ANCHO_A4 = 794; // px a 96dpi
    const form = document.getElementById("cv-form");
    const pasos = [...form.querySelectorAll(".paso")];
    const stepper = document.getElementById("stepper");
    const barraFill = document.getElementById("barra-fill");
    const btnAtras = document.getElementById("btn-atras");
    const btnSiguiente = document.getElementById("btn-siguiente");
    const selectPlantilla = document.getElementById("cambiar-plantilla");
    const radios = [...form.querySelectorAll('input[name="plantilla"]')];
    const frame = document.getElementById("cv-preview");
    const previewWrap = document.getElementById("preview-wrap");
    const previewError = document.getElementById("preview-error");
    const ULTIMO = pasos.length - 1;
    const LISTAS = ["experiencia", "educacion", "idiomas", "extras"];

    /* ---------------- Estado ---------------- */
    const vacio = () => ({
        plantilla: radios[0] ? radios[0].value : null,
        paso: 0,
        personal: { nombre: "", titulo: "", email: "", telefono: "", ubicacion: "", linkedin: "", web: "", resumen: "" },
        experiencia: [], educacion: [], habilidades: [], idiomas: [], extras: []
    });

    function cargar() {
        const base = vacio();
        try {
            const g = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (g && typeof g === "object") {
                Object.assign(base, g);
                base.personal = Object.assign(vacio().personal, g.personal);
                LISTAS.forEach(k => { if (!Array.isArray(base[k])) base[k] = []; });
                if (!Array.isArray(base.habilidades)) base.habilidades = [];
            }
        } catch (_) { /* borrador corrupto o storage bloqueado: arrancamos de cero */ }
        if (!radios.some(r => r.value === base.plantilla)) base.plantilla = vacio().plantilla;
        base.paso = Math.max(0, Math.min(Number(base.paso) || 0, ULTIMO));
        return base;
    }

    const estado = cargar();

    function guardar() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(estado)); } catch (_) { /* sin storage: seguimos igual */ }
    }

    /* ---------------- Campos simples (data-path) ---------------- */
    form.querySelectorAll("[data-path]").forEach(el => {
        const [seccion, campo] = el.dataset.path.split(".");
        el.value = estado[seccion][campo] || "";
        el.addEventListener("input", () => { estado[seccion][campo] = el.value; guardar(); });
    });

    /* ---------------- Listas repetibles ---------------- */
    const contenedor = n => form.querySelector(`[data-list="${n}"]`);

    function sincronizarActual(nodo) {
        const chk = nodo.querySelector('[data-field="actual"]');
        const hasta = nodo.querySelector('[data-field="hasta"]');
        if (chk && hasta) {
            hasta.disabled = chk.checked;
            if (chk.checked) hasta.value = "";
        }
    }

    function leerItem(nodo) {
        const o = {};
        nodo.querySelectorAll("[data-field]").forEach(el => {
            o[el.dataset.field] = el.type === "checkbox" ? el.checked : el.value;
        });
        return o;
    }

    function sincronizarLista(nombre) {
        estado[nombre] = [...contenedor(nombre).querySelectorAll(".item")].map(leerItem);
        guardar();
    }

    function crearItem(nombre, valores = {}) {
        const nodo = document.getElementById("tpl-" + nombre).content.firstElementChild.cloneNode(true);
        nodo.querySelectorAll("[data-field]").forEach(el => {
            const v = valores[el.dataset.field];
            if (el.type === "checkbox") el.checked = !!v;
            else el.value = v == null ? "" : v;
        });
        sincronizarActual(nodo);
        return nodo;
    }

    LISTAS.forEach(nombre => {
        const cont = contenedor(nombre);
        const inicial = estado[nombre].length ? estado[nombre] : [{}];
        inicial.forEach(v => cont.append(crearItem(nombre, v)));

        const alCambiar = e => {
            const item = e.target.closest(".item");
            if (item) sincronizarActual(item);
            sincronizarLista(nombre);
        };
        cont.addEventListener("input", alCambiar);
        cont.addEventListener("change", alCambiar);
        cont.addEventListener("click", e => {
            if (!e.target.closest(".btn-quitar")) return;
            e.target.closest(".item").remove();
            if (!cont.querySelector(".item")) cont.append(crearItem(nombre)); // siempre queda uno vacío
            sincronizarLista(nombre);
        });
    });

    form.querySelectorAll("[data-add]").forEach(btn => {
        btn.addEventListener("click", () => {
            const nombre = btn.dataset.add;
            const nodo = crearItem(nombre);
            contenedor(nombre).append(nodo);
            sincronizarLista(nombre);
            const primero = nodo.querySelector("input, textarea");
            if (primero) primero.focus();
        });
    });

    /* ---------------- Habilidades (tags) ---------------- */
    const tagInput = document.getElementById("habilidad-input");
    const tagsBox = document.getElementById("tags");

    function renderTags() {
        tagsBox.replaceChildren(...estado.habilidades.map((h, i) => {
            const chip = document.createElement("span");
            chip.className = "tag";
            chip.textContent = h;
            const x = document.createElement("button");
            x.type = "button";
            x.textContent = "✕";
            x.setAttribute("aria-label", "Quitar " + h);
            x.addEventListener("click", () => { estado.habilidades.splice(i, 1); guardar(); renderTags(); });
            chip.append(x);
            return chip;
        }));
    }

    function agregarTag(texto) {
        texto = texto.trim().slice(0, 60);
        if (!texto) return;
        if (estado.habilidades.length >= 40) return;
        if (!estado.habilidades.some(h => h.toLowerCase() === texto.toLowerCase())) estado.habilidades.push(texto);
        guardar();
        renderTags();
    }

    function volcarTagPendiente() {
        agregarTag(tagInput.value);
        tagInput.value = "";
    }

    tagInput.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); volcarTagPendiente(); }
    });
    tagInput.addEventListener("input", () => {
        if (!tagInput.value.includes(",")) return;
        const partes = tagInput.value.split(",");
        tagInput.value = partes.pop();
        partes.forEach(agregarTag);
    });
    tagInput.addEventListener("blur", volcarTagPendiente);
    document.getElementById("habilidad-add").addEventListener("click", () => { volcarTagPendiente(); tagInput.focus(); });
    renderTags();

    /* ---------------- Plantilla ---------------- */
    function fijarPlantilla(id, regenerar) {
        estado.plantilla = id;
        radios.forEach(r => { r.checked = r.value === id; });
        selectPlantilla.value = id;
        guardar();
        if (regenerar) generarVistaPrevia();
    }
    radios.forEach(r => r.addEventListener("change", () => fijarPlantilla(r.value, false)));
    selectPlantilla.addEventListener("change", () => fijarPlantilla(selectPlantilla.value, true));
    fijarPlantilla(estado.plantilla, false);

    /* ---------------- Escalado de miniaturas y vista previa ---------------- */
    function escalarMiniaturas() {
        form.querySelectorAll(".miniatura").forEach(m => {
            const f = m.querySelector("iframe");
            if (m.clientWidth) f.style.transform = `scale(${m.clientWidth / ANCHO_A4})`;
        });
    }

    function ajustarPreview() {
        const w = previewWrap.clientWidth;
        if (!w) return;
        const escala = w / ANCHO_A4;
        let alto = 1123;
        try { alto = Math.max(1123, frame.contentDocument.documentElement.scrollHeight); } catch (_) { }
        frame.style.height = alto + "px";
        frame.style.transform = `scale(${escala})`;
        previewWrap.style.height = (alto * escala) + "px";
    }

    let ticket = 0;
    async function generarVistaPrevia() {
        const mio = ++ticket;
        volcarTagPendiente();
        previewError.textContent = "";
        try {
            const r = await fetch(form.dataset.renderUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ plantilla: estado.plantilla, datos: estado })
            });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const html = await r.text();
            if (mio !== ticket) return; // llegó una respuesta más nueva
            frame.srcdoc = html;
        } catch (_) {
            if (mio === ticket) previewError.textContent = "No pudimos generar la vista previa. Probá de nuevo en unos segundos.";
        }
    }
    frame.addEventListener("load", ajustarPreview);
    window.addEventListener("resize", () => { escalarMiniaturas(); ajustarPreview(); });

    document.getElementById("btn-imprimir").addEventListener("click", () => {
        frame.contentWindow.focus();
        frame.contentWindow.print();
    });

    document.getElementById("btn-reiniciar").addEventListener("click", () => {
        if (!confirm("Se borrarán todos los datos cargados. ¿Continuar?")) return;
        try { localStorage.removeItem(STORAGE_KEY); } catch (_) { }
        location.reload();
    });

    /* ---------------- Navegación ---------------- */
    pasos.forEach((p, i) => {
        const li = document.createElement("li");
        const b = document.createElement("button");
        b.type = "button";
        b.textContent = `${i + 1}. ${p.dataset.titulo}`;
        b.addEventListener("click", () => { if (i < estado.paso) irA(i); });
        li.append(b);
        stepper.append(li);
    });

    function validar(n) {
        const err = pasos[n].querySelector(".error-paso");
        if (n !== 1) return true;
        const nombre = form.querySelector('[data-path="personal.nombre"]');
        const email = form.querySelector('[data-path="personal.email"]');
        let msg = "";
        let campo = null;
        if (!nombre.value.trim()) { msg = "Ingresá tu nombre completo."; campo = nombre; }
        else if (!email.value.trim() || !email.checkValidity()) { msg = "Ingresá un email válido."; campo = email; }
        if (err) err.textContent = msg;
        if (campo) campo.focus();
        return !msg;
    }

    function irA(n) {
        estado.paso = Math.max(0, Math.min(n, ULTIMO));
        pasos.forEach((p, i) => { p.hidden = i !== estado.paso; });
        [...stepper.querySelectorAll("button")].forEach((b, i) => {
            b.classList.toggle("actual", i === estado.paso);
            b.classList.toggle("hecho", i < estado.paso);
            if (i === estado.paso) b.setAttribute("aria-current", "step"); else b.removeAttribute("aria-current");
        });
        barraFill.style.width = ((estado.paso + 1) / pasos.length * 100) + "%";
        btnAtras.style.visibility = estado.paso === 0 ? "hidden" : "visible";
        btnSiguiente.hidden = estado.paso === ULTIMO;
        btnSiguiente.textContent = estado.paso === ULTIMO - 1 ? "Ver mi CV ✓" : "Siguiente →";
        guardar();
        escalarMiniaturas();
        if (estado.paso === ULTIMO) generarVistaPrevia();
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    btnAtras.addEventListener("click", () => irA(estado.paso - 1));
    btnSiguiente.addEventListener("click", () => { if (validar(estado.paso)) irA(estado.paso + 1); });
    form.addEventListener("submit", e => e.preventDefault());
    form.addEventListener("keydown", e => {
        if (e.key === "Enter" && e.target.tagName === "INPUT" && e.target.type !== "checkbox" && e.target.id !== "habilidad-input") e.preventDefault();
    });

    // Un borrador guardado en el paso final solo es válido si los datos mínimos siguen estando
    if (estado.paso > 1 && (!estado.personal.nombre.trim() || !estado.personal.email.trim())) estado.paso = 1;
    irA(estado.paso);
    window.scrollTo(0, 0);
});