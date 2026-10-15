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
        paso: 0, max: 0,
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
        base.max = Math.max(base.paso, Math.min(Number(base.max) || 0, ULTIMO));
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

    /* ---------------- Auto-formato de fecha MM/AAAA ---------------- */
    function aplicarAutoSlash(input) {
        input.addEventListener("keydown", e => {
            // Guardar si era borrar
            input._borrando = e.key === "Backspace" || e.key === "Delete";
        });
        input.addEventListener("input", () => {
            if (input._borrando) return; // no interferir al borrar
            let val = input.value.replace(/\D/g, ""); // solo números
            if (val.length >= 2) {
                val = val.slice(0, 2) + "/" + val.slice(2, 6);
            }
            input.value = val;
        });
    }

    // Aplicar a campos existentes (data-path) — no los hay con MM/AAAA en personal, pero por si se agregan
    form.querySelectorAll(".fecha-mmaaaa").forEach(aplicarAutoSlash);

    /* ---------------- Validación de rango de fechas ---------------- */
    const ANIO_MIN = 1950;

    function parsear(val, tipo) {
        val = (val || "").trim();
        if (!val || val.toLowerCase() === "en curso") return { fecha: null, error: "" };
        let mes = 0, anio;
        if (tipo === "mmaaaa") {
            const m = /^(\d{2})\/(\d{4})$/.exec(val);
            if (!m) return { fecha: null, error: "Usá el formato MM/AAAA (por ejemplo 03/2022)." };
            mes = +m[1]; anio = +m[2];
            if (mes < 1 || mes > 12) return { fecha: null, error: "El mes tiene que estar entre 01 y 12." };
        } else {
            if (!/^\d{4}$/.test(val)) return { fecha: null, error: "Ingresá el año con 4 cifras (por ejemplo 2022)." };
            anio = +val;
        }
        if (anio < ANIO_MIN) return { fecha: null, error: `El año no puede ser anterior a ${ANIO_MIN}.` };
        const hoy = new Date();
        const f = anio * 12 + Math.max(mes - 1, 0);
        if (f > hoy.getFullYear() * 12 + hoy.getMonth()) return { fecha: null, error: "Esa fecha todavía no ocurrió." };
        return { fecha: f, error: "" };
    }

    function revisarItem(nodo, tipo) {
        const valor = n => { const el = nodo.querySelector(`[data-field="${n}"]`); return el && !el.disabled ? el.value : ""; };
        const campos = nodo.querySelector('[data-field="anio"]') ? ["anio"] : ["desde", "hasta"];
        const res = {};
        for (const c of campos) {
            const r = parsear(valor(c), tipo);
            if (r.error) return { msg: r.error, campo: c };
            res[c] = r.fecha;
        }
        if (res.desde != null && res.hasta != null && res.desde > res.hasta)
            return { msg: "La fecha de inicio debe ser anterior a la de finalización.", campo: "desde" };
        return null;
    }

    function mostrarErrorFecha(nodo, msg) {
        let errEl = nodo.querySelector(".error-fecha");
        if (msg) {
            if (!errEl) {
                errEl = document.createElement("p");
                errEl.className = "error-fecha";
                const grid = nodo.querySelector(".grid-2");
                if (grid) grid.after(errEl);
            }
            errEl.textContent = "⚠ " + msg;
        } else if (errEl) errEl.remove();
    }

    /* ---------------- Listas repetibles ---------------- */
    const contenedor = n => form.querySelector(`[data-list="${n}"]`);

    function sincronizarActual(nodo) {
        const chk = nodo.querySelector('[data-field="actual"]');
        const hasta = nodo.querySelector('[data-field="hasta"]');
        if (chk && hasta) {
            hasta.disabled = chk.checked;
            if (chk.checked) hasta.value = "";
        }
        // Botón "En curso" para educacion
        const btnEnCurso = nodo.querySelector(".btn-en-curso");
        if (btnEnCurso && hasta) {
            const enCurso = hasta.value.trim().toLowerCase() === "en curso" || hasta.disabled;
            btnEnCurso.classList.toggle("activo", enCurso);
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

        // Auto-slash en campos MM/AAAA dentro del item
        nodo.querySelectorAll(".fecha-mmaaaa").forEach(aplicarAutoSlash);

        // Botón "En curso" para educacion
        const btnEnCurso = nodo.querySelector(".btn-en-curso");
        if (btnEnCurso) {
            const hastaInput = nodo.querySelector('[data-field="hasta"]');
            // Restaurar estado "En curso" si el valor guardado lo indica
            if (valores.actual === true || (hastaInput && hastaInput.value.trim().toLowerCase() === "en curso")) {
                if (hastaInput) { hastaInput.value = "En curso"; hastaInput.disabled = true; }
                btnEnCurso.classList.add("activo");
            }
            btnEnCurso.addEventListener("click", () => {
                if (!hastaInput) return;
                if (hastaInput.disabled) {
                    // Desactivar "En curso"
                    hastaInput.disabled = false;
                    hastaInput.value = "";
                    btnEnCurso.classList.remove("activo");
                } else {
                    // Activar "En curso"
                    hastaInput.value = "En curso";
                    hastaInput.disabled = true;
                    btnEnCurso.classList.add("activo");
                }
                sincronizarLista(nombre);
            });
        }

        return nodo;
    }

    LISTAS.forEach(nombre => {
        const cont = contenedor(nombre);
        const inicial = estado[nombre].length ? estado[nombre] : [{}];
        inicial.forEach(v => cont.append(crearItem(nombre, v)));

        const tipoFecha = (nombre === "experiencia") ? "mmaaaa" : "aaaa";

        const alCambiar = e => {
            const item = e.target.closest(".item");
            if (item) {
                sincronizarActual(item);
                const r = e.type === "change" ? revisarItem(item, tipoFecha) : null;
                mostrarErrorFecha(item, r && r.msg);
            }
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
            nodo.classList.add("nuevo");
            contenedor(nombre).append(nodo);
            sincronizarLista(nombre);
            const primero = nodo.querySelector("input, textarea");
            if (primero) primero.focus();
        });
    });

    /* ---------------- Habilidades (tags) ---------------- */
    const tagInput = document.getElementById("habilidad-input");
    const tagsBox = document.getElementById("tags");

    function renderTags(nuevo = -1) {
        tagsBox.replaceChildren(...estado.habilidades.map((h, i) => {
            const chip = document.createElement("span");
            chip.className = "tag" + (i === nuevo ? " nuevo" : "");
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
        const yaEsta = estado.habilidades.some(h => h.toLowerCase() === texto.toLowerCase());
        if (!yaEsta) estado.habilidades.push(texto);
        guardar();
        renderTags(yaEsta ? -1 : estado.habilidades.length - 1);
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

    /* ---------------- Construir payload limpio para el render ---------------- */
    function construirPayload() {
        // Clonar datos asegurando que "En curso" en educación se convierta a actual=true
        const educacionLimpia = (estado.educacion || []).map(e => {
            const copia = { ...e };
            if (copia.hasta && copia.hasta.trim().toLowerCase() === "en curso") {
                copia.actual = true;
                copia.hasta = "";
            }
            return copia;
        });

        return {
            plantilla: estado.plantilla,
            datos: {
                ...estado,
                educacion: educacionLimpia
            }
        };
    }

    let ticket = 0;
    async function generarVistaPrevia() {
        const mio = ++ticket;
        volcarTagPendiente();
        previewError.textContent = "";
        previewError.style.display = "none";

        const renderUrl = form.dataset.renderUrl;
        if (!renderUrl) {
            previewError.textContent = "Error de configuración: URL de render no encontrada.";
            previewError.style.display = "block";
            return;
        }

        try {
            const payload = construirPayload();
            const r = await fetch(renderUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            if (!r.ok) {
                const texto = await r.text().catch(() => "");
                throw new Error(`HTTP ${r.status}: ${texto.slice(0, 200)}`);
            }
            const html = await r.text();
            if (mio !== ticket) return; // llegó una respuesta más nueva
            frame.srcdoc = html;
        } catch (err) {
            console.error("[CV Preview]", err);
            if (mio === ticket) {
                previewError.textContent = "No pudimos generar la vista previa. Probá de nuevo en unos segundos.";
                previewError.style.display = "block";
            }
        }
    }
    frame.addEventListener("load", () => {
        ajustarPreview();
        previewWrap.classList.remove("listo");
        void previewWrap.offsetWidth;
        previewWrap.classList.add("listo");
    });
    window.addEventListener("resize", () => { escalarMiniaturas(); ajustarPreview(); });

    document.getElementById("btn-descargar").addEventListener("click", () => {
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
        b.addEventListener("click", () => {
            if (i > estado.max || i === estado.paso) return;
            if (i > estado.paso && !validar(estado.paso)) return;
            irA(i);
        });
        li.append(b);
        stepper.append(li);
    });

    const PASOS_CON_FECHAS = { 2: ["experiencia", "mmaaaa"], 3: ["educacion", "aaaa"], 5: ["extras", "aaaa"] };

    function validar(n) {
        const err = pasos[n].querySelector(".error-paso");
        if (PASOS_CON_FECHAS[n]) {
            const [lista, tipo] = PASOS_CON_FECHAS[n];
            let primero = null;
            contenedor(lista).querySelectorAll(".item").forEach(item => {
                const r = revisarItem(item, tipo);
                mostrarErrorFecha(item, r && r.msg);
                if (r && !primero) primero = item.querySelector(`[data-field="${r.campo}"]`);
            });
            if (primero) primero.focus();
            return !primero;
        }
        if (n !== 1) return true;
        const nombre = form.querySelector('[data-path="personal.nombre"]');
        const email = form.querySelector('[data-path="personal.email"]');
        let msg = "", campo = null;
        if (!nombre.value.trim()) { msg = "Ingresá tu nombre completo."; campo = nombre; }
        else if (!email.value.trim() || !email.checkValidity()) { msg = "Ingresá un email válido."; campo = email; }
        if (err) err.textContent = msg;
        if (campo) campo.focus();
        return !msg;
    }

    function irA(n) {
        const antes = estado.paso;
        estado.paso = Math.max(0, Math.min(n, ULTIMO));
        estado.max = Math.max(estado.max || 0, estado.paso);
        form.querySelector(".cuerpo").scrollTop = 0;
        pasos.forEach((p, i) => { p.hidden = i !== estado.paso; });
        const nuevo = pasos[estado.paso];
        nuevo.classList.remove("desde-der", "desde-izq");
        if (estado.paso !== antes) {
            void nuevo.offsetWidth;
            nuevo.classList.add(estado.paso > antes ? "desde-der" : "desde-izq");
        }
        [...stepper.querySelectorAll("button")].forEach((b, i) => {
            b.classList.toggle("actual", i === estado.paso);
            b.classList.toggle("hecho", i <= estado.max && i !== estado.paso);
            b.disabled = i > estado.max;
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