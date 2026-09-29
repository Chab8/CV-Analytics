from flask import Flask, request, jsonify, render_template
from werkzeug.utils import secure_filename
import os
import LectorDeTextos
from ComparadorDeTexto import comparar_textos
import google.generativeai as genai
from dotenv import load_dotenv

# Cargar variables del archivo .env en local
load_dotenv()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
ALLOWED_EXTENSIONS = {'pdf', 'jpg', 'jpeg', 'png', 'doc', 'docx'}
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

API_KEY = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
print("API Key detectada:", API_KEY)  # debug

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
    if 'cv' not in request.files or 'requisitos' not in request.files:
        return jsonify({'error': 'Faltan archivos'}), 400

    cv_file = request.files['cv']
    req_file = request.files['requisitos']

    if cv_file.filename == '' or req_file.filename == '':
        return jsonify({'error': 'Archivos vacíos'}), 400

    if not allowed_file(cv_file.filename) or not allowed_file(req_file.filename):
        return jsonify({'error': 'Tipo de archivo no permitido. Solo PDF, DOC o DOCX.'}), 400


    cv_filename = secure_filename(cv_file.filename)
    req_filename = secure_filename(req_file.filename)

    cv_path = os.path.join(app.config['UPLOAD_FOLDER'], cv_filename)
    req_path = os.path.join(app.config['UPLOAD_FOLDER'], req_filename)

    try:
        cv_file.save(cv_path)
        req_file.save(req_path)
    except Exception as e:
        return jsonify({'error': f'No se pudieron guardar los archivos: {str(e)}'}), 500

    texto_cv = LectorDeTextos.extraer_texto_archivo(cv_path)
    texto_req = LectorDeTextos.extraer_texto_archivo(req_path)
    
    if not texto_cv.strip() or not texto_req.strip():
        return render_template("resultado.html", similitud="0%", feedback="❗ No se pudo leer el contenido de uno o ambos archivos PDF. Verificá que no estén vacíos y que tengan texto real.")

    resultado = comparar_textos(texto_cv, texto_req)
    similitud = f"{resultado[0]}"
    feedback = resultado[1]

    sugerencias = ""
    # Se generan sugerencias si la compatibilidad no es casi perfecta
    if resultado[0] < 95: 
        sugerencias = generar_sugerencias_con_gemini(texto_cv, texto_req)
    else:    
        feedback = ( "¡Excelente! Tu CV está muy alineado con los requisitos del puesto. "
        "No es necesario realizar cambios importantes."
        )
    try:
        os.remove(cv_path)
        os.remove(req_path)
    except OSError as e:
        print(f"Error al eliminar archivos: {e}")

    return render_template("resultado.html", similitud=similitud, feedback=feedback, sugerencias=sugerencias)

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5001)