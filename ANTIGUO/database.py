"""
Capa de acceso a datos para la aplicación de la clínica dental.
Contiene la definición del esquema y la clase DB para interactuar con SQLite.
"""

import sqlite3
from utils import DB_PATH, backup_db, today_iso

# --------------------------- Esquema de la Base de Datos ---------------------------

SCHEMA = """
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS patients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula TEXT UNIQUE,                -- N° historia clínica = cédula
    nombres TEXT NOT NULL,
    apellidos TEXT NOT NULL,
    sexo TEXT,
    edad INTEGER,                      -- Mantener para compatibilidad (se puede eliminar después)
    telefono TEXT,
    direccion TEXT,
    email TEXT,
    fecha_nacimiento TEXT,             -- Fecha de nacimiento en formato ISO (YYYY-MM-DD)
    alergias TEXT,                     -- Campo para almacenar las alergias del paciente
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,                           -- ISO yyyy-mm-dd
    motivo TEXT,
    problema_actual TEXT,
    antecedentes TEXT,
    signos_vitales TEXT,
    examen_estomatognatico TEXT,
    indicadores_placa REAL,
    indicadores_calculo REAL,
    indicadores_gingivitis REAL,
    indice_cpo_c INTEGER,
    indice_cpo_p INTEGER,
    indice_cpo_o INTEGER,
    indice_cpo_total INTEGER,
    estado TEXT DEFAULT 'draft',                   -- draft | final
    notas TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS odontogram (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    diente INTEGER NOT NULL,
    zona TEXT,                       -- NULL = diente completo, o "vestibular", "lingual", "mesial", "distal", "oclusal"
    estado TEXT,
    color TEXT,
    nota TEXT,
    UNIQUE (visit_id, diente, zona)
);

CREATE TABLE IF NOT EXISTS prescriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    fecha TEXT NOT NULL,
    diagnostico TEXT,
    indicaciones TEXT,
    medicamentos TEXT,
    recomendaciones TEXT,
    codigo_unico TEXT UNIQUE,
    pdf_path TEXT
);

CREATE TABLE IF NOT EXISTS attachments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    fecha TEXT NOT NULL,
    nombre TEXT NOT NULL,
    file_path TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hygiene_indices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visit_id INTEGER NOT NULL REFERENCES visits(id) ON DELETE CASCADE,
    diente INTEGER NOT NULL,
    indice_placa INTEGER,  -- 0-3
    indice_calculo INTEGER,  -- 0-3
    indice_gingivitis INTEGER,  -- 0-1
    UNIQUE (visit_id, diente)
);

CREATE TABLE IF NOT EXISTS certificates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    visit_id INTEGER REFERENCES visits(id) ON DELETE SET NULL,
    fecha TEXT NOT NULL,
    tipo TEXT NOT NULL,  -- Tipo de certificado (médico, dental, etc.)
    contenido TEXT NOT NULL,
    diagnostico TEXT,
    tratamiento TEXT,
    recomendaciones TEXT,
    pdf_path TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
"""

# --------------------------- Clase de Base de Datos ---------------------------

class DB:
    """Clase para manejar la conexión y operaciones con la base de datos SQLite."""
    def __init__(self, path=DB_PATH):
        self.path = path
        self._ensure_schema()

    def _connect(self):
        con = sqlite3.connect(self.path)
        con.row_factory = sqlite3.Row
        return con

    def _ensure_schema(self):
        con = self._connect()
        try:
            # Crear las tablas según el esquema
            con.executescript(SCHEMA)
            
            # Verificar si la columna fecha_nacimiento existe en la tabla patients
            cursor = con.execute("PRAGMA table_info(patients)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if "fecha_nacimiento" not in columns:
                # Agregar la columna fecha_nacimiento si no existe
                con.execute("ALTER TABLE patients ADD COLUMN fecha_nacimiento TEXT")
            
            # Verificar si la columna alergias existe en la tabla patients
            if "alergias" not in columns:
                # Agregar la columna alergias si no existe
                con.execute("ALTER TABLE patients ADD COLUMN alergias TEXT")
            
            # Verificar si la columna recomendaciones existe en la tabla prescriptions
            cursor = con.execute("PRAGMA table_info(prescriptions)")
            columns = [column[1] for column in cursor.fetchall()]
            
            if "recomendaciones" not in columns:
                # Agregar la columna recomendaciones si no existe
                con.execute("ALTER TABLE prescriptions ADD COLUMN recomendaciones TEXT")
            
            con.commit()
        finally:
            con.close()

    # ---------- Pacientes ----------
    def get_or_create_patient(self, cedula, nombres, apellidos, **kw):
        con = self._connect()
        try:
            cur = con.execute("SELECT id FROM patients WHERE cedula=?", (cedula,))
            row = cur.fetchone()
            if row:
                # Actualizar paciente existente
                update_fields = {k: v for k, v in kw.items() if v is not None}
                if update_fields:
                    set_clause = ", ".join([f"{key}=?" for key in update_fields.keys()])
                    params = list(update_fields.values()) + [row[0]]
                    con.execute(f"UPDATE patients SET {set_clause} WHERE id=?", params)
                    con.commit()
                    backup_db()
                return row[0]
            else:
                # Crear nuevo paciente
                con.execute("""
                    INSERT INTO patients (cedula, nombres, apellidos, sexo, edad, telefono, direccion, email, fecha_nacimiento, alergias)
                    VALUES (?,?,?,?,?,?,?,?,?,?)
                """, (cedula, nombres, apellidos, kw.get("sexo"), kw.get("edad"), kw.get("telefono"),
                      kw.get("direccion"), kw.get("email"), kw.get("fecha_nacimiento"), kw.get("alergias")))
                con.commit()
                pid = con.execute("SELECT last_insert_rowid()").fetchone()[0]
                backup_db()
                return pid
        finally:
            con.close()

    def find_patient_by_cedula(self, cedula):
        con = self._connect()
        try:
            row = con.execute("SELECT * FROM patients WHERE cedula=?", (cedula,)).fetchone()
            return dict(row) if row else None
        finally:
            con.close()

    def find_patient_by_id(self, patient_id):
        con = self._connect()
        try:
            row = con.execute("SELECT * FROM patients WHERE id=?", (patient_id,)).fetchone()
            return dict(row) if row else None
        finally:
            con.close()

    def search_patients(self, q):
        con = self._connect()
        try:
            like = f"%{q}%"
            rows = con.execute("""
               SELECT * FROM patients
               WHERE cedula LIKE ? OR nombres LIKE ? OR apellidos LIKE ?
               ORDER BY apellidos, nombres
            """, (like, like, like)).fetchall()
            return [dict(r) for r in rows]
        finally:
            con.close()

    # ---------- Visitas ----------
    def new_visit(self, patient_id, fecha=None, estado="draft"):
        fecha = fecha or today_iso()
        con = self._connect()
        try:
            con.execute("INSERT INTO visits (patient_id, fecha, estado) VALUES (?,?,?)",
                        (patient_id, fecha, estado))
            con.commit()
            vid = con.execute("SELECT last_insert_rowid()").fetchone()[0]
            backup_db()
            return vid
        finally:
            con.close()

    def save_visit(self, visit_id, **fields):
        keys = []
        vals = []
        for k, v in fields.items():
            keys.append(f"{k}=?")
            vals.append(v)
        if not keys:
            return
        vals.append(visit_id)
        con = self._connect()
        try:
            con.execute(f"UPDATE visits SET {', '.join(keys)} WHERE id=?", vals)
            con.commit()
            backup_db()
        finally:
            con.close()

    def visit_by_id(self, visit_id):
        con = self._connect()
        try:
            r = con.execute("SELECT * FROM visits WHERE id=?", (visit_id,)).fetchone()
            return dict(r) if r else None
        finally:
            con.close()

    def visits_of_patient(self, patient_id, from_date=None, to_date=None):
        con = self._connect()
        try:
            q = "SELECT * FROM visits WHERE patient_id=?"
            p = [patient_id]
            if from_date:
                q += " AND fecha>=?"
                p.append(from_date)
            if to_date:
                q += " AND fecha<=?"
                p.append(to_date)
            q += " ORDER BY fecha DESC, id DESC"
            return [dict(r) for r in con.execute(q, tuple(p)).fetchall()]
        finally:
            con.close()

    def get_all_visits(self, from_date=None, to_date=None):
        """
        Get all visits with optional date filtering.
        """
        con = self._connect()
        try:
            q = "SELECT * FROM visits"
            p = []
            if from_date:
                q += " WHERE fecha>=?"
                p.append(from_date)
            if to_date:
                if from_date:
                    q += " AND fecha<=?"
                else:
                    q += " WHERE fecha<=?"
                p.append(to_date)
            q += " ORDER BY fecha DESC, id DESC"
            return [dict(r) for r in con.execute(q, tuple(p)).fetchall()]
        finally:
            con.close()

    # ---------- Odontograma ----------
    def set_tooth_state(self, visit_id, patient_id, diente, estado, color, nota, zona=None):
        con = self._connect()
        try:
            con.execute("""
               INSERT INTO odontogram (visit_id, patient_id, diente, zona, estado, color, nota)
               VALUES (?,?,?,?,?,?,?)
               ON CONFLICT(visit_id, diente, zona) DO UPDATE SET
                 estado=excluded.estado, color=excluded.color, nota=excluded.nota
            """, (visit_id, patient_id, diente, zona, estado, color, nota))
            con.commit()
            backup_db()
        finally:
            con.close()

    def get_odontogram(self, visit_id):
        con = self._connect()
        try:
            rows = con.execute("SELECT * FROM odontogram WHERE visit_id=?", (visit_id,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            con.close()

    def clear_odontogram(self, visit_id):
        """Elimina todos los registros de odontograma para una visita específica"""
        con = self._connect()
        try:
            con.execute("DELETE FROM odontogram WHERE visit_id=?", (visit_id,))
            con.commit()
            backup_db()
        finally:
            con.close()

    # ---------- Recetas ----------
    def create_prescription(self, patient_id, visit_id, diagnostico, indicaciones, medicamentos, recomendaciones=None, fecha=None):
        fecha = fecha or today_iso()
        con = self._connect()
        try:
            con.execute("""
               INSERT INTO prescriptions (visit_id, patient_id, fecha, diagnostico, indicaciones, medicamentos, recomendaciones)
               VALUES (?,?,?,?,?,?,?)
            """, (visit_id, patient_id, fecha, diagnostico, indicaciones, medicamentos, recomendaciones))
            con.commit()
            rid = con.execute("SELECT last_insert_rowid()").fetchone()[0]
            codigo = f"PR-{fecha.replace('-','')}-{rid}"
            con.execute("UPDATE prescriptions SET codigo_unico=? WHERE id=?", (codigo, rid))
            con.commit()
            backup_db()
            return rid, codigo
        finally:
            con.close()

    def prescriptions_of_patient(self, patient_id):
        con = self._connect()
        try:
            rows = con.execute("SELECT * FROM prescriptions WHERE patient_id=? ORDER BY fecha DESC, id DESC",
                               (patient_id,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            con.close()

    def get_prescription_by_id(self, presc_id):
        con = self._connect()
        try:
            row = con.execute("SELECT * FROM prescriptions WHERE id=?", (presc_id,)).fetchone()
            return dict(row) if row else None
        finally:
            con.close()

    def update_prescription_pdf_path(self, presc_id, pdf_path):
        con = self._connect()
        try:
            con.execute("UPDATE prescriptions SET pdf_path=? WHERE id=?", (pdf_path, presc_id))
            con.commit()
        finally:
            con.close()

    # ---------- Adjuntos ----------
    def add_attachment(self, patient_id, visit_id, nombre, src_path, fecha=None):
        from utils import DOCS_DIR # Evitar importación circular
        import os
        import shutil

        fecha = fecha or today_iso()
        
        # Crear subcarpeta para el paciente
        patient_dir = os.path.join(DOCS_DIR, str(patient_id))
        os.makedirs(patient_dir, exist_ok=True)
        
        # Crear subcarpeta para adjuntos dentro de la carpeta del paciente
        attachments_dir = os.path.join(patient_dir, "adjuntos")
        os.makedirs(attachments_dir, exist_ok=True)
        
        # Construir ruta destino en la subcarpeta de adjuntos
        base = os.path.basename(src_path)
        dst = os.path.join(attachments_dir, base)
        i = 1
        root, ext = os.path.splitext(dst)
        while os.path.exists(dst):
            dst = f"{root}_{i}{ext}"
            i += 1
        shutil.copy2(src_path, dst)

        con = self._connect()
        try:
            con.execute("""
                INSERT INTO attachments (patient_id, visit_id, fecha, nombre, file_path)
                VALUES (?,?,?,?,?)
            """, (patient_id, visit_id, fecha, nombre, dst))
            con.commit()
            backup_db()
        finally:
            con.close()

    def attachments_of_patient(self, patient_id):
        con = self._connect()
        try:
            rows = con.execute("""
              SELECT * FROM attachments
              WHERE patient_id=?
              ORDER BY fecha DESC, id DESC
            """, (patient_id,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            con.close()

    # ---------- Dashboard ----------
    def get_dashboard_stats(self):
        from datetime import timedelta, datetime # Importación local

        con = self._connect()
        try:
            total_patients = con.execute("SELECT COUNT(id) FROM patients").fetchone()[0]

            today = today_iso()
            past_30_days = (datetime.fromisoformat(today) - timedelta(days=30)).isoformat()

            recent_visits = con.execute("SELECT COUNT(id) FROM visits WHERE fecha >= ?", (past_30_days,)).fetchone()[0]

            draft_visits = con.execute("SELECT COUNT(id) FROM visits WHERE estado = 'draft'").fetchone()[0]

            return {
                "total_patients": total_patients,
                "recent_visits": recent_visits, # Últimos 30 días
                "draft_visits": draft_visits
            }
        except Exception as e:
            print(f"Error getting dashboard stats: {e}")
            return {"total_patients": 0, "recent_visits": 0, "draft_visits": 0}
        finally:
            con.close()

    def save_hygiene_averages(self, visit_id, avg_placa, avg_calculo, avg_gingivitis):
        """Guarda los promedios de los índices de higiene para una visita"""
        con = self._connect()
        try:
            con.execute("""
                UPDATE visits 
                SET indicadores_placa=?, indicadores_calculo=?, indicadores_gingivitis=?
                WHERE id=?
            """, (avg_placa, avg_calculo, avg_gingivitis, visit_id))
            con.commit()
            backup_db()
        finally:
            con.close()

    def save_hygiene_indices(self, visit_id, hygiene_data):
        """
        Guarda los valores de higiene por diente
        hygiene_data: diccionario con la estructura {diente: {'placa': valor, 'calculo': valor, 'gingivitis': valor}}
        """
        con = self._connect()
        try:
            # Eliminar registros anteriores para esta visita
            con.execute("DELETE FROM hygiene_indices WHERE visit_id=?", (visit_id,))
            
            # Insertar nuevos valores
            for diente, valores in hygiene_data.items():
                con.execute("""
                    INSERT INTO hygiene_indices (visit_id, diente, indice_placa, indice_calculo, indice_gingivitis)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    visit_id,
                    diente,
                    valores.get('placa'),
                    valores.get('calculo'),
                    valores.get('gingivitis')
                ))
            
            con.commit()
            backup_db()
        finally:
            con.close()

    def get_hygiene_indices(self, visit_id):
        """Obtiene los valores de higiene por diente para una visita"""
        con = self._connect()
        try:
            rows = con.execute("""
                SELECT diente, indice_placa, indice_calculo, indice_gingivitis
                FROM hygiene_indices
                WHERE visit_id=?
            """, (visit_id,)).fetchall()
            
            # Convertir a diccionario
            hygiene_data = {}
            for row in rows:
                hygiene_data[row['diente']] = {
                    'placa': row['indice_placa'],
                    'calculo': row['indice_calculo'],
                    'gingivitis': row['indice_gingivitis']
                }
            
            return hygiene_data
        finally:
            con.close()

    # ---------- Certificados ----------
    def create_certificate(self, patient_id, visit_id, tipo, contenido, diagnostico=None, tratamiento=None, recomendaciones=None, fecha=None):
        """Crea un nuevo certificado médico"""
        fecha = fecha or today_iso()
        con = self._connect()
        try:
            con.execute("""
                INSERT INTO certificates (patient_id, visit_id, fecha, tipo, contenido, diagnostico, tratamiento, recomendaciones)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """, (patient_id, visit_id, fecha, tipo, contenido, diagnostico, tratamiento, recomendaciones))
            con.commit()
            cert_id = con.execute("SELECT last_insert_rowid()").fetchone()[0]
            backup_db()
            return cert_id
        finally:
            con.close()

    def update_certificate_pdf_path(self, cert_id, pdf_path):
        """Actualiza la ruta del PDF del certificado"""
        con = self._connect()
        try:
            con.execute("UPDATE certificates SET pdf_path=? WHERE id=?", (pdf_path, cert_id))
            con.commit()
        finally:
            con.close()

    def get_certificate_by_id(self, cert_id):
        """Obtiene un certificado por su ID"""
        con = self._connect()
        try:
            row = con.execute("SELECT * FROM certificates WHERE id=?", (cert_id,)).fetchone()
            return dict(row) if row else None
        finally:
            con.close()

    def certificates_of_patient(self, patient_id):
        """Obtiene todos los certificados de un paciente"""
        con = self._connect()
        try:
            rows = con.execute("""
                SELECT * FROM certificates
                WHERE patient_id=?
                ORDER BY fecha DESC, id DESC
            """, (patient_id,)).fetchall()
            return [dict(r) for r in rows]
        finally:
            con.close()

    def get_all_certificates(self, from_date=None, to_date=None):
        """
        Obtiene todos los certificados con filtrado opcional por fecha
        """
        con = self._connect()
        try:
            q = "SELECT * FROM certificates"
            p = []
            if from_date:
                q += " WHERE fecha>=?"
                p.append(from_date)
            if to_date:
                if from_date:
                    q += " AND fecha<=?"
                else:
                    q += " WHERE fecha<=?"
                p.append(to_date)
            q += " ORDER BY fecha DESC, id DESC"
            return [dict(r) for r in con.execute(q, tuple(p)).fetchall()]
        finally:
            con.close()
