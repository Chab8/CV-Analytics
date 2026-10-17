document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "cvAnalytics.cvDraft";
    const PREF_VISTA = "cvAnalytics.vistaPrevia";
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
    const ULTIMO = pasos.length - 1;
    const LISTAS = ["experiencia", "educacion", "idiomas", "extras", "entradas"];

    // Vista previa en vivo (panel derecho)
    const wizardBody = document.getElementById("wizard-body");
    const vista = document.getElementById("vista");
    const vistaScroll = document.getElementById("vista-scroll");
    const vistaWrap = document.getElementById("vista-wrap");
    const vistaFrame = document.getElementById("vista-frame");
    const vistaVacio = document.getElementById("vista-vacio");
    const vistaEstado = document.getElementById("vista-estado");
    const vistaToggle = document.getElementById("vista-toggle");
    const angosto = matchMedia("(max-width: 1100px)");
    let vistaAbierta = (() => {
        try { const v = localStorage.getItem(PREF_VISTA); if (v !== null) return v === "1"; } catch (_) { }
        return !angosto.matches; // en pantallas angostas arranca cerrada
    })();
    let timerVista = 0, ticketVista = 0, fallaAvisada = false;

    /* ---------------- Estado ---------------- */
    const vacio = () => ({
        plantilla: radios[0] ? radios[0].value : null,
        paso: 0, max: 0,
        personal: { nombre: "", titulo: "", email: "", telefono: "", ubicacion: "", linkedin: "", web: "", resumen: "" },
        extra: { nombre: "" },
        experiencia: [], educacion: [], habilidades: [], idiomas: [], extras: [], entradas: []
    });

    function cargar() {
        const base = vacio();
        try {
            const g = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
            if (g && typeof g === "object") {
                Object.assign(base, g);
                base.personal = Object.assign(vacio().personal, g.personal);
                base.extra = Object.assign(vacio().extra, g.extra);
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
        programarVista();
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

        nodo.querySelectorAll(".fecha-mmaaaa").forEach(aplicarAutoSlash);

        const btnEnCurso = nodo.querySelector(".btn-en-curso");
        if (btnEnCurso) {
            const hastaInput = nodo.querySelector('[data-field="hasta"]');
            if (valores.actual === true || (hastaInput && hastaInput.value.trim().toLowerCase() === "en curso")) {
                if (hastaInput) { hastaInput.value = "En curso"; hastaInput.disabled = true; }
                btnEnCurso.classList.add("activo");
            }
            btnEnCurso.addEventListener("click", () => {
                if (!hastaInput) return;
                if (hastaInput.disabled) {
                    hastaInput.disabled = false;
                    hastaInput.value = "";
                    btnEnCurso.classList.remove("activo");
                } else {
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
        if (estado.habilidades.length >= 40) {
            toast.info("Llegaste al máximo", "Podés cargar hasta 40 habilidades.");
            return;
        }
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

    /* ---------------- Escalado de miniaturas y vistas previas ---------------- */
    function escalarMiniaturas() {
        form.querySelectorAll(".miniatura").forEach(m => {
            const f = m.querySelector("iframe");
            if (m.clientWidth) f.style.transform = `scale(${m.clientWidth / ANCHO_A4})`;
        });
    }

    function ajustar(wrap, fr) {
        const w = wrap.clientWidth;
        if (!w) return;
        const escala = w / ANCHO_A4;
        let alto = 1123;
        try { alto = Math.max(1123, fr.contentDocument.documentElement.scrollHeight); } catch (_) { }
        fr.style.height = alto + "px";
        fr.style.transform = `scale(${escala})`;
        wrap.style.height = (alto * escala) + "px";
    }

    const ajustarPreview = () => ajustar(previewWrap, frame);

    /* ---------------- Construir payload limpio para el render ---------------- */
    function normalizarEnCurso(lista) {
        return (lista || []).map(e => {
            const copia = { ...e };
            if ((copia.hasta || "").trim().toLowerCase() === "en curso") {
                copia.actual = true;
                copia.hasta = "";
            }
            return copia;
        });
    }

    function construirPayload() {
        return {
            plantilla: estado.plantilla,
            datos: {
                ...estado,
                experiencia: normalizarEnCurso(estado.experiencia),
                educacion: normalizarEnCurso(estado.educacion),
                seccion_extra: { nombre: estado.extra.nombre, entradas: estado.entradas }
            }
        };
    }

    const cabeceras = { "Content-Type": "application/json" };

    let ticket = 0;
    async function generarVistaPrevia() {
        const mio = ++ticket;
        volcarTagPendiente();

        const renderUrl = form.dataset.renderUrl;
        if (!renderUrl) {
            toast.error("Error de configuración", "No encontramos la URL para generar el CV.");
            return;
        }

        try {
            const r = await fetch(renderUrl, {
                method: "POST",
                headers: cabeceras,
                body: JSON.stringify(construirPayload())
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
                toast.error("No pudimos generar la vista previa", "Probá de nuevo en unos segundos.");
            }
        }
    }

    /* ---------------- Vista previa en vivo ---------------- */
    function hayDatos() {
        const conTexto = o => Object.values(o).some(v => typeof v === "string" && v.trim());
        return conTexto(estado.personal) || conTexto(estado.extra) || estado.habilidades.length > 0
            || LISTAS.some(k => estado[k].some(conTexto));
    }

    async function actualizarVista() {
        if (!vistaAbierta || estado.paso === ULTIMO) return;
        const mio = ++ticketVista;
        const conDatos = hayDatos();
        vistaVacio.hidden = conDatos;
        vistaWrap.hidden = !conDatos;
        if (!conDatos) { vistaEstado.textContent = ""; return; }

        try {
            const r = await fetch(form.dataset.renderUrl, {
                method: "POST",
                headers: cabeceras,
                body: JSON.stringify(construirPayload())
            });
            if (!r.ok) throw new Error("HTTP " + r.status);
            const html = await r.text();
            if (mio !== ticketVista) return;
            const d = vistaFrame.contentDocument;
            d.open(); d.write(html); d.close(); // sin recargar el iframe: no parpadea
            ajustar(vistaWrap, vistaFrame);
            requestAnimationFrame(() => ajustar(vistaWrap, vistaFrame));
            vistaEstado.textContent = "Actualizado";
            fallaAvisada = false;
        } catch (err) {
            console.error("[CV Vista previa]", err);
            if (mio !== ticketVista) return;
            vistaEstado.textContent = "No se pudo actualizar";
            if (!fallaAvisada) {
                fallaAvisada = true;
                toast.error("No pudimos actualizar la vista previa", "Tus datos están a salvo. Seguí completando.");
            }
        }
    }

    function programarVista() {
        if (!vistaAbierta || estado.paso === ULTIMO) return;
        vistaEstado.textContent = "Actualizando…";
        clearTimeout(timerVista);
        timerVista = setTimeout(actualizarVista, 350);
    }

    function aplicarVista() {
        const visible = vistaAbierta && estado.paso !== ULTIMO;
        wizardBody.classList.toggle("sin-vista", !visible);
        vista.inert = !visible;
        vistaToggle.hidden = estado.paso === ULTIMO;
        vistaToggle.setAttribute("aria-pressed", String(vistaAbierta));
        if (visible) actualizarVista();
    }

    function fijarVista(abierta) {
        vistaAbierta = abierta;
        try { localStorage.setItem(PREF_VISTA, abierta ? "1" : "0"); } catch (_) { }
        aplicarVista();
    }

    vistaToggle.addEventListener("click", () => fijarVista(!vistaAbierta));
    document.getElementById("vista-ocultar").addEventListener("click", () => fijarVista(false));
    new ResizeObserver(() => ajustar(vistaWrap, vistaFrame)).observe(vistaScroll);

    frame.addEventListener("load", () => {
        ajustarPreview();
        previewWrap.classList.remove("listo");
        void previewWrap.offsetWidth;
        previewWrap.classList.add("listo");
    });
    window.addEventListener("resize", () => { escalarMiniaturas(); ajustarPreview(); });

    /* ---------------- Descarga en varios formatos ---------------- */
    const btnDescargar = document.getElementById("btn-descargar");
    const txtDescargar = document.getElementById("descarga-txt");
    const menu = document.getElementById("menu-descarga");
    const ETIQUETA = { pdf: "PDF", docx: "Word", txt: "texto", jpg: "JPG", png: "PNG" };
    const opciones = () => [...menu.querySelectorAll("[role=menuitem]")];

    function abrirMenu(abrir) {
        menu.hidden = !abrir;
        btnDescargar.setAttribute("aria-expanded", String(abrir));
        if (abrir) opciones()[0].focus();
    }

    btnDescargar.addEventListener("click", () => abrirMenu(menu.hidden));
    document.addEventListener("click", e => {
        if (!menu.hidden && !e.target.closest("#descarga")) abrirMenu(false);
    });
    menu.addEventListener("keydown", e => {
        const lista = opciones();
        const i = lista.indexOf(document.activeElement);
        if (e.key === "Escape") { abrirMenu(false); btnDescargar.focus(); }
        else if (e.key === "ArrowDown") { e.preventDefault(); lista[(i + 1) % lista.length].focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); lista[(i - 1 + lista.length) % lista.length].focus(); }
    });
    menu.addEventListener("click", e => {
        const b = e.target.closest("[data-formato]");
        if (!b) return;
        abrirMenu(false);
        descargar(b.dataset.formato);
    });

    function nombreBase() {
        const n = (estado.personal.nombre || "").replace(/[\\/:*?"<>|]+/g, "").trim();
        return `${n ? n + " " : ""}CV Analytics`;
    }

    function nombreArchivo(ext) {
        return `${nombreBase()}.${ext}`;
    }

    function guardarBlob(blob, ext) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = nombreArchivo(ext);
        document.body.append(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
    }

    // html2canvas solo se descarga si el usuario pide una imagen
    let cargandoH2c = null;
    function cargarHtml2canvas() {
        if (window.html2canvas) return Promise.resolve(window.html2canvas);
        cargandoH2c ||= new Promise((ok, mal) => {
            const s = document.createElement("script");
            s.src = "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js";
            s.onload = () => ok(window.html2canvas);
            s.onerror = () => { cargandoH2c = null; mal(new Error("No pudimos cargar el generador de imágenes. Revisá tu conexión.")); };
            document.head.append(s);
        });
        return cargandoH2c;
    }

    async function descargar(formato) {
        if (formato === "pdf") {
            // El navegador propone como nombre del PDF el título del documento
            const docFrame = frame.contentDocument;
            const tituloPagina = document.title;
            const tituloFrame = docFrame.title;
            const restaurar = () => { document.title = tituloPagina; docFrame.title = tituloFrame; };
            document.title = docFrame.title = nombreBase();
            frame.contentWindow.addEventListener("afterprint", restaurar, { once: true });
            window.addEventListener("afterprint", restaurar, { once: true });

            frame.contentWindow.focus();
            frame.contentWindow.print();
            toast.info("Elegí «Guardar como PDF»", "En la ventana de impresión, cambiá el destino a PDF.");
            return;
        }

        btnDescargar.disabled = true;
        txtDescargar.textContent = "Generando…";
        try {
            if (formato === "docx" || formato === "txt") {
                const r = await fetch(form.dataset.exportUrl.replace("__", formato), {
                    method: "POST",
                    headers: cabeceras,
                    body: JSON.stringify(construirPayload())
                });
                if (!r.ok) {
                    let msg = "No pudimos generar el archivo.";
                    try { msg = (await r.json()).error || msg; } catch (_) { }
                    throw new Error(msg);
                }
                guardarBlob(await r.blob(), formato);
            } else {
                const h2c = await cargarHtml2canvas();
                const hoja = frame.contentDocument.querySelector(".hoja");
                if (!hoja) throw new Error("Todavía no se generó la vista de tu CV.");
                const canvas = await h2c(hoja, { scale: 2, backgroundColor: "#ffffff", useCORS: true });
                const mime = formato === "jpg" ? "image/jpeg" : "image/png";
                const blob = await new Promise(ok => canvas.toBlob(ok, mime, 0.92));
                if (!blob) throw new Error("El navegador no pudo crear la imagen.");
                guardarBlob(blob, formato);
            }
            toast.ok("CV descargado", `Se guardó como ${ETIQUETA[formato]}.`);
        } catch (err) {
            console.error("[CV Descarga]", err);
            toast.error("No pudimos descargar tu CV", err.message || "Probá de nuevo en unos segundos.");
        } finally {
            btnDescargar.disabled = false;
            txtDescargar.textContent = "Descargar CV";
        }
    }

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
        if (PASOS_CON_FECHAS[n]) {
            const [lista, tipo] = PASOS_CON_FECHAS[n];
            let primero = null, msg = "";
            contenedor(lista).querySelectorAll(".item").forEach(item => {
                const r = revisarItem(item, tipo);
                mostrarErrorFecha(item, r && r.msg);
                if (r && !primero) { primero = item.querySelector(`[data-field="${r.campo}"]`); msg = r.msg; }
            });
            if (primero) { primero.focus(); toast.error("Revisá las fechas", msg); }
            return !primero;
        }
        if (n !== 1) return true;
        const nombre = form.querySelector('[data-path="personal.nombre"]');
        const email = form.querySelector('[data-path="personal.email"]');
        let msg = "", campo = null;
        if (!nombre.value.trim()) { msg = "Ingresá tu nombre completo."; campo = nombre; }
        else if (!email.value.trim() || !email.checkValidity()) { msg = "Ingresá un email válido."; campo = email; }
        if (campo) { campo.focus(); toast.error("Faltan datos obligatorios", msg); }
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
        aplicarVista();
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