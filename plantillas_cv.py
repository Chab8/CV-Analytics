"""
Registro de plantillas de CV.

Para AGREGAR una plantilla nueva:
  1. Crear el archivo HTML en templates/cv_plantillas/<id>.html
     (recibe la variable `cv`, ver DATOS_MUESTRA para la estructura).
  2. Agregar un diccionario a PLANTILLAS con el mismo <id>.
Listo: aparece sola en el selector, con miniatura generada a partir de DATOS_MUESTRA.
"""

PLANTILLAS = [
    {
        "id": "clasica",
        "nombre": "Clásica",
        "descripcion": "Una columna, sobria y fácil de leer por sistemas ATS.",
        "archivo": "cv_plantillas/clasica.html",
    },
    {
        "id": "moderna",
        "nombre": "Moderna",
        "descripcion": "Dos columnas con barra lateral para habilidades e idiomas.",
        "archivo": "cv_plantillas/moderna.html",
    },
]


def obtener_plantilla(plantilla_id):
    """Devuelve la plantilla con ese id, o None si no existe."""
    for p in PLANTILLAS:
        if p["id"] == plantilla_id:
            return p
    return None


# Datos de ejemplo: se usan para las miniaturas del selector.
DATOS_MUESTRA = {
    "personal": {
        "nombre": "Camila Fernández",
        "titulo": "Analista de Datos",
        "email": "camila.fernandez@email.com",
        "telefono": "+54 11 5555-1234",
        "ubicacion": "Buenos Aires, Argentina",
        "linkedin": "linkedin.com/in/camilafernandez",
        "web": "",
        "resumen": "Analista con 3 años de experiencia transformando datos en decisiones de negocio. "
                   "Me apasiona automatizar procesos y comunicar hallazgos de forma clara.",
    },
    "experiencia": [
        {
            "puesto": "Analista de Datos Jr.",
            "empresa": "Empresa Ejemplo S.A.",
            "desde": "03/2022",
            "hasta": "",
            "actual": True,
            "descripcion": "Armé dashboards de ventas en Power BI usados por 5 áreas.\n"
                           "Automaticé reportes semanales con Python, ahorrando 6 horas por semana.",
        },
        {
            "puesto": "Pasante de Business Intelligence",
            "empresa": "Consultora Demo",
            "desde": "01/2021",
            "hasta": "02/2022",
            "actual": False,
            "descripcion": "Limpieza y modelado de datos en SQL para proyectos de clientes.",
        },
    ],
    "educacion": [
        {
            "titulo": "Ingeniería Industrial",
            "institucion": "Universidad de Ejemplo",
            "desde": "2018",
            "hasta": "2023",
            "descripcion": "",
        }
    ],
    "habilidades": ["Python", "SQL", "Power BI", "Excel avanzado", "Comunicación"],
    "idiomas": [
        {"idioma": "Español", "nivel": "Nativo"},
        {"idioma": "Inglés", "nivel": "Avanzado"},
    ],
    "extras": [
        {"titulo": "Data Analytics Certificate", "institucion": "Coursera", "anio": "2022"},
    ],
}