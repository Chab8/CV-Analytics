/* Historial de la sesión (sin base de datos): se guarda en el navegador.
   Para que se borre al cerrar la pestaña, cambiar localStorage por sessionStorage. */
(() => {
    const CLAVE = "cvAnalytics.historial";
    const MAX = 30;
    const almacen = () => window.localStorage;

    function leer() {
        try {
            const l = JSON.parse(almacen().getItem(CLAVE) || "[]");
            return Array.isArray(l) ? l : [];
        } catch (_) { return []; }
    }

    function escribir(lista) {
        try { almacen().setItem(CLAVE, JSON.stringify(lista)); return true; }
        catch (_) { return false; }
    }

    const nuevoId = () =>
        (window.crypto && crypto.randomUUID)
            ? crypto.randomUUID()
            : Date.now().toString(36) + Math.random().toString(36).slice(2);

    // Crea la entrada o, si ya existe ese id, la actualiza y la sube al tope.
    function guardar(entrada) {
        const lista = leer();
        const i = lista.findIndex(e => e.id === entrada.id);
        const previa = i >= 0 ? lista.splice(i, 1)[0] : null;
        const nueva = { ...entrada, creado: previa ? previa.creado : Date.now(), actualizado: Date.now() };
        lista.unshift(nueva);
        const recortada = lista.slice(0, MAX);
        while (!escribir(recortada) && recortada.length > 1) recortada.pop(); // storage lleno: soltar las más viejas
        return nueva;
    }

    function eliminar(id) { escribir(leer().filter(e => e.id !== id)); }
    function vaciar() { escribir([]); }

    window.historial = { listar: leer, guardar, eliminar, vaciar, nuevoId };
})();