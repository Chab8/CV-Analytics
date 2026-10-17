from flask import Blueprint, render_template, request, abort, jsonify, send_file
import io
import re
from plantillas_cv import PLANTILLAS, DATOS_MUESTRA, obtener_plantilla
from exportar_cv import generar_docx, generar_txt

crear_cv_bp = Blueprint("crear_cv", __name__, url_prefix="/crear")

# ---------- Límites (evitan payloads absurdos) ----------
MAX_ITEMS = 20
MAX_HABILIDADES = 40

CAMPOS_PERSONAL = {
    "nombre": 120, "titulo": 120, "email": 120, "telefono": 40,
    "ubicacion": 120, "linkedin": 200, "web": 200, "resumen": 1500,
}
CAMPOS_EXPERIENCIA = {"puesto": 120, "empresa": 120, "desde": 30, "hasta": 30, "descripcion": 1500}
CAMPOS_EDUCACION = {"titulo": 150, "institucion": 150, "desde": 30, "hasta": 30, "descripcion": 800}
CAMPOS_IDIOMAS = {"idioma": 60, "nivel": 40}
CAMPOS_EXTRAS = {"titulo": 150, "institucion": 150, "anio": 10}
CAMPOS_ENTRADAS = {"titulo": 150, "fecha": 40, "descripcion": 800}

FORMATOS_EXPORTABLES = {
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "txt": "text/plain; charset=utf-8",
}


def _txt(valor, limite):
    return valor.strip()[:limite] if isinstance(valor, str) else ""


def _fila(item, campos):
    return {campo: _txt(item.get(campo), limite) for campo, limite in campos.items()}

def _clave_fecha(texto):
    """'03/2022' -> (2022, 3); '2022' -> (2022, 0); vacío -> (0, 0)."""
    m = re.search(r"(?:(\d{1,2})/)?(\d{4})", texto or "")
    return (int(m.group(2)), int(m.group(1) or 0)) if m else (0, 0)


def _orden_reciente(fila):
    if fila.get("actual"):
        fin = (9999, 12)
    else:
        fin = _clave_fecha(fila.get("hasta") or fila.get("desde"))
    return (fin, _clave_fecha(fila.get("desde")))


def _lista(valor, campos, con_actual=False, por_anio=False):
    """Limpia una lista de dicts; descarta filas vacías y ordena de más reciente a más vieja."""
    filas = []
    if not isinstance(valor, list):
        return filas
    for item in valor[:MAX_ITEMS]:
        if not isinstance(item, dict):
            continue
        fila = _fila(item, campos)
        if not any(fila.values()):
            continue
        if con_actual:
            fila["actual"] = bool(item.get("actual"))
            if fila["actual"]:
                fila["hasta"] = ""
        filas.append(fila)
    if con_actual:
        filas.sort(key=_orden_reciente, reverse=True)
    elif por_anio:
        filas.sort(key=lambda f: _clave_fecha(f.get("anio")), reverse=True)
    return filas


def limpiar_datos(raw):
    """Normaliza lo que manda el navegador. Nunca confiamos en el JSON de entrada."""
    raw = raw if isinstance(raw, dict) else {}
    personal_raw = raw.get("personal") if isinstance(raw.get("personal"), dict) else {}
    extra_raw = raw.get("seccion_extra") if isinstance(raw.get("seccion_extra"), dict) else {}

    habilidades = []
    if isinstance(raw.get("habilidades"), list):
        for h in raw["habilidades"][:MAX_HABILIDADES]:
            h = _txt(h, 60)
            if h:
                habilidades.append(h)

    return {
        "personal": _fila(personal_raw, CAMPOS_PERSONAL),
        "experiencia": _lista(raw.get("experiencia"), CAMPOS_EXPERIENCIA, con_actual=True),
        "educacion": _lista(raw.get("educacion"), CAMPOS_EDUCACION, con_actual=True),
        "habilidades": habilidades,
        "idiomas": _lista(raw.get("idiomas"), CAMPOS_IDIOMAS),
        "extras": _lista(raw.get("extras"), CAMPOS_EXTRAS, por_anio=True),
        # Sección libre del usuario. Se llama "entradas" (y no "items") para no chocar con dict.items en Jinja.
        "seccion_extra": {
            "nombre": _txt(extra_raw.get("nombre"), 80),
            "entradas": _lista(extra_raw.get("entradas"), CAMPOS_ENTRADAS),
        },
    }


# ---------- Rutas ----------

@crear_cv_bp.route("/")
def wizard():
    """Asistente paso a paso para crear el CV."""
    return render_template("crear_cv.html", plantillas=PLANTILLAS)


@crear_cv_bp.route("/render", methods=["POST"])
def renderizar():
    """Recibe {plantilla, datos} en JSON y devuelve el CV como HTML listo para mostrar/imprimir."""
    payload = request.get_json(silent=True) or {}
    plantilla = obtener_plantilla(payload.get("plantilla"))
    if plantilla is None:
        abort(400, "Plantilla inexistente")
    return render_template(plantilla["archivo"], cv=limpiar_datos(payload.get("datos", payload)))


@crear_cv_bp.route("/exportar/<formato>", methods=["POST"])
def exportar(formato):
    """Genera el CV en .docx o .txt a partir de los datos del asistente."""
    download_name=f"{limpio} CV Analytics.{formato}",
    if formato not in FORMATOS_EXPORTABLES:
        return jsonify(error="Ese formato no está disponible."), 400
    payload = request.get_json(silent=True) or {}
    cv = limpiar_datos(payload.get("datos", payload))
    nombre = cv["personal"]["nombre"]
    if not nombre:
        return jsonify(error="Falta tu nombre para generar el archivo."), 400

    contenido = generar_docx(cv) if formato == "docx" else generar_txt(cv)
    limpio = re.sub(r'[\\/:*?"<>|]+', "", nombre).strip()
    return send_file(
        io.BytesIO(contenido),
        mimetype=FORMATOS_EXPORTABLES[formato],
        as_attachment=True,
        download_name=f"CV - {limpio}.{formato}",
    )


@crear_cv_bp.route("/muestra/<plantilla_id>")
def muestra(plantilla_id):
    """Plantilla con datos de ejemplo (miniaturas del selector)."""
    plantilla = obtener_plantilla(plantilla_id)
    if plantilla is None:
        abort(404)
    return render_template(plantilla["archivo"], cv=DATOS_MUESTRA)