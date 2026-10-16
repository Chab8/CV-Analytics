from flask import Flask, request, jsonify, render_template
import os
import uuid
import LectorDeTextos
from ComparadorDeTexto import comparar_textos
import google.generativeai as genai
from dotenv import load_dotenv
from crear_cv import crear_cv_bp

# Cargar variables del archivo .env en local
load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx', 'txt'}
MAX_TEXTO_OFERTA = 20000
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")

if API_KEY:
    genai.configure(api_key=API_KEY)
else:
    print("⚠️ No se encontró ninguna API Key para Gemini.")

try:
    if not API_KEY:
        print("ADVERTENCIA: No se ha configurado una clave de API de Gemini en el entorno.")
    else:
        genai.configure(api_key=API_KEY)
except Exception as e:
    print(f"Error fatal al configurar la API de Gemini: {e}")
    API_KEY = None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def leer_texto(ruta):
    """Lee un .txt probando codificaciones comunes; el resto de formatos los resuelve LectorDeTextos."""
    if ruta.lower().endswith(".txt"):
        with open(ruta, "rb") as f:
            crudo = f.read()
        for codificacion in ("utf-8-sig", "cp1252"):
            try:
                return crudo.decode(codificacion)
            except UnicodeDecodeError:
                pass
        return crudo.decode("latin-1", errors="ignore")
    return LectorDeTextos.extraer_texto_archivo(ruta)

def guardar_temporal(archivo, rutas):
    """Guarda con nombre único (dos usuarios con el mismo nombre de archivo ya no se pisan)."""
    extension = os.path.splitext(archivo.filename)[1].lower()
    ruta = os.path.join(app.config['UPLOAD_FOLDER'], f"{uuid.uuid4().hex}{extension}")
    archivo.save(ruta)
    rutas.append(ruta)
    return ruta

def error_json(mensaje, codigo=400):
    return jsonify({'error': mensaje}), codigo

def generar_sugerencias_con_gemini(texto_cv, texto_req):
    """
    Usa la API de Gemini para generar sugerencias de mejora para el CV con un prompt detallado.
    """
    if not API_KEY:
        return "⚠️ Error de Configuración\nNo se pueden generar sugerencias porque la clave de API de Gemini no ha sido configurada correctamente en el archivo `MiniBaseDatos.py`."

    prompt = f"""
Rol: Eres un asistente experto en Recursos Humanos y coach de carrera profesional.
Tu tono debe ser profesional, alentador y constructivo.

Objetivo principal:
Analizar el CV del candidato en comparación con los requisitos del puesto
y generar un informe con sugerencias específicas y accionables de mejora.

---

Documentos para analizar:
CV DEL CANDIDATO:
{texto_cv}

---

REQUISITOS DEL PUESTO:
{texto_req}

---

Formato de salida OBLIGATORIO:
- El resultado debe ser texto plano, sin Markdown, sin guiones ni viñetas.
- Escribe una lista NUMERADA del 1 al 5.
- Cada sugerencia debe estar separada por dos saltos de línea (dos veces Enter) (ESTO ES OBLIGATORIO PARA QUE SE VEA MÁS PROLIJO Y ESPACIADO PARA MEJOR VISIBILIDAD).
- Cada sugerencia debe tener una o dos oraciones como máximo.
- La salida debe verse prolija y con espacio visible entre puntos.

---

Instrucciones de contenido:
- NO inventes información. Basa todo tu análisis estrictamente en los textos proporcionados.
- Cada sugerencia debe reflejar una diferencia o área de mejora real entre el CV y los requisitos.
- Sé específico: evita consejos genéricos o vagos.
- Sé constructivo y alentador: explica cómo el candidato puede adaptar o mejorar su CV.
- Utiliza palabras clave relevantes del puesto para optimizar el CV frente a sistemas ATS (Applicant Tracking Systems).
- Proporciona exactamente 5 sugerencias, ni más ni menos.

---

Ejemplo de formato esperado (respetando los espacios):

1. [Primera sugerencia en un párrafo corto explicando qué mejorar.]


(4 saltos de línea aquí)


2. [Segunda sugerencia.]


(4 saltos de línea aquí)


3. [Tercera sugerencia.]


(4 saltos de línea aquí)


4. [Cuarta sugerencia.]


(4 saltos de línea aquí)


5. [Quinta sugerencia.]

---

Ahora, genera las 5 sugerencias siguiendo TODAS las instrucciones al pie de la letra PORFIS.
"""


    try:
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"[❗] Error al generar sugerencias con Gemini: {e}")
        error_message = f"⚠️ Error al contactar la API de Gemini\nNo se pudieron generar las sugerencias.\n\nDetalle del error: {str(e)}"
        return error_message

# --- RUTAS DE LA APLICACIÓN ---

@app.route("/")
def index():
    return render_template("pantalla_principal.html")

@app.route("/subir")
def subir():
    return render_template("index.html")

@app.route('/comparar', methods=['POST'])
def comparar():
    cv_file = request.files.get('cv')
    req_file = request.files.get('requisitos')
    texto_oferta = (request.form.get('requisitos_texto') or '').strip()[:MAX_TEXTO_OFERTA]
    hay_archivo_oferta = bool(req_file and req_file.filename)

    if not cv_file or not cv_file.filename:
        return error_json('Falta tu CV. Subí un archivo para continuar.')
    if not texto_oferta and not hay_archivo_oferta:
        return error_json('Falta la oferta. Subí un archivo o pegá el texto del puesto.')

    a_validar = [cv_file] + ([req_file] if hay_archivo_oferta and not texto_oferta else [])
    if not all(allowed_file(f.filename) for f in a_validar):
        return error_json('Formato no permitido. Usá PDF, Word, TXT, JPG o PNG.')

    rutas = []
    try:
        texto_cv = leer_texto(guardar_temporal(cv_file, rutas))
        texto_req = texto_oferta or leer_texto(guardar_temporal(req_file, rutas))
    except Exception as e:
        print(f"[❗] Error al procesar archivos: {e}")
        return error_json('No pudimos procesar los archivos. Probá con otro formato.', 500)
    finally:
        for ruta in rutas:
            try:
                os.remove(ruta)
            except OSError as e:
                print(f"Error al eliminar archivos: {e}")

    if not texto_cv.strip():
        return error_json('No pudimos leer tu CV. Verificá que tenga texto real y no esté vacío.', 422)
    if not texto_req.strip():
        return error_json('No pudimos leer la oferta. Verificá que tenga texto real y no esté vacía.', 422)

    porcentaje, feedback = comparar_textos(texto_cv, texto_req)
    if feedback.startswith('❗'):
        return error_json('No pudimos conectar con el servicio de análisis. Probá de nuevo en unos minutos.', 502)

    sugerencias = ""
    # Se generan sugerencias si la compatibilidad no es casi perfecta
    if porcentaje < 95:
        sugerencias = generar_sugerencias_con_gemini(texto_cv, texto_req)
    else:
        feedback = ("¡Excelente! Tu CV está muy alineado con los requisitos del puesto. "
                    "No es necesario realizar cambios importantes.")

    return render_template("resultado.html", similitud=f"{porcentaje}", feedback=feedback, sugerencias=sugerencias)


app.register_blueprint(crear_cv_bp)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)