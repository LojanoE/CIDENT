"""
Utilidades y constantes para la aplicación de la clínica dental.
"""

import os
import shutil
from datetime import datetime, date
from tkinter import messagebox

# --------------------------- Constantes de Rutas ---------------------------

APP_DIR = os.path.abspath(os.path.dirname(__file__))
DATA_DIR = os.path.join(APP_DIR, "data")
EXPORTS_DIR = os.path.join(APP_DIR, "exports")
DOCS_DIR = os.path.join(DATA_DIR, "docs")
BACKUP_DIR = os.path.join(APP_DIR, "backups")
DB_PATH = os.path.join(DATA_DIR, "clinica.db")

# Asegurarse de que los directorios existan
for d in [DATA_DIR, EXPORTS_DIR, DOCS_DIR, BACKUP_DIR]:
    os.makedirs(d, exist_ok=True)

# --------------------------- Utilidades Generales ---------------------------

def backup_db():
    """Crea un backup timestamped del DB si existe."""
    try:
        if os.path.exists(DB_PATH):
            ts = datetime.now().strftime("%Y%m%d_%H%M%S")
            dst = os.path.join(BACKUP_DIR, f"clinica_{ts}.db")
            shutil.copy2(DB_PATH, dst)
    except Exception as e:
        print("Backup falló:", e)

def today_iso():
    """Devuelve la fecha de hoy en formato ISO (yyyy-mm-dd)."""
    return date.today().isoformat()

# --------------------------- Wrappers de Mensajes ---------------------------

def yesno(msg, title="Confirmar"):
    return messagebox.askyesno(title, msg)

def info(msg, title="Info"):
    messagebox.showinfo(title, msg)

def warn(msg, title="Atención"):
    messagebox.showwarning(title, msg)

def err(msg, title="Error"):
    messagebox.showerror(title, msg)

# --------------------------- Conversiones de Tipos ---------------------------

def to_int(s):
    try:
        return int(str(s).strip())
    except (ValueError, TypeError):
        return None

def to_float(s):
    try:
        return float(str(s).strip())
    except (ValueError, TypeError):
        return None

def safe_str(v):
    return "" if v is None else str(v)

def calcular_edad(fecha_nacimiento_str):
    """
    Calcula la edad en años y meses a partir de una fecha de nacimiento en formato ISO (YYYY-MM-DD).
    Retorna una tupla (años, meses) o (None, None) si hay un error.
    """
    if not fecha_nacimiento_str:
        return None, None
    
    try:
        from datetime import datetime
        fecha_nac = datetime.strptime(fecha_nacimiento_str, "%Y-%m-%d").date()
        hoy = datetime.now().date()
        
        # Calcular años
        años = hoy.year - fecha_nac.year
        # Ajustar si aún no ha pasado el cumpleaños este año
        if hoy.month < fecha_nac.month or (hoy.month == fecha_nac.month and hoy.day < fecha_nac.day):
            años -= 1
            
        # Calcular meses
        meses = hoy.month - fecha_nac.month
        if hoy.day < fecha_nac.day:
            meses -= 1
        if meses < 0:
            meses += 12
            
        return años, meses
    except ValueError:
        return None, None
