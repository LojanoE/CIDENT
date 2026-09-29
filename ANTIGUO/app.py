"""
Interfaz de usuario para la aplicación de la clínica dental.
"""

import os
import subprocess
import sys
import tkinter as tk
from tkinter import ttk, filedialog, simpledialog

from ttkthemes import ThemedTk
from tkcalendar import DateEntry

from database import DB
from utils import (
    info, warn, err, yesno, today_iso, EXPORTS_DIR, APP_DIR,
    to_int, to_float, safe_str
)

# PDF
try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import cm
    from reportlab.pdfgen import canvas as pdfcanvas
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False

# Image generation
try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_OK = True
except ImportError:
    PIL_OK = False
    print("Advertencia: Pillow no está instalado. Para instalarlo: pip install Pillow")

class App(ThemedTk):
    COLORS = ["#1E90FF", "#FF4500", "#3CB371", "#FFD700", "#8A2BE2", "#000000"]
    FDI_TEETH = [*range(18, 10, -1), *range(21, 29), *range(38, 30, -1), *range(41, 49)]
    
    # Definición de condiciones y símbolos del odontograma
    CONDITION_SYMBOLS = {
        "Sano": "●",  # Círculo negro
        "Caries": "●",  # Círculo rojo (el color se manejará separadamente)
        "Obturación": "●",  # Círculo azul (el color se manejará separadamente)
        "Endodoncia": "▲",  # Triángulo
        "Corona": "■",  # Cuadrado para representar el contorno
        "Prótesis Total": "=",  # Igual para prótesis total
        "Sellante Necesario": "*",  # Asterisco rojo
        "Sellante Realizado": "*",  # Asterisco azul
        "Extracción Indicada": "X",  # X roja
        "Pérdida por Caries": "X",  # X azul
        "Pérdida": "○",  # Círculo con X
        "Prótesis Fija": "O_O",  # Representación textual
        "Prótesis Removible": "(-)",  # Paréntesis
    }
    
    # Colores específicos para ciertos símbolos
    CONDITION_COLORS = {
        "Caries": "#FF0000",  # Rojo para caries
        "Obturación": "#0000FF",  # Azul para obturación
        "Sellante Necesario": "#FF0000",  # Rojo para sellante necesario
        "Sellante Realizado": "#0000FF",  # Azul para sellante realizado
        "Extracción Indicada": "#FF0000",  # Rojo para extracción indicada
        "Pérdida por Caries": "#0000FF",  # Azul para pérdida por caries
    }
    
    # Categorías para el cálculo de CPO
    CPO_CATEGORIES = {
        "C": ["Caries"],  # Caries
        "P": ["Pérdida", "Pérdida por Caries", "Extracción Indicada"],  # Pérdida
        "O": ["Obturación", "Endodoncia", "Corona"]  # Obturación
    }
    
    # Dientes específicos para el registro de índices de higiene
    HYGIENE_TEETH = [11, 16, 17, 21, 26, 27, 31, 36, 37, 41, 46, 47, 51, 55, 65, 71, 75, 85]
    
    # Límites para los índices de higiene
    HYGIENE_LIMITS = {
        "placa": (0, 3),
        "calculo": (0, 3),
        "gingivitis": (0, 1)
    }

    def __init__(self):
        super().__init__()
        self.set_theme("radiance")
        self.title("Historia Clínica Odontológica")
        self.geometry("1200x780")
        self.db = DB()
        self.patient_id = None
        self.visit_id = None
        self._build_ui()

    def _build_ui(self):
        nb = ttk.Notebook(self)
        nb.pack(fill="both", expand=True)
        self.notebook = nb

        self.tab_dashboard = ttk.Frame(nb)
        self.tab_paciente = ttk.Frame(nb)
        self.tab_atencion = ttk.Frame(nb)
        self.tab_odon = ttk.Frame(nb)
        self.tab_recetas = ttk.Frame(nb)
        self.tab_consultas = ttk.Frame(nb)
        self.tab_adjuntos = ttk.Frame(nb)

        nb.add(self.tab_dashboard, text="Dashboard")
        nb.add(self.tab_paciente, text="Paciente")
        nb.add(self.tab_atencion, text="Atención (borrador/final)")
        nb.add(self.tab_odon, text="Odontograma")
        nb.add(self.tab_recetas, text="Recetas")
        nb.add(self.tab_consultas, text="Consultas")
        nb.add(self.tab_adjuntos, text="Adjuntos")

        self._build_dashboard()
        self._build_paciente()
        self._build_atencion()
        self._build_odontograma()
        self._build_recetas()
        self._build_consultas()
        self._build_adjuntos()

        self.notebook.bind("<<NotebookTabChanged>>", self._on_tab_change)
        self._refresh_dashboard() # Carga inicial

    def _on_tab_change(self, event):
        # Antes de cambiar de pestaña, si estamos dejando la pestaña de odontograma, guardar los valores actuales
        current_tab = self.notebook.tab(self.notebook.select(), "text")
        if current_tab == "Odontograma":
            # Guardar los valores actuales de higiene antes de cambiar de pestaña
            self._save_current_hygiene_data()
        
        selected_tab = self.notebook.tab(self.notebook.select(), "text")
        if selected_tab == "Dashboard":
            self._refresh_dashboard()
        elif selected_tab == "Consultas" and self.patient_id:
            self._refresh_consultas()
        elif selected_tab == "Adjuntos" and self.patient_id:
            self._refresh_attachments()
        elif selected_tab == "Recetas" and self.patient_id:
            self._listar_recetas()
        elif selected_tab == "Odontograma" and self.visit_id:
            self._load_odontogram_colors()
            # Cargar también los valores de higiene al acceder a la pestaña de odontograma
            # Usamos after para asegurarnos de que la interfaz esté completamente cargada
            self.after(100, self._load_hygiene_data)

    def _build_dashboard(self):
        f = self.tab_dashboard
        f.columnconfigure(0, weight=1)

        header = ttk.Frame(f)
        header.grid(row=0, column=0, sticky="ew", padx=20, pady=10)
        header.columnconfigure(0, weight=1)
        ttk.Label(header, text="Resumen del Sistema", font=("Arial", 16, "bold")).grid(row=0, column=0, sticky="w")
        ttk.Button(header, text="Actualizar", command=self._refresh_dashboard).grid(row=0, column=1, sticky="e")

        stats_frame = ttk.Frame(f)
        stats_frame.grid(row=1, column=0, sticky="nsew", padx=20, pady=10)
        stats_frame.columnconfigure((0, 1, 2), weight=1)

        self.stat_total_patients = self._create_stat_box(stats_frame, 0, "Pacientes Totales", "0")
        self.stat_recent_visits = self._create_stat_box(stats_frame, 1, "Visitas (Últ. 30 días)", "0")
        self.stat_draft_visits = self._create_stat_box(stats_frame, 2, "Atenciones en Borrador", "0")

    def _create_stat_box(self, parent, col, title, value):
        frame = ttk.LabelFrame(parent, text=title, padding=(10, 5))
        frame.grid(row=0, column=col, padx=10, pady=10, sticky="nsew")
        frame.columnconfigure(0, weight=1)
        
        value_label = ttk.Label(frame, text=value, font=("Arial", 24, "bold"), anchor="center")
        value_label.grid(row=0, column=0, sticky="ew")
        return value_label

    def _refresh_dashboard(self):
        stats = self.db.get_dashboard_stats()
        self.stat_total_patients.config(text=str(stats.get("total_patients", 0)))
        self.stat_recent_visits.config(text=str(stats.get("recent_visits", 0)))
        self.stat_draft_visits.config(text=str(stats.get("draft_visits", 0)))

    def _build_paciente(self):
        f = self.tab_paciente
        head = ttk.LabelFrame(f, text="Identificación (Obligatorio: Nombres, Apellidos, Cédula)")
        head.pack(fill="x", padx=8, pady=8)
        self.cedula_var = tk.StringVar()
        self.nombres_var = tk.StringVar()
        self.apellidos_var = tk.StringVar()
        self.sexo_var = tk.StringVar()
        self.fecha_nac_var = tk.StringVar()  # Variable para almacenar la fecha de nacimiento
        self.tel_var = tk.StringVar()
        self.dir_var = tk.StringVar()
        self.mail_var = tk.StringVar()
        self.alergias_var = tk.StringVar()  # Variable para almacenar las alergias
        row = 0
        ttk.Label(head, text="Cédula / N° Historia:").grid(row=row, column=0, sticky="e", padx=6, pady=4)
        ttk.Entry(head, textvariable=self.cedula_var, width=20).grid(row=row, column=1, sticky="w")
        ttk.Button(head, text="Buscar / Cargar", command=self._buscar_paciente).grid(row=row, column=2, padx=6)
        ttk.Button(head, text="Nuevo/Actualizar", command=self._crear_actualizar_paciente).grid(row=row, column=3, padx=6)
        row += 1
        ttk.Label(head, text="Nombres*").grid(row=row, column=0, sticky="e", padx=6, pady=4)
        ttk.Entry(head, textvariable=self.nombres_var, width=35).grid(row=row, column=1, sticky="w")
        ttk.Label(head, text="Apellidos*").grid(row=row, column=2, sticky="e", padx=6)
        ttk.Entry(head, textvariable=self.apellidos_var, width=35).grid(row=row, column=3, sticky="w")
        row += 1
        ttk.Label(head, text="Sexo").grid(row=row, column=0, sticky="e", padx=6, pady=4)
        ttk.Entry(head, textvariable=self.sexo_var, width=10).grid(row=row, column=1, sticky="w")
        ttk.Label(head, text="Fecha Nacimiento").grid(row=row, column=2, sticky="e", padx=6)
        self.fecha_nac_entry = DateEntry(head, width=12, background='darkblue', foreground='white', borderwidth=2, date_pattern='yyyy-mm-dd')
        self.fecha_nac_entry.grid(row=row, column=3, sticky="w")
        
        # Etiqueta para mostrar la edad calculada
        self.lbl_edad_calc = ttk.Label(head, text="Edad: -- años, -- meses", foreground="gray")
        self.lbl_edad_calc.grid(row=row+1, column=2, columnspan=2, sticky="w", padx=6)
        # Enlazar cambio de fecha para actualizar la edad
        self.fecha_nac_entry.bind("<<DateEntrySelected>>", self._update_edad_display)
        
        row += 2  # Incrementamos en 2 ya que agregamos otra fila
        ttk.Label(head, text="Teléfono").grid(row=row, column=0, sticky="e", padx=6, pady=4)
        ttk.Entry(head, textvariable=self.tel_var, width=20).grid(row=row, column=1, sticky="w")
        ttk.Label(head, text="Dirección").grid(row=row, column=2, sticky="e", padx=6)
        ttk.Entry(head, textvariable=self.dir_var, width=40).grid(row=row, column=3, sticky="w")
        row += 1
        ttk.Label(head, text="Email").grid(row=row, column=0, sticky="e", padx=6, pady=4)
        ttk.Entry(head, textvariable=self.mail_var, width=30).grid(row=row, column=1, sticky="w")
        row += 1
        ttk.Label(head, text="Alergias").grid(row=row, column=0, sticky="e", padx=6, pady=4)
        ttk.Entry(head, textvariable=self.alergias_var, width=50).grid(row=row, column=1, columnspan=3, sticky="w")

        self.lbl_status = ttk.Label(f, text="Sin paciente cargado", foreground="gray")
        self.lbl_status.pack(anchor="w", padx=12, pady=4)

        btns = ttk.Frame(f); btns.pack(anchor="w", padx=12, pady=8)
        ttk.Button(btns, text="Crear Atención (borrador)", command=self._crear_atencion).pack(side="left", padx=4)
        ttk.Button(btns, text="Ver atenciones del paciente", command=self._abrir_consultas_tab).pack(side="left", padx=4)
        ttk.Button(btns, text="Limpiar formulario", command=self._limpiar_formulario_paciente).pack(side="left", padx=4)

    def _buscar_paciente(self):
        ci = self.cedula_var.get().strip()
        if not ci:
            warn("Ingresa una cédula para buscar.")
            return
        p = self.db.find_patient_by_cedula(ci)
        if not p:
            info("No existe. Completa nombres y apellidos para crearlo.")
            self.patient_id = None
            self.lbl_status.config(text="Paciente no encontrado. Completar y guardar.")
            return
        self._load_patient_data(p)

    def _load_patient_data(self, patient_data):
        p = patient_data
        self.patient_id = p["id"]
        self.cedula_var.set(p["cedula"])
        self.nombres_var.set(p["nombres"])
        self.apellidos_var.set(p["apellidos"])
        self.sexo_var.set(p.get("sexo") or "")
        
        # Verificar si hay fecha de nacimiento en el paciente
        if p.get("fecha_nacimiento"):
            # Si hay fecha de nacimiento, establecerla en el DateEntry
            from datetime import datetime
            try:
                fecha_nac = datetime.strptime(p["fecha_nacimiento"], "%Y-%m-%d").date()
                self.fecha_nac_entry.set_date(fecha_nac)
                # Actualizar la visualización de la edad
                self._update_edad_display()
            except ValueError:
                # Si hay un error al parsear la fecha, dejarla vacía
                self.lbl_edad_calc.config(text="Edad: -- años, -- meses")
        else:
            # Si no hay fecha de nacimiento, dejarla vacía
            self.lbl_edad_calc.config(text="Edad: -- años, -- meses")
            
        self.tel_var.set(p.get("telefono") or "")
        self.dir_var.set(p.get("direccion") or "")
        self.mail_var.set(p.get("email") or "")
        self.alergias_var.set(p.get("alergias") or "")  # Cargar las alergias
        self.lbl_status.config(text=f"Paciente cargado: ID {self.patient_id} - {p['apellidos']}, {p['nombres']}")
        # Limpiar datos de visita anterior
        self.visit_id = None
        self._clear_visit_fields()
        self.lbl_visit.config(text="Sin atención activa")


    def _crear_actualizar_paciente(self):
        ci = self.cedula_var.get().strip()
        nom = self.nombres_var.get().strip()
        ape = self.apellidos_var.get().strip()
        if not (ci and nom and ape):
            warn("Cédula, Nombres y Apellidos son obligatorios.")
            return
            
        # Obtener la fecha de nacimiento del DateEntry
        fecha_nac = self.fecha_nac_entry.get_date().strftime("%Y-%m-%d") if self.fecha_nac_entry.get() else None
        
        pid = self.db.get_or_create_patient(
            ci, nom, ape,
            sexo=self.sexo_var.get().strip() or None,
            fecha_nacimiento=fecha_nac,
            telefono=self.tel_var.get().strip() or None,
            direccion=self.dir_var.get().strip() or None,
            email=self.mail_var.get().strip() or None,
            alergias=self.alergias_var.get().strip() or None  # Guardar las alergias
        )
        self.patient_id = pid
        self.lbl_status.config(text=f"Paciente listo: ID {pid}. Puedes crear una atención (borrador).")
        info("Paciente guardado / actualizado.")

    def _crear_atencion(self):
        if not self.patient_id:
            warn("Primero carga/crea el paciente.")
            return
        vid = self.db.new_visit(self.patient_id, fecha=today_iso(), estado="draft")
        self.visit_id = vid
        info(f"Se creó atención en estado 'borrador' (ID {vid}). Completa en pestaña Atención y Odontograma.")
        self._load_visit_data(self.db.visit_by_id(vid))

    def _update_visit_status_label(self):
        if self.visit_id:
            v = self.db.visit_by_id(self.visit_id)
            if v:
                self.lbl_status.config(
                    text=f"Atención actual: ID {self.visit_id} | Fecha {v['fecha']} | Estado: {v['estado']}"
                )
                self.lbl_visit.config(text=f"Atención activa: {self.visit_id} ({v['estado']})")


    def _update_edad_display(self, event=None):
        """Actualizar la visualización de la edad a partir de la fecha de nacimiento"""
        try:
            fecha_nac = self.fecha_nac_entry.get_date()
            if fecha_nac:
                from utils import calcular_edad
                años, meses = calcular_edad(fecha_nac.strftime("%Y-%m-%d"))
                if años is not None and meses is not None:
                    self.lbl_edad_calc.config(text=f"Edad: {años} años, {meses} meses")
                else:
                    self.lbl_edad_calc.config(text="Edad: -- años, -- meses")
            else:
                self.lbl_edad_calc.config(text="Edad: -- años, -- meses")
        except Exception:
            self.lbl_edad_calc.config(text="Edad: -- años, -- meses")


    def _limpiar_formulario_paciente(self):
        """Limpia todos los campos del formulario de paciente y restablece el estado"""
        # Limpiar todos los campos de texto
        self.cedula_var.set("")
        self.nombres_var.set("")
        self.apellidos_var.set("")
        self.sexo_var.set("")
        self.fecha_nac_entry.set_date(today_iso())  # Establecer a la fecha actual
        self.tel_var.set("")
        self.dir_var.set("")
        self.mail_var.set("")
        self.alergias_var.set("")  # Limpiar el campo de alergias
        
        # Restablecer el estado de paciente y visita
        self.patient_id = None
        self.visit_id = None
        
        # Actualizar el estado visual
        self.lbl_status.config(text="Sin paciente cargado", foreground="gray")
        
        # Limpiar campos relacionados con visitas
        if hasattr(self, '_clear_visit_fields'):
            self._clear_visit_fields()
        
        # Actualizar visualización de edad
        self.lbl_edad_calc.config(text="Edad: -- años, -- meses")
        
        # Refrescar completamente la vista del odontograma
        self._draw_teeth()
        
    def _limpiar_odontograma_visual(self):
        """Limpia visualmente el odontograma poniendo todos los dientes en blanco y eliminando símbolos"""
        # Limpiar todos los colores de los dientes
        for item_id in self.canvas_items:
            self.canvas.itemconfig(item_id, fill="white")
        
        # Limpiar todos los símbolos debajo de los dientes
        for tooth_num in self.canvas.find_withtag("symbol_*"):
            self.canvas.itemconfig(tooth_num, text="")

    def _validate_hygiene_input(self, var, entry, min_val, max_val):
        """Valida que la entrada esté dentro del rango permitido"""
        try:
            value = var.get()
            if value == "":
                return  # Permitir campo vacío
            
            num = int(value)
            if min_val <= num <= max_val:
                # Valor válido
                entry.configure(style="")  # Reiniciar estilo
            else:
                # Valor fuera de rango
                entry.configure(style="invalid.TEntry")  # Podríamos usar un estilo diferente para indicar error
                # Devolver al valor anterior si es necesario
        except ValueError:
            # Si no es un número, limpiar el campo
            if value != "":
                # Eliminar el último carácter que causó el error
                var.set(value[:-1])

    def _calcular_promedios_higiene(self):
        """Calcula los promedios de los índices de higiene y los actualiza en la pestaña de atención"""
        if not self.visit_id:
            warn("No hay atención activa. Cree o seleccione una atención primero.")
            return
        
        # Recopilar todos los datos de higiene por diente
        hygiene_data = {}
        for diente in self.HYGIENE_TEETH:
            data = self.hygiene_data[diente]
            hygiene_data[diente] = {
                'placa': to_int(data["placa"].get()),
                'calculo': to_int(data["calculo"].get()),
                'gingivitis': to_int(data["gingivitis"].get())
            }
        
        # Guardar los valores por diente en la base de datos
        self.db.save_hygiene_indices(self.visit_id, hygiene_data)
        
        # Inicializar acumuladores
        total_placa = 0
        total_calculo = 0
        total_gingivitis = 0
        count_placa = 0
        count_calculo = 0
        count_gingivitis = 0
        
        # Calcular promedios para los dientes con valores ingresados
        for diente in self.HYGIENE_TEETH:
            data = self.hygiene_data[diente]
            
            # Procesar Placa
            placa_val = to_int(data["placa"].get())
            if placa_val is not None and 0 <= placa_val <= 3:
                total_placa += placa_val
                count_placa += 1
            
            # Procesar Cálculo
            calculo_val = to_int(data["calculo"].get())
            if calculo_val is not None and 0 <= calculo_val <= 3:
                total_calculo += calculo_val
                count_calculo += 1
            
            # Procesar Gingivitis
            gingivitis_val = to_int(data["gingivitis"].get())
            if gingivitis_val is not None and 0 <= gingivitis_val <= 1:
                total_gingivitis += gingivitis_val
                count_gingivitis += 1
        
        # Calcular promedios
        avg_placa = round(total_placa / count_placa, 2) if count_placa > 0 else 0
        avg_calculo = round(total_calculo / count_calculo, 2) if count_calculo > 0 else 0
        avg_gingivitis = round(total_gingivitis / count_gingivitis, 2) if count_gingivitis > 0 else 0
        
        # Actualizar los campos en la pestaña de atención
        self.ind_placa.set(str(avg_placa))
        self.ind_calculo.set(str(avg_calculo))
        self.ind_gingi.set(str(avg_gingivitis))
        
        # Guardar los promedios en la base de datos
        self.db.save_hygiene_averages(self.visit_id, avg_placa, avg_calculo, avg_gingivitis)
        
        info(f"Promedios calculados - Placa: {avg_placa}, Cálculo: {avg_calculo}, Gingivitis: {avg_gingivitis}")

    def _load_hygiene_data(self):
        """Carga los datos de higiene para la visita actual"""
        if not self.visit_id:
            # Si no hay visita activa, limpiar los campos
            if hasattr(self, 'hygiene_data'):
                for diente in self.HYGIENE_TEETH:
                    if diente in self.hygiene_data:
                        data = self.hygiene_data[diente]
                        if data["placa_entry"]:
                            data["placa_entry"].delete(0, tk.END)
                        else:
                            data["placa"].set("")
                        
                        if data["calculo_entry"]:
                            data["calculo_entry"].delete(0, tk.END)
                        else:
                            data["calculo"].set("")
                        
                        if data["gingivitis_entry"]:
                            data["gingivitis_entry"].delete(0, tk.END)
                        else:
                            data["gingivitis"].set("")
            return
        
        # Cargar los promedios guardados en la base de datos
        visit_data = self.db.visit_by_id(self.visit_id)
        if visit_data:
            self.ind_placa.set(safe_str(visit_data.get("indicadores_placa")))
            self.ind_calculo.set(safe_str(visit_data.get("indicadores_calculo")))
            self.ind_gingi.set(safe_str(visit_data.get("indicadores_gingivitis")))
        
        # Cargar los valores por diente desde la base de datos
        hygiene_data = self.db.get_hygiene_indices(self.visit_id)
        
        # Actualizar los campos en la interfaz con los valores guardados
        for diente in self.HYGIENE_TEETH:
            if diente in hygiene_data:
                valores = hygiene_data[diente]
                placa_val = safe_str(valores.get('placa'))
                calculo_val = safe_str(valores.get('calculo'))
                gingivitis_val = safe_str(valores.get('gingivitis'))
                
                # Actualizar tanto la variable como el campo directamente si existe
                if diente in self.hygiene_data:
                    data = self.hygiene_data[diente]
                    
                    # Actualizar la variable
                    data["placa"].set(placa_val)
                    data["calculo"].set(calculo_val)
                    data["gingivitis"].set(gingivitis_val)
                    
                    # Actualizar directamente el Entry widget si existe
                    if data["placa_entry"]:
                        data["placa_entry"].delete(0, tk.END)
                        data["placa_entry"].insert(0, placa_val)
                    
                    if data["calculo_entry"]:
                        data["calculo_entry"].delete(0, tk.END)
                        data["calculo_entry"].insert(0, calculo_val)
                    
                    if data["gingivitis_entry"]:
                        data["gingivitis_entry"].delete(0, tk.END)
                        data["gingivitis_entry"].insert(0, gingivitis_val)
            else:
                # Si no hay datos guardados, dejar los campos vacíos
                if diente in self.hygiene_data:
                    data = self.hygiene_data[diente]
                    # Actualizar la variable
                    data["placa"].set("")
                    data["calculo"].set("")
                    data["gingivitis"].set("")
                    
                    # Actualizar directamente el Entry widget si existe
                    if data["placa_entry"]:
                        data["placa_entry"].delete(0, tk.END)
                    
                    if data["calculo_entry"]:
                        data["calculo_entry"].delete(0, tk.END)
                    
                    if data["gingivitis_entry"]:
                        data["gingivitis_entry"].delete(0, tk.END)

    def _calcular_actualizar_cpo(self):
        """Calcula y actualiza los valores CPO basados en las condiciones del odontograma"""
        if not self.visit_id:
            # Si no hay visita activa, limpiar los campos CPO
            self.cpo_c.set("")
            self.cpo_p.set("")
            self.cpo_o.set("")
            return
        
        # Obtener los datos del odontograma para la visita actual
        odontogram_data = self.db.get_odontogram(self.visit_id)
        
        # Inicializar contadores
        c_count = p_count = o_count = 0
        
        # Conjuntos para rastrear dientes únicos (evitar conteo duplicado)
        c_teeth = set()
        p_teeth = set()
        o_teeth = set()
        
        # Procesar cada registro del odontograma
        for record in odontogram_data:
            diente = record["diente"]
            estado = record.get("estado", "")
            
            if estado:
                # Separar múltiples condiciones si están separadas por coma
                condiciones = [c.strip() for c in estado.split(',')]
                
                for condicion in condiciones:
                    # Verificar a qué categoría pertenece la condición
                    if condicion in self.CPO_CATEGORIES["C"]:
                        c_teeth.add(diente)
                    elif condicion in self.CPO_CATEGORIES["P"]:
                        p_teeth.add(diente)
                    elif condicion in self.CPO_CATEGORIES["O"]:
                        o_teeth.add(diente)
        
        # Asignar los conteos a los campos
        c_count = len(c_teeth)
        p_count = len(p_teeth)
        o_count = len(o_teeth)
        
        # Actualizar los campos en la interfaz
        self.cpo_c.set(str(c_count) if c_count > 0 else "")
        self.cpo_p.set(str(p_count) if p_count > 0 else "")
        self.cpo_o.set(str(o_count) if o_count > 0 else "")
        
        # Actualizar también el total
        total = c_count + p_count + o_count
        self.cpo_total.set(str(total) if total > 0 else "")

    def _limpiar_odontograma_completo(self):
        """Limpia completamente el odontograma: datos en la base de datos y visualmente"""
        if self.visit_id:
            # Limpiar los datos en la base de datos
            self.db.clear_odontogram(self.visit_id)
        
        # Limpiar visualmente el odontograma
        self._limpiar_odontograma_visual()
        
        # Refrescar completamente el odontograma visual
        self._draw_teeth()
        
        info("Odontograma limpiado completamente.")


    def _abrir_consultas_tab(self):
        if not self.patient_id:
            warn("Primero carga un paciente.")
            return
        self.notebook.select(self.tab_consultas)

    def _build_atencion(self):
        f = self.tab_atencion
        top = ttk.LabelFrame(f, text="Datos de la atención (borrador/final)")
        top.pack(fill="both", expand=True, padx=8, pady=8)
        
        self.motivo = tk.Text(top, height=3)
        self.problema = tk.Text(top, height=3)
        self.antecedentes = tk.Text(top, height=3)
        self.signos = tk.Text(top, height=2)
        self.examen = tk.Text(top, height=3)
        self.ind_placa = tk.StringVar()
        self.ind_calculo = tk.StringVar()
        self.ind_gingi = tk.StringVar()
        self.cpo_c = tk.StringVar(); self.cpo_p = tk.StringVar(); self.cpo_o = tk.StringVar()
        self.cpo_total = tk.StringVar()
        self.notas = tk.Text(top, height=3)

        r = 0
        ttk.Label(top, text="Fecha:").grid(row=r, column=0, sticky="e", padx=6, pady=4)
        self.fecha_entry = DateEntry(top, width=12, background='darkblue', foreground='white', borderwidth=2, date_pattern='yyyy-mm-dd')
        self.fecha_entry.grid(row=r, column=1, sticky="w")

        r += 1
        ttk.Label(top, text="1. Motivo de consulta").grid(row=r, column=0, sticky="ne", padx=6)
        self.motivo.grid(row=r, column=1, columnspan=5, sticky="we", pady=4)
        r += 1
        ttk.Label(top, text="2. Problema actual").grid(row=r, column=0, sticky="ne", padx=6)
        self.problema.grid(row=r, column=1, columnspan=5, sticky="we", pady=4)
        r += 1
        ttk.Label(top, text="3. Antecedentes").grid(row=r, column=0, sticky="ne", padx=6)
        self.antecedentes.grid(row=r, column=1, columnspan=5, sticky="we", pady=4)
        r += 1
        ttk.Label(top, text="4. Signos vitales").grid(row=r, column=0, sticky="ne", padx=6)
        self.signos.grid(row=r, column=1, columnspan=5, sticky="we", pady=4)
        r += 1
        ttk.Label(top, text="5. Examen estomatognático").grid(row=r, column=0, sticky="ne", padx=6)
        self.examen.grid(row=r, column=1, columnspan=5, sticky="we", pady=4)
        r += 1
        ttk.Label(top, text="7. Indicadores (números)").grid(row=r, column=0, sticky="e", padx=6)
        ttk.Label(top, text="Placa").grid(row=r, column=1, sticky="w")
        ttk.Entry(top, textvariable=self.ind_placa, width=8).grid(row=r, column=2, sticky="w")
        ttk.Label(top, text="Cálculo").grid(row=r, column=3, sticky="e")
        ttk.Entry(top, textvariable=self.ind_calculo, width=8).grid(row=r, column=4, sticky="w")
        ttk.Label(top, text="Gingivitis").grid(row=r, column=5, sticky="e")
        ttk.Entry(top, textvariable=self.ind_gingi, width=8).grid(row=r, column=6, sticky="w")
        r += 1
        ttk.Label(top, text="8. Índice CPO-CEO (adulto)").grid(row=r, column=0, sticky="e", padx=6)
        ttk.Label(top, text="C").grid(row=r, column=1, sticky="w")
        ttk.Entry(top, textvariable=self.cpo_c, width=6).grid(row=r, column=2, sticky="w")
        ttk.Label(top, text="P").grid(row=r, column=3, sticky="e")
        ttk.Entry(top, textvariable=self.cpo_p, width=6).grid(row=r, column=4, sticky="w")
        ttk.Label(top, text="O").grid(row=r, column=5, sticky="e")
        ttk.Entry(top, textvariable=self.cpo_o, width=6).grid(row=r, column=6, sticky="w")
        ttk.Label(top, text="TOTAL").grid(row=r, column=7, sticky="e")
        ttk.Entry(top, textvariable=self.cpo_total, width=6, state="readonly").grid(row=r, column=8, sticky="w")
        ttk.Button(top, text="Calcular total", command=self._calc_cpo_total).grid(row=r, column=9, padx=6)
        r += 1
        ttk.Label(top, text="Notas / Observaciones").grid(row=r, column=0, sticky="ne", padx=6)
        self.notas.grid(row=r, column=1, columnspan=9, sticky="we", pady=4)

        top.columnconfigure(1, weight=1)
        top.columnconfigure(4, weight=1)
        top.columnconfigure(6, weight=1)
        top.columnconfigure(9, weight=1)

        btns = ttk.Frame(f); btns.pack(fill="x", padx=8, pady=8)
        ttk.Button(btns, text="Guardar borrador", command=lambda: self._guardar_atencion("draft")).pack(side="left", padx=4)
        ttk.Button(btns, text="Finalizar atención", command=lambda: self._guardar_atencion("final")).pack(side="left", padx=4)
        ttk.Button(btns, text="Generar PDF de Atención", command=self._pdf_atencion).pack(side="left", padx=4)
        ttk.Button(btns, text="Generar Certificado Médico", command=self._show_certificate_form).pack(side="left", padx=4)

        self.lbl_visit = ttk.Label(f, text="Sin atención activa", foreground="gray")
        self.lbl_visit.pack(anchor="w", padx=12)

    def _calc_cpo_total(self):
        total = (to_int(self.cpo_c.get()) or 0) + (to_int(self.cpo_p.get()) or 0) + (to_int(self.cpo_o.get()) or 0)
        self.cpo_total.set(str(total) if total > 0 else "")

    def _guardar_atencion(self, estado):
        if not self.patient_id:
            warn("Primero selecciona/crea paciente.")
            return
        if not self.visit_id:
            if not yesno("No hay atención activa. ¿Crear borrador ahora?"):
                return
            self.visit_id = self.db.new_visit(self.patient_id)

        fields = dict(
            fecha=self.fecha_entry.get_date().isoformat(),
            motivo=self.motivo.get("1.0", "end").strip(),
            problema_actual=self.problema.get("1.0", "end").strip(),
            antecedentes=self.antecedentes.get("1.0", "end").strip(),
            signos_vitales=self.signos.get("1.0", "end").strip(),
            examen_estomatognatico=self.examen.get("1.0", "end").strip(),
            indicadores_placa=to_float(self.ind_placa.get()),
            indicadores_calculo=to_float(self.ind_calculo.get()),
            indicadores_gingivitis=to_float(self.ind_gingi.get()),
            indice_cpo_c=to_int(self.cpo_c.get()),
            indice_cpo_p=to_int(self.cpo_p.get()),
            indice_cpo_o=to_int(self.cpo_o.get()),
            indice_cpo_total=to_int(self.cpo_total.get()),
            estado=estado,
            notas=self.notas.get("1.0", "end").strip()
        )
        self.db.save_visit(self.visit_id, **fields)
        self._update_visit_status_label()
        info("Atención guardada.")

    def _pdf_atencion(self):
        if not self.visit_id:
            warn("No hay atención actual.")
            return
        if not REPORTLAB_OK:
            err("Falta reportlab. Instala con: pip install reportlab")
            return
        v = self.db.visit_by_id(self.visit_id)
        p = self.db.find_patient_by_id(self.patient_id)
        if not v or not p:
            warn("Faltan datos de paciente/atención.")
            return
        
        fn = f"Atencion_{v['id']}_{v['fecha']}.pdf".replace(":", "-")
        
        # Crear la ruta en la subcarpeta de atención del paciente
        from utils import DOCS_DIR
        patient_dir = os.path.join(DOCS_DIR, str(p["id"]))
        attention_dir = os.path.join(patient_dir, "atencion")
        os.makedirs(attention_dir, exist_ok=True)
        
        path = os.path.join(attention_dir, fn)
        c = pdfcanvas.Canvas(path, pagesize=A4)
        w, h = A4
        x0 = 2*cm
        y_current = h - 2*cm  # Inicializar y_current aquí

        # Agregar logotipo si está disponible
        logo_path = os.path.join(APP_DIR, "CIDENT.png")
        if os.path.exists(logo_path):
            try:
                # Ajustar dimensiones y posición del logotipo (más pequeño y arriba a la derecha)
                c.drawImage(logo_path, w - 4.5*cm, h - 3.5*cm, width=2.5*cm, height=2*cm)
            except:
                # Si hay problemas con la imagen (ej. formato no soportado o ruta incorrecta), continuar sin logotipo
                pass
        
        # Encabezado con título de la receta
        c.setFont("Helvetica-Bold", 18)
        # Usar un color para el título (si se puede)
        # c.setFillColorRGB(0.2, 0.4, 0.7)  # Color azul oscuro
        c.drawString(x0, h - 2.2*cm, "RESUMEN DE ATENCIÓN ODONTOLÓGICA") # Título elevado para mejor alineación visual con el logo
        
        # Línea divisoria decorativa
        y_current = h - 3.7*cm # Posicionar la línea justo debajo del logo
        c.setLineWidth(2)
        c.line(x0, y_current, w - x0, y_current)  # Línea gruesa
        c.setLineWidth(1)  # Restaurar grosor de línea
        y_current -= 0.5*cm # Dejar un pequeño espacio después de la línea
        
        # Información del ID de atención y fecha
        c.setFont("Helvetica", 11)
        c.drawString(x0, y_current, f"Atención ID: {v['id']}")
        c.drawString(w - 6*cm, y_current, f"Fecha: {v['fecha']}")
        y_current -= 0.4*cm
        c.drawString(x0, y_current, f"Estado: {v['estado']}")
        y_current -= 0.7*cm
        
        # Información del paciente
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x0, y_current, "Paciente:")
        c.setFont("Helvetica", 11)
        c.drawString(x0 + 2*cm, y_current, f"{p['apellidos']}, {p['nombres']}")
        y_current -= 0.5*cm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x0, y_current, "Cédula:")
        c.setFont("Helvetica", 11)
        c.drawString(x0 + 2*cm, y_current, f"{p['cedula']}")
        y_current -= 1.2*cm  # Aumentar el espacio antes de los bloques
        # Función para bloques de información con mejor formato (mismo estilo que recetas)
        def block(x_pos, y_pos, title, text, col_width):
            y_start = y_pos
            # Resaltar el título con un fondo ligero
            title_width = c.stringWidth(title, "Helvetica-Bold", 12)
            c.setFillColorRGB(0.9, 0.95, 1)  # Fondo azul claro
            c.rect(x_pos, y_pos - 0.25*cm, title_width + 0.6*cm, 0.6*cm, fill=True, stroke=False)
            c.setFillColorRGB(0, 0, 0)  # Restaurar color negro
            
            c.setFont("Helvetica-Bold", 12)
            c.drawString(x_pos, y_pos, title)
            y_pos -= 0.7*cm  # Más espacio después del título
            c.setFont("Helvetica", 10)
            
            # Procesar el texto para dividir líneas largas
            if text:
                for line in (text or "").splitlines():
                    if line.strip():
                        current_line = ""
                        words = line.split(' ')
                        for word in words:
                            test_line = current_line + ' ' + word if current_line else word
                            text_width = c.stringWidth(test_line, "Helvetica", 10)
                            if text_width <= col_width:
                                current_line = test_line
                            else:
                                if current_line:
                                    c.drawString(x_pos, y_pos, current_line)
                                    y_pos -= 0.5*cm
                                current_line = word
                        if current_line:
                            c.drawString(x_pos, y_pos, current_line)
                            y_pos -= 0.5*cm
                    else:
                        y_pos -= 0.5*cm
            else:
                c.drawString(x_pos, y_pos, "—")
                y_pos -= 0.5*cm
            
            return y_pos - 0.7*cm # Retorna la nueva posición Y

        # Dibujar los bloques de información de atención
        col_gap = 1*cm
        col_width = (w - 2*x0 - col_gap) / 2
        col1_x = x0
        col2_x = x0 + col_width + col_gap

        y_col1 = y_current
        y_col2 = y_current

        y_col1 = block(col1_x, y_col1, "Motivo de consulta:", v.get("motivo") or "", col_width)
        y_col2 = block(col2_x, y_col2, "Problema actual:", v.get("problema_actual") or "", col_width)
        
        y_col1 = block(col1_x, y_col1, "Antecedentes:", v.get("antecedentes") or "", col_width)
        y_col2 = block(col2_x, y_col2, "Signos vitales:", v.get("signos_vitales") or "", col_width)

        y_col1 = block(col1_x, y_col1, "Indicadores:", f"Placa={v.get('indicadores_placa') or 0} | Cálculo={v.get('indicadores_calculo') or 0} | Gingivitis={v.get('indicadores_gingivitis') or 0}", col_width)
        y_col2 = block(col2_x, y_col2, "Índice CPO:", f"C={v.get('indice_cpo_c') or 0}  P={v.get('indice_cpo_p') or 0}  O={v.get('indice_cpo_o') or 0}  Total={v.get('indice_cpo_total') or 0}", col_width)

        # Bloques que ocupan todo el ancho
        y_current = min(y_col1, y_col2) # Sincronizar y_current a la posición más baja
        y_current = block(x0, y_current, "Examen estomatognático:", v.get("examen_estomatognatico") or "", w - 2*x0)
        y_current = block(x0, y_current, "Notas:", v.get("notas") or "", w - 2*x0)
        
        # Agregar imagen y descripción del odontograma si está disponible
        if PIL_OK:
            try:
                odontogram_img, odontogram_desc = self._generate_odontogram_image(v['id'])
                
                if odontogram_img:
                    # Agregar título para la imagen del odontograma
                    c.setFont("Helvetica-Bold", 12)
                    # Determinar si es adulto o niño según el contenido
                    import re
                    tooth_numbers = []
                    for line in odontogram_desc.split('\n'):
                        if 'Diente' in line:
                            # Buscar números de diente en el formato "Diente XX:"
                            match = re.search(r'Diente\s+(\d+)', line)
                            if match:
                                try:
                                    tooth_num = int(match.group(1))
                                    tooth_numbers.append(tooth_num)
                                except ValueError:
                                    continue
                    has_primary_teeth = any(51 <= num <= 85 for num in tooth_numbers)
                    odonto_type = "Odontograma Infantil" if has_primary_teeth else "Odontograma Adulto"
                    c.drawString(x0, y_current, f"Imagen del {odonto_type}:")
                    y_current -= 0.1*cm  # Más espacio después del título
                    
                    # Ajustar posición para la imagen del odontograma
                    img_width, img_height = odontogram_img.size
                    # Escalar la imagen para que quepa en la página (manteniendo proporción)
                    max_width = w - 4*cm  # Dejar margen
                    max_height = 10*cm  # Limitar altura
                    scale_factor = min(max_width / img_width, max_height / img_height)  # Escalar para que quepa
                    new_width = img_width * scale_factor
                    new_height = img_height * scale_factor
                    
                    # Guardar la imagen temporalmente para usarla en el PDF
                    temp_img_path = os.path.join(attention_dir, f"temp_odontogram_{v['id']}.png")
                    odontogram_img.save(temp_img_path, "PNG")
                    
                    # Dibujar la imagen del odontograma
                    c.drawImage(temp_img_path, x0, y_current - new_height, width=new_width, height=new_height)
                    y_current -= new_height + 0.8*cm  # Más espacio después de la imagen
                    
                    # Eliminar archivo temporal
                    if os.path.exists(temp_img_path):
                        os.remove(temp_img_path)
                
                if odontogram_desc:
                    # Agregar título para la descripción del odontograma
                    c.setFont("Helvetica-Bold", 12)
                    c.drawString(x0, y_current, "Detalle del Odontograma:")
                    y_current -= 0.6*cm
                    c.setFont("Helvetica", 10)
                    
                    for line in odontogram_desc.split('\n'):
                        if line.strip():
                            # Separar en palabras y ajustar línea por línea para textos largos
                            words = line.split(' ')
                            current_line = ''
                            
                            for word in words:
                                test_line = current_line + ' ' + word if current_line else word
                                text_width = c.stringWidth(test_line, "Helvetica", 10)
                                
                                if text_width <= (w - 4*cm):
                                    current_line = test_line
                                else:
                                    if current_line:
                                        c.drawString(x0, y_current, current_line)
                                        y_current -= 0.5*cm
                                    current_line = word
                                    
                                    # Verificar si se está acercando al final de la página
                                    if y_current < 3*cm:
                                        c.showPage()
                                        y_current = h - 2*cm
                                        # Volver a dibujar encabezado si se crea nueva página
                                        c.setFont("Helvetica-Bold", 18)
                                        c.drawString(x0, y_current - 0.5*cm, "Detalle del Odontograma:")
                                        y_current -= 1.1*cm
                                        c.setFont("Helvetica", 10)
                            
                            # Agregar la última línea si existe
                            if current_line:
                                c.drawString(x0, y_current, current_line)
                                y_current -= 0.5*cm
                        else:
                            y_current -= 0.5*cm  # Espacio para líneas vacías
                        
                        # Verificar si se está acercando al final de la página
                        if y_current < 3*cm:
                            c.showPage()
                            y_current = h - 2*cm
                            c.setFont("Helvetica", 10)  # Restaurar fuente
                        
            except Exception as e:
                print(f"Error al agregar imagen/descripción del odontograma al PDF: {e}")
                import traceback
                traceback.print_exc()
        
        # Pie de página con información de contacto (mismo formato que recetas)
        # Se dibuja en una posición fija en la parte inferior de la página.
        y_footer = 3*cm  # Posición fija desde la parte inferior.
        c.setLineWidth(1.5)
        c.line(x0, y_footer, w - x0, y_footer)  # Línea divisoria
        c.setLineWidth(1)  # Restaurar grosor de línea
        y_footer -= 0.6*cm  # Espacio después de la línea
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x0, y_footer, "Od. Thalia Lojano - ODONTOLOGÍA INTEGRAL")
        y_footer -= 0.45*cm
        c.setFont("Helvetica", 9)
        c.drawString(x0, y_footer, "Dirección: Av. Loja y Don Bosco  |  Teléfono: 0987654321  |  Email: cident@example.com")
        y_footer -= 0.45*cm
        c.setFont("Helvetica", 8)
        c.drawCentredString(w / 2.0, y_footer, "Generado por el sistema el " + today_iso())
        
        c.showPage()
        c.save()
        info(f"PDF generado:\n{path}")

        # Abrir el PDF generado automáticamente
        try:
            if os.name == 'nt': os.startfile(path)
            elif sys.platform == 'darwin': subprocess.run(['open', path])
            else: subprocess.run(['xdg-open', path])
        except Exception as e:
            err(f"No se pudo abrir el PDF automáticamente: {e}")

    def _clear_visit_fields(self):
        self.fecha_entry.set_date(today_iso())
        self.motivo.delete("1.0", "end")
        self.problema.delete("1.0", "end")
        self.antecedentes.delete("1.0", "end")
        self.signos.delete("1.0", "end")
        self.examen.delete("1.0", "end")
        self.notas.delete("1.0", "end")
        self.ind_placa.set("")
        self.ind_calculo.set("")
        self.ind_gingi.set("")
        self.cpo_c.set(""); self.cpo_p.set(""); self.cpo_o.set(""); self.cpo_total.set("")
        
        # Limpiar también los campos de higiene por diente
        if hasattr(self, 'hygiene_data'):
            for diente in self.HYGIENE_TEETH:
                if diente in self.hygiene_data:
                    self.hygiene_data[diente]["placa"].set("")
                    self.hygiene_data[diente]["calculo"].set("")
                    self.hygiene_data[diente]["gingivitis"].set("")
        
        self._load_odontogram_colors()

    def _load_visit_data(self, visit_data):
        v = visit_data
        if not v:
            self._clear_visit_fields()
            return
        
        self.visit_id = v["id"]
        self.fecha_entry.set_date(v["fecha"])
        
        def set_text(w, val): w.delete("1.0","end"); w.insert("1.0", val or "")
        set_text(self.motivo, v.get("motivo"))
        set_text(self.problema, v.get("problema_actual"))
        set_text(self.antecedentes, v.get("antecedentes"))
        set_text(self.signos, v.get("signos_vitales"))
        set_text(self.examen, v.get("examen_estomatognatico"))
        set_text(self.notas, v.get("notas"))

        # Cargar los promedios guardados en la base de datos
        self.ind_placa.set(safe_str(v.get("indicadores_placa")))
        self.ind_calculo.set(safe_str(v.get("indicadores_calculo")))
        self.ind_gingi.set(safe_str(v.get("indicadores_gingivitis")))
        
        # Calcular y llenar los valores CPO basados en las condiciones del odontograma
        self._calcular_actualizar_cpo()
        
        # Cargar los datos de higiene para los dientes específicos
        self._load_hygiene_data()
        
        self.cpo_total.set(safe_str(v.get("indice_cpo_total")))
        
        self._update_visit_status_label()
        
        # Refrescar completamente el odontograma para evitar superposición de datos
        # Esto recrea todos los elementos del canvas con los datos de la visita actual
        self._draw_teeth()
        
        # Calcular y actualizar los valores CPO basados en las condiciones del odontograma
        self._calcular_actualizar_cpo()
        
        self.notebook.select(self.tab_atencion)

    def _build_odontograma(self):
        f = self.tab_odon
        top = ttk.Frame(f); top.pack(fill="x", padx=8, pady=8)
        
        # Selector de tipo de odontograma (adulto/niño)
        ttk.Label(top, text="Tipo de odontograma:").pack(side="left", padx=(0, 4))
        self.odontogram_type = tk.StringVar(value="adulto")
        tipo_combo = ttk.Combobox(top, values=["Adulto", "Niño"], textvariable=self.odontogram_type, width=10, state="readonly")
        tipo_combo.pack(side="left", padx=(0, 10))
        tipo_combo.bind("<<ComboboxSelected>>", lambda e: self._redraw_odontogram())
        
        ttk.Label(top, text="Color actual:").pack(side="left")
        # Frame para mostrar los colores disponibles
        color_frame = ttk.Frame(top)
        color_frame.pack(side="left", padx=4)
        
        # Variable para almacenar el color seleccionado
        self.color_var = tk.StringVar(value=self.COLORS[0])
        
        # Crear botones de color con visualización directa
        for color in self.COLORS:
            btn = tk.Frame(color_frame, bg=color, width=20, height=20, relief="raised", bd=2)
            btn.pack(side="left", padx=2)
            btn.color = color  # Guardar el color en el widget
            
            def click_handler(col):
                return lambda e: self.color_var.set(col)
                
            btn.bind("<Button-1>", click_handler(color))
            
            # También hacer que el botón cambie de aspecto cuando se selecciona
            def update_button_appearance():
                if self.color_var.get() == color:
                    btn.config(relief="sunken", bd=3)
                else:
                    btn.config(relief="raised", bd=2)
            
            # Actualizar cuando cambie la variable de color
            self.color_var.trace_add("write", lambda *args: update_button_appearance())
        
        # Actualizar la apariencia inicial de los botones
        for child in color_frame.winfo_children():
            if hasattr(child, 'color'):
                child.update()

        ttk.Label(top, text="Zona:").pack(side="left", padx=4)
        self.zona_var = tk.StringVar(value="")
        zona_options = ["Vestibular", "Lingual", "Mesial", "Distal", "Oclusal"]
        zona_combo = ttk.Combobox(top, values=zona_options, textvariable=self.zona_var, width=10, state="readonly")
        zona_combo.pack(side="left", padx=4)

        # Botón para limpiar símbolos y datos del odontograma
        ttk.Button(top, text="Clear", command=self._limpiar_odontograma_completo).pack(side="right", padx=4)

        self.canvas = tk.Canvas(f, bg="#eaf6ff", height=300)
        self.canvas.pack(fill="x", padx=8, pady=8)
        self.canvas_items = {}
        self._draw_teeth()
        self.canvas.bind("<Double-1>", self._on_canvas_double_click) # El doble clic es para editar
        ttk.Label(f, text="(Doble clic en un diente para editar estado/nota)").pack(anchor="w", padx=12)
        
        # Frame para ingresar índices de higiene para dientes específicos con scrollbar
        hygiene_outer_frame = ttk.LabelFrame(f, text="Índices de Higiene (Dientes: 16,17,55,11,21,51,26,27,65,36,37,75,31,41,71,46,47,85)")
        hygiene_outer_frame.pack(fill="x", padx=8, pady=8)
        
        # Crear canvas y scrollbar para la sección de higiene
        canvas_frame = ttk.Frame(hygiene_outer_frame)
        canvas_frame.pack(fill="both", expand=True)
        
        self.hygiene_canvas = tk.Canvas(canvas_frame, height=150)
        scrollbar = ttk.Scrollbar(canvas_frame, orient="vertical", command=self.hygiene_canvas.yview)
        
        hygiene_interior_frame = ttk.Frame(self.hygiene_canvas)
        hygiene_interior_frame.bind(
            "<Configure>",
            lambda e: self.hygiene_canvas.configure(scrollregion=self.hygiene_canvas.bbox("all"))
        )
        
        self.hygiene_canvas.create_window((0, 0), window=hygiene_interior_frame, anchor="nw")
        self.hygiene_canvas.configure(yscrollcommand=scrollbar.set)
        
        # Variables para los índices de higiene
        self.hygiene_data = {}  # Diccionario para almacenar los valores por diente
        
        # Crear controles para cada diente
        for diente in self.HYGIENE_TEETH:
            diente_frame = ttk.Frame(hygiene_interior_frame)
            diente_frame.pack(fill="x", pady=2)
            
            ttk.Label(diente_frame, text=f"Diente {diente}:").pack(side="left", padx=(0, 5))
            
            # Campo para Placa
            ttk.Label(diente_frame, text="Placa (0-3):").pack(side="left")
            placa_var = tk.StringVar()
            placa_entry = ttk.Entry(diente_frame, textvariable=placa_var, width=5)
            placa_entry.pack(side="left", padx=(0, 10))
            
            # Campo para Cálculo
            ttk.Label(diente_frame, text="Cálculo (0-3):").pack(side="left")
            calculo_var = tk.StringVar()
            calculo_entry = ttk.Entry(diente_frame, textvariable=calculo_var, width=5)
            calculo_entry.pack(side="left", padx=(0, 10))
            
            # Campo para Gingivitis
            ttk.Label(diente_frame, text="Gingivitis (0-1):").pack(side="left")
            gingivitis_var = tk.StringVar()
            gingivitis_entry = ttk.Entry(diente_frame, textvariable=gingivitis_var, width=5)
            gingivitis_entry.pack(side="left", padx=(0, 10))
            
            # Almacenar las variables para este diente
            self.hygiene_data[diente] = {
                "placa": placa_var,
                "calculo": calculo_var,
                "gingivitis": gingivitis_var,
                "placa_entry": placa_entry,
                "calculo_entry": calculo_entry,
                "gingivitis_entry": gingivitis_entry
            }
            
            # Validar que solo se ingresen números dentro del rango
            placa_var.trace_add("write", lambda name, index, mode, var=placa_var, entry=placa_entry, min_val=0, max_val=3: self._validate_hygiene_input(var, entry, min_val, max_val))
            calculo_var.trace_add("write", lambda name, index, mode, var=calculo_var, entry=calculo_entry, min_val=0, max_val=3: self._validate_hygiene_input(var, entry, min_val, max_val))
            gingivitis_var.trace_add("write", lambda name, index, mode, var=gingivitis_var, entry=gingivitis_entry, min_val=0, max_val=1: self._validate_hygiene_input(var, entry, min_val, max_val))

        # Empaquetar canvas y scrollbar
        self.hygiene_canvas.pack(side="left", fill="both", expand=True)
        scrollbar.pack(side="right", fill="y")
        
        # Permitir desplazamiento con el mouse
        self.hygiene_canvas.bind("<MouseWheel>", lambda event: self.hygiene_canvas.yview_scroll(int(-1*(event.delta/120)), "units"))
        
        # Frame para botones de higiene
        hygiene_btn_frame = ttk.Frame(f)
        hygiene_btn_frame.pack(fill="x", padx=8, pady=5)
        
        # Botón para calcular promedios
        ttk.Button(hygiene_btn_frame, text="Calcular Promedios", command=self._calcular_promedios_higiene).pack(side="left", padx=(0, 5))
        
        # Botón para guardar valores de higiene
        ttk.Button(hygiene_btn_frame, text="Guardar Higiene", command=self._save_current_hygiene_data).pack(side="left", padx=5)

    def _redraw_odontogram(self):
        """Redraw the odontogram based on selected type"""
        self._draw_teeth()

    def _draw_teeth(self):
        self.canvas.delete("all")
        self.canvas_items.clear()
        w = self.canvas.winfo_reqwidth()
        pad = 30
        
        # Determinar qué tipo de odontograma mostrar
        if self.odontogram_type.get() == "Niño":
            # Odontograma infantil - 20 dientes primarios
            y1, y2 = 50, 160
            size = 36
            gap = 15
            # Dientes primarios superiores: 55-51, 61-65
            teeth_top = [*range(55, 50, -1), *range(61, 66)]
            # Dientes primarios inferiores: 85-81, 71-75
            teeth_bot = [*range(85, 80, -1), *range(71, 76)]
        else:
            # Odontograma adulto - 32 dientes permanentes
            y1, y2 = 50, 160
            size = 36
            gap = 15
            teeth_top = [*range(18,10,-1), *range(21,29)]
            teeth_bot = [*range(48,40,-1), *range(31,39)]

        ZONAS = [
            ("vestibular", 0, 0, size, size//3, "V"),
            ("mesial", 0, size//3, size//3, size//3, "M"),
            ("oclusal", size//3, size//3, size//3, size//3, "O"),
            ("distal", 2*size//3, size//3, size//3, size//3, "D"),
            ("lingual", 0, 2*size//3, size, size//3, "L"),
        ]

        def draw_row(teeth, y):
            x = pad
            for t in teeth:
                r = self.canvas.create_rectangle(x, y, x+size, y+size, fill="white", outline="black", width=2, tags=f"tooth_{t}")
                self.canvas_items[r] = (t, None) # Diente completo
                # Increased font size for tooth numbers
                self.canvas.create_text(x+size/2, y+size+18, text=str(t), font=("Arial", 10, "bold"))

                for zona_name, xo, yo, w_z, h_z, label in ZONAS:
                    zone_rect = self.canvas.create_rectangle(
                        x + xo, y + yo, x + xo + w_z, y + yo + h_z,
                        fill="white", outline="gray", width=1, tags=(f"tooth_{t}", f"zone_{zona_name}")
                    )
                    self.canvas_items[zone_rect] = (t, zona_name)
                    txt_x = x + xo + w_z / 2
                    txt_y = y + yo + h_z / 2
                    # Increased font size for zone labels
                    self.canvas.create_text(txt_x, txt_y, text=label, font=("Arial", 8, "bold"), fill="darkblue")
                
                # Add text area below the tooth for displaying symbols
                symbol_text_id = self.canvas.create_text(x + size/2, y + size + 35, text="", font=("Arial", 14, "bold"), tags=f"symbol_{t}")
                
                x += size + gap
        draw_row(teeth_top, y1)
        draw_row(teeth_bot, y2)
        self._load_odontogram_colors()

    def _save_current_hygiene_data(self):
        """Guarda los valores actuales de higiene en la base de datos"""
        if not self.visit_id:
            warn("No hay atención activa. Cree o seleccione una atención primero.")
            return
        
        # Recopilar todos los datos de higiene por diente desde la interfaz actual
        hygiene_data = {}
        for diente in self.HYGIENE_TEETH:
            if diente in self.hygiene_data:
                data = self.hygiene_data[diente]
                hygiene_data[diente] = {
                    'placa': to_int(data["placa"].get()),
                    'calculo': to_int(data["calculo"].get()),
                    'gingivitis': to_int(data["gingivitis"].get())
                }
        
        # Guardar los valores por diente en la base de datos
        self.db.save_hygiene_indices(self.visit_id, hygiene_data)
        
        info("Valores de higiene guardados correctamente.")
        
        # Recalcular promedios y guardarlos también
        self._calcular_promedios_higiene()

    def _load_odontogram_colors(self):
        # Primero limpiar todo visualmente
        for item_id in self.canvas_items:
            self.canvas.itemconfig(item_id, fill="white")
        # Clear all symbols
        for tooth_num in self.canvas.find_withtag("symbol_*"):
            self.canvas.itemconfig(tooth_num, text="")
        
        # Si no hay visita, terminar aquí
        if not self.visit_id:
            return

        data = self.db.get_odontogram(self.visit_id)
        # Agrupar datos por diente, considerando tanto el diente completo como sus zonas
        by_tooth = {}
        for d in data:
            diente = d["diente"]
            zona = d.get("zona")
            if diente not in by_tooth:
                by_tooth[diente] = {"general": None, "zonas": {}}
            
            if zona is None:  # Diente completo
                by_tooth[diente]["general"] = d
            else:  # Zona específica
                by_tooth[diente]["zonas"][zona] = d

        # Para cada diente, mostrar todos los símbolos que se apliquen (general + todas las zonas)
        for diente in by_tooth.keys():
            symbols_to_display = []
            
            # Símbolos del diente completo (general)
            if by_tooth[diente]["general"] is not None:
                estado_general = by_tooth[diente]["general"].get("estado", "")
                if estado_general:
                    conditions = [c.strip() for c in estado_general.split(',')]
                    for condition in conditions:
                        if condition in self.CONDITION_SYMBOLS:
                            symbol = self.CONDITION_SYMBOLS[condition]
                            symbols_to_display.append(symbol)
            
            # Símbolos de todas las zonas específicas
            for zona_name, zona_data in by_tooth[diente]["zonas"].items():
                estado_zona = zona_data.get("estado", "")
                if estado_zona:
                    conditions = [c.strip() for c in estado_zona.split(',')]
                    for condition in conditions:
                        if condition in self.CONDITION_SYMBOLS:
                            symbol = self.CONDITION_SYMBOLS[condition]
                            symbols_to_display.append(symbol)
            
            # Display the symbols below the tooth
            symbol_text = " ".join(symbols_to_display)
            symbol_item = self.canvas.find_withtag(f"symbol_{diente}")
            if symbol_item:
                self.canvas.itemconfig(symbol_item, text=symbol_text)

        # Aplicar colores a cada elemento individual (diente completo o zonas específicas)
        for item_id, (diente, zona) in self.canvas_items.items():
            color = "white"  # Default color
            if diente in by_tooth:
                if zona is None and by_tooth[diente]["general"] is not None:
                    # Diente completo
                    color = by_tooth[diente]["general"].get("color", "white")
                elif zona is not None and zona in by_tooth[diente]["zonas"]:
                    # Zona específica
                    color = by_tooth[diente]["zonas"][zona].get("color", "white")
            self.canvas.itemconfig(item_id, fill=color)

    def _generate_odontogram_image(self, visit_id=None):
        """Genera una imagen del odontograma y su descripción para incluir en el PDF"""
        if not PIL_OK:
            return None, None
            
        # Si no se proporciona un visit_id, usar el actual
        v_id = visit_id or self.visit_id
        if not v_id:
            return None, None

        # Obtener los datos del odontograma para generar la descripción
        odontogram_data = self.db.get_odontogram(v_id)
        
        # Generar la descripción del odontograma
        descripcion = self._generate_odontogram_description(odontogram_data)

        # Tamaño de la imagen (mayor resolución para el PDF)
        width, height = 1000, 600  # Aumentar el tamaño para mayor claridad
        img = Image.new('RGB', (width, height), 'white')
        draw = ImageDraw.Draw(img)

        # Intentar cargar una fuente más clara si está disponible
        try:
            from PIL import ImageFont
            font = ImageFont.truetype("arial.ttf", 12)  # Utilizar una fuente TrueType
        except:
            font = None  # Usar la fuente por defecto si no se puede cargar

        # Determinar qué tipo de odontograma dibujar según los datos
        has_primary_teeth = any(51 <= d["diente"] <= 85 for d in odontogram_data)
        has_adult_teeth = any(11 <= d["diente"] <= 48 for d in odontogram_data)
        
        # Si hay datos de dientes primarios o se ha seleccionado odontograma infantil, usar esquema infantil
        if has_primary_teeth or (hasattr(self, 'odontogram_type') and self.odontogram_type.get() == "Niño"):
            # Parámetros para dibujar los dientes primarios
            pad = 70
            y1, y2 = 100, 250  # Ajustar la separación vertical para dejar más espacio para símbolos
            size = 30  # Aumentar el tamaño de los dientes para mayor claridad
            gap = 15

            # Dientes primarios superiores: 55-51, 61-65
            teeth_top = [*range(55, 50, -1), *range(61, 66)]
            # Dientes primarios inferiores: 85-81, 71-75
            teeth_bot = [*range(85, 80, -1), *range(71, 76)]
        else:
            # Parámetros para dibujar los dientes permanentes
            pad = 70
            y1, y2 = 100, 250  # Ajustar la separación vertical para dejar más espacio para símbolos
            size = 30  # Aumentar el tamaño de los dientes para mayor claridad
            gap = 15

            # Dientes permanentes superiores e inferiores
            teeth_top = [*range(18,10,-1), *range(21,29)]
            teeth_bot = [*range(48,40,-1), *range(31,39)]

        # Zonas de los dientes
        ZONAS = [
            ("vestibular", 0, 0, size, size//3),
            ("mesial", 0, size//3, size//3, size//3),
            ("oclusal", size//3, size//3, size//3, size//3),
            ("distal", 2*size//3, size//3, size//3, size//3),
            ("lingual", 0, 2*size//3, size, size//3),
        ]

        # Agrupar datos por diente, considerando tanto el diente completo como sus zonas
        by_tooth = {}
        for d in odontogram_data:
            diente = d["diente"]
            zona = d.get("zona")
            if diente not in by_tooth:
                by_tooth[diente] = {"general": None, "zonas": {}}
            
            if zona is None:  # Diente completo
                by_tooth[diente]["general"] = d
            else:  # Zona específica
                by_tooth[diente]["zonas"][zona] = d

        def draw_row_with_symbols(teeth, y, label):
            x = pad
            # Dibujar etiqueta de fila
            if font:
                draw.text((x - 60, y - 30), label, fill='black', font=font)
            else:
                draw.text((x - 60, y - 30), label, fill='black')
            for t in teeth:
                # Obtener color del diente completo si existe
                color = "white"
                if t in by_tooth and by_tooth[t]["general"] is not None:
                    color = by_tooth[t]["general"].get("color", "white")
                
                # Dibujar las zonas específicas si existen
                for zona_name, xo, yo, w_z, h_z in ZONAS:
                    zona_color = color  # Default to general color
                    if t in by_tooth and zona_name in by_tooth[t]["zonas"]:
                        zona_color = by_tooth[t]["zonas"][zona_name].get("color", color)
                    x_pos = x + xo
                    y_pos = y + yo
                    draw.rectangle([x_pos, y_pos, x_pos + w_z, y_pos + h_z], 
                                  fill=zona_color, outline='black')
                
                # Dibujar borde del diente completo
                draw.rectangle([x, y, x+size, y+size], outline='black')
                
                # Dibujar número del diente
                if font:
                    draw.text((x, y + size + 8), str(t), fill='black', font=font)
                else:
                    draw.text((x, y + size + 8), str(t), fill='black')
                
                # Dibujar símbolos debajo del diente si existen condiciones
                # Crear una lista de símbolos con sus colores correspondientes
                symbol_data = []
                
                # Símbolos del diente completo (general)
                if t in by_tooth and by_tooth[t]["general"] is not None:
                    estado_general = by_tooth[t]["general"].get("estado", "")
                    if estado_general:
                        conditions = [c.strip() for c in estado_general.split(',')]
                        for condition in conditions:
                            if condition in self.CONDITION_SYMBOLS:
                                symbol = self.CONDITION_SYMBOLS[condition]
                                color = self.CONDITION_COLORS.get(condition, 'black')
                                symbol_data.append((symbol, color))
                
                # Símbolos de las zonas específicas
                if t in by_tooth:
                    for zona_name, zona_data in by_tooth[t]["zonas"].items():
                        estado_zona = zona_data.get("estado", "")
                        if estado_zona:
                            conditions = [c.strip() for c in estado_zona.split(',')]
                            for condition in conditions:
                                if condition in self.CONDITION_SYMBOLS:
                                    symbol = self.CONDITION_SYMBOLS[condition]
                                    color = self.CONDITION_COLORS.get(condition, 'black')
                                    symbol_data.append((symbol, color))
                
                # Dibujar los símbolos debajo del diente
                if symbol_data:
                    symbols_x = x
                    for symbol, color in symbol_data:
                        if font:
                            draw.text((symbols_x, y + size + 25), symbol, fill=color, font=font)
                        else:
                            draw.text((symbols_x, y + size + 25), symbol, fill=color)
                        # Calcular el ancho aproximado del símbolo para posicionar el siguiente
                        symbols_x += 15  # Espaciado entre símbolos
                
                x += size + gap

        draw_row_with_symbols(teeth_top, y1, "Superior")
        draw_row_with_symbols(teeth_bot, y2, "Inferior")

        # Recortar la imagen para eliminar el espacio en blanco innecesario
        try:
            # Invertir la imagen para que el contenido sea blanco y el fondo negro
            inverted_img = Image.eval(img.convert('L'), lambda x: 255 - x)
            bbox = inverted_img.getbbox()
            if bbox:
                # Agregar un pequeño padding al recorte
                img = img.crop((bbox[0]-10, bbox[1]-10, bbox[2]+10, bbox[3]+10))
        except Exception as e:
            print(f"No se pudo recortar la imagen del odontograma: {e}")

        return img, descripcion

    def _generate_odontogram_description(self, odontogram_data):
        """Genera una descripción textual del odontograma"""
        if not odontogram_data:
            return "Sin registros en el odontograma."
        
        # Verificar si hay dientes primarios (niños) o permanentes (adultos)
        has_primary_teeth = any(51 <= record["diente"] <= 85 for record in odontogram_data)
        has_adult_teeth = any(11 <= record["diente"] <= 48 for record in odontogram_data)
        
        # Determinar el tipo de odontograma para la descripción
        if has_primary_teeth:
            tipo_odontograma = "Odontograma Infantil"
        elif has_adult_teeth:
            tipo_odontograma = "Odontograma Adulto"
        else:
            tipo_odontograma = "Odontograma"
        
        # Agrupar por diente, considerando tanto general como zonas específicas
        by_tooth = {}
        for record in odontogram_data:
            diente = record["diente"]
            if diente not in by_tooth:
                by_tooth[diente] = {"general": None, "zonas": {}}
            
            zona = record.get("zona")
            if zona is None:  # Diente completo
                by_tooth[diente]["general"] = record
            else:  # Zona específica
                by_tooth[diente]["zonas"][zona] = record
        
        descriptions = []
        for tooth_num in sorted(by_tooth.keys()):
            tooth_data = by_tooth[tooth_num]
            
            # Combinar condiciones generales y de zonas
            all_conditions = []
            
            # Añadir condición general del diente
            if tooth_data["general"] is not None:
                estado_general = tooth_data["general"]["estado"] or ""
                if estado_general:
                    estados = [e.strip() for e in estado_general.split(',') if e.strip()]
                    for estado in estados:
                        # Añadir sin repetir
                        if estado not in all_conditions:
                            all_conditions.append(estado)
            
            # Añadir condiciones de zonas específicas
            for zona_name, zona_data in tooth_data["zonas"].items():
                estado_zona = zona_data["estado"] or ""
                if estado_zona:
                    estados = [e.strip() for e in estado_zona.split(',') if e.strip()]
                    for estado in estados:
                        # Añadir sin repetir
                        if estado not in all_conditions:
                            all_conditions.append(estado)
            
            tooth_desc = f"Diente {tooth_num}: "
            if all_conditions:
                tooth_desc += ", ".join(all_conditions)
            else:
                tooth_desc += "Sin estado definido"
            
            # Añadir detalles específicos de zonas si existen
            zona_details = []
            for zona_name, zona_data in tooth_data["zonas"].items():
                zona_estado = zona_data["estado"] or "Sin estado"
                if zona_estado and ',' in zona_estado:
                    estados = [e.strip() for e in zona_estado.split(',')]
                    zona_estado = ", ".join(estados)
                nota = f" ({zona_data['nota']})" if zona_data.get("nota") else ""
                zona_details.append(f"{zona_name.capitalize()}: {zona_estado}{nota}")
            
            if zona_details:
                tooth_desc += f" | Zonas: " + "; ".join(zona_details)
            
            descriptions.append(tooth_desc)
        
        if descriptions:
            return f"{tipo_odontograma}:\n" + "\n".join(descriptions)
        else:
            return "Sin registros en el odontograma."

    def _on_canvas_double_click(self, ev):
        # Check if we have valid patient and visit
        if not self.patient_id or not self.visit_id:
            warn("Primero asegúrate de tener paciente y atención en curso.")
            return
            
        # Find which item was clicked using coordinates
        x, y = ev.x, ev.y
        clicked_items = self.canvas.find_overlapping(x, y, x, y)
        
        if not clicked_items:
            return
        
        # Find the most specific item that was clicked (smallest area)
        best_item = None
        smallest_area = float('inf')
        
        for item_id in clicked_items:
            if item_id in self.canvas_items:
                coords = self.canvas.coords(item_id)
                if len(coords) >= 4:  # Ensure we have x1, y1, x2, y2
                    area = (coords[2] - coords[0]) * (coords[3] - coords[1])
                    if area < smallest_area:
                        smallest_area = area
                        best_item = item_id
        
        if not best_item or best_item not in self.canvas_items:
            return

        diente, zona = self.canvas_items[best_item]
        
        selected_zona_str = self.zona_var.get()
        if selected_zona_str:
            zona = selected_zona_str.lower()

        color = self.color_var.get()

        current_state = ""
        current_nota = ""
        if self.visit_id:
            data_list = self.db.get_odontogram(self.visit_id)
            for d in data_list:
                if d["diente"] == diente and d.get("zona") == zona:
                    current_state = d.get("estado", "")
                    current_nota = d.get("nota", "")
                    break

        # Create a modal form for both state and note
        self._show_tooth_form(diente, zona, current_state, current_nota, color)

    def _show_tooth_form(self, diente, zona, current_state, current_nota, current_color):
        """Show a form to edit both state and note for a tooth"""
        top = tk.Toplevel(self)
        top.title(f"Diente {diente}" + (f" - Zona: {zona.capitalize()}" if zona else ""))
        top.geometry("500x400")
        top.transient(self)
        top.grab_set()

        ttk.Label(top, text=f"Diente: {diente}" + (f", Zona: {zona.capitalize()}" if zona else ""), 
                  font=("Arial", 12, "bold")).pack(pady=10)

        # Frame for conditions
        conditions_frame = ttk.LabelFrame(top, text="Condiciones del diente")
        conditions_frame.pack(fill="x", padx=20, pady=5)
        
        # Create a list of available conditions with symbols
        condition_options = [f"{self.CONDITION_SYMBOLS.get(cond, '')} {cond}" for cond in self.CONDITION_SYMBOLS.keys()]
        
        # Multi-select listbox for conditions
        list_frame = ttk.Frame(conditions_frame)
        list_frame.pack(fill="both", expand=True, padx=10, pady=5)
        
        # Listbox for conditions
        conditions_listbox = tk.Listbox(list_frame, selectmode=tk.MULTIPLE, height=6)
        conditions_listbox.pack(side="left", fill="both", expand=True)
        
        # Scrollbar for the listbox
        scrollbar = ttk.Scrollbar(list_frame, orient="vertical", command=conditions_listbox.yview)
        scrollbar.pack(side="right", fill="y")
        conditions_listbox.config(yscrollcommand=scrollbar.set)
        
        # Insert all conditions into the listbox
        for condition in condition_options:
            conditions_listbox.insert(tk.END, condition)
        
        # If there are current conditions, select them in the listbox
        if current_state:
            current_conditions = [c.strip() for c in current_state.split(',')]
            for i, opt in enumerate(condition_options):
                for cond in current_conditions:
                    if cond in opt:
                        conditions_listbox.selection_set(i)
                        break

        # Note field
        ttk.Label(top, text="Descripción / observación:").pack(anchor="w", padx=20, pady=(10, 0))
        nota_text = tk.Text(top, height=6, width=50)
        nota_text.pack(pady=5, padx=20, fill="both", expand=True)
        nota_text.insert("1.0", current_nota)

        # Color selection with visual preview
        color_frame = ttk.Frame(top)
        color_frame.pack(pady=10, padx=20, fill="x")
        ttk.Label(color_frame, text="Color:").pack(anchor="w")
        
        # Preview current color
        preview_frame = ttk.Frame(color_frame)
        preview_frame.pack(fill="x", pady=5)
        color_preview = tk.Canvas(preview_frame, width=100, height=30, bg=current_color)
        color_preview.pack(side="left", fill="x", expand=True)
        
        # Create visual color selector with color swatches
        swatch_frame = ttk.Frame(preview_frame)
        swatch_frame.pack(side="right", padx=(10, 0))
        
        # Use a temporary variable to hold the current color for this form
        form_color_var = tk.StringVar(value=current_color)
        
        for color in self.COLORS:
            btn = tk.Frame(swatch_frame, bg=color, width=20, height=20, relief="raised", bd=2)
            btn.pack(side="left", padx=2)
            btn.color = color  # Store the color in the widget
            
            def click_handler(col):
                return lambda e: form_color_var.set(col)
                
            btn.bind("<Button-1>", click_handler(color))
        
        # Update preview when color changes
        def update_color_preview(*args):
            selected_color = form_color_var.get()
            color_preview.config(bg=selected_color)
            
        form_color_var.trace_add("write", update_color_preview)
        
        # Buttons
        btn_frame = ttk.Frame(top)
        btn_frame.pack(pady=15)
        
        def save_tooth_data():
            # Get selected conditions
            selected_indices = conditions_listbox.curselection()
            selected_conditions = []
            for i in selected_indices:
                condition = conditions_listbox.get(i).split(' ', 1)[1]  # Remove symbol from selection
                selected_conditions.append(condition)
            
            # Join selected conditions with comma
            estado = ', '.join(selected_conditions)
            
            nota = nota_text.get("1.0", "end-1c").strip()
            color = form_color_var.get()  # Use the form's local color variable
            
            self.db.set_tooth_state(self.visit_id, self.patient_id, diente, estado or "", color, nota or "", zona=zona)
            self._load_odontogram_colors()
            
            # Actualizar los valores CPO después de guardar cambios
            self._calcular_actualizar_cpo()
            
            info(f"Diente {diente}{' ('+zona+')' if zona else ''} actualizado.")
            top.destroy()
        
        ttk.Button(btn_frame, text="Guardar", command=save_tooth_data).pack(side="left", padx=5)
        ttk.Button(btn_frame, text="Cancelar", command=top.destroy).pack(side="left", padx=5)
        
        # Bind Enter key to save
        top.bind('<Return>', lambda e: save_tooth_data())
        
        # Center the window
        top.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() // 2) - (top.winfo_width() // 2)
        y = self.winfo_y() + (self.winfo_height() // 2) - (top.winfo_height() // 2)
        top.geometry(f"+{x}+{y}")

    def _build_recetas(self):
        f = self.tab_recetas
        frm = ttk.LabelFrame(f, text="Nueva receta")
        frm.pack(fill="x", padx=8, pady=8)
        self.rec_diag = tk.Text(frm, height=3); self.rec_ind = tk.Text(frm, height=3); self.rec_meds = tk.Text(frm, height=3); self.rec_rec = tk.Text(frm, height=3)
        r=0
        ttk.Label(frm, text="Diagnóstico").grid(row=r, column=0, sticky="ne", padx=6, pady=4); self.rec_diag.grid(row=r, column=1, sticky="we")
        r+=1
        ttk.Label(frm, text="Indicaciones").grid(row=r, column=0, sticky="ne", padx=6, pady=4); self.rec_ind.grid(row=r, column=1, sticky="we")
        r+=1
        ttk.Label(frm, text="Medicamentos (1 por línea)").grid(row=r, column=0, sticky="nw", padx=6, pady=4); self.rec_meds.grid(row=r, column=1, sticky="we")
        r+=1
        ttk.Label(frm, text="Recomendaciones").grid(row=r, column=0, sticky="ne", padx=6, pady=4); self.rec_rec.grid(row=r, column=1, sticky="we")
        frm.columnconfigure(1, weight=1)

        btns = ttk.Frame(f); btns.pack(fill="x", padx=8, pady=8)
        ttk.Button(btns, text="Guardar receta y generar PDF", command=self._guardar_receta_pdf).pack(side="left", padx=4)
        ttk.Button(btns, text="Listar recetas del paciente", command=self._listar_recetas).pack(side="left", padx=4)

        self.tree_rec = ttk.Treeview(f, columns=("id","fecha","codigo","diagnostico"), show="headings", height=8)
        for c, w in [("id",60),("fecha",100),("codigo",160),("diagnostico",600)]:
            self.tree_rec.heading(c, text=c.upper()); self.tree_rec.column(c, width=w, anchor="w")
        self.tree_rec.pack(fill="both", expand=True, padx=8, pady=8)
        self.tree_rec.bind("<Double-1>", self._show_prescription_detail)

    def _guardar_receta_pdf(self):
        if not self.patient_id:
            warn("Selecciona/crea paciente primero.")
            return
        if not REPORTLAB_OK:
            err("Falta reportlab (pip install reportlab)")
            return
        
        rid, codigo = self.db.create_prescription(
            patient_id=self.patient_id, visit_id=self.visit_id,
            diagnostico=self.rec_diag.get("1.0", "end").strip(),
            indicaciones=self.rec_ind.get("1.0", "end").strip(),
            medicamentos=self.rec_meds.get("1.0", "end").strip(),
            recomendaciones=self.rec_rec.get("1.0", "end").strip(),
            fecha=today_iso()
        )
        try:
            path = self._write_prescription_pdf(rid)
            info(f"Receta guardada. Código: {codigo} PDF generado: {path}")
            self._listar_recetas()
        except Exception as e:
            err(f"Error al generar el PDF: {str(e)}")

    def _write_prescription_pdf(self, presc_id):
        presc = self.db.get_prescription_by_id(presc_id)
        if not presc: raise ValueError("No existe receta.")
        patient = self.db.find_patient_by_id(presc["patient_id"])
        
        fn = f"Receta_{presc['codigo_unico']}.pdf"
        
        # Crear la ruta en la subcarpeta de recetas del paciente
        from utils import DOCS_DIR
        patient_dir = os.path.join(DOCS_DIR, str(patient['id']))
        prescriptions_dir = os.path.join(patient_dir, "recetas")
        os.makedirs(prescriptions_dir, exist_ok=True)
        
        fpath = os.path.join(prescriptions_dir, fn)

        c = pdfcanvas.Canvas(fpath, pagesize=A4)
        w, h = A4 # Ancho y alto de la página
        x0 = 2*cm # Margen izquierdo
        y_current = h - 2*cm # Posición Y actual, se ajustará
        
        # Agregar logotipo si está disponible
        logo_path = os.path.join(APP_DIR, "CIDENT.png")
        if os.path.exists(logo_path):
            try:
                # Ajustar dimensiones y posición del logotipo (más pequeño y arriba a la derecha)
                c.drawImage(logo_path, w - 4.5*cm, h - 3.5*cm, width=2.5*cm, height=2*cm)
            except:
                # Si hay problemas con la imagen (ej. formato no soportado o ruta incorrecta), continuar sin logotipo
                pass
        
        # Encabezado con título de la receta
        c.setFont("Helvetica-Bold", 18)
        # Usar un color para el título (si se puede)
        # c.setFillColorRGB(0.2, 0.4, 0.7)  # Color azul oscuro
        c.drawString(x0, h - 2.2*cm, "RECETA ODONTOLÓGICA") # Título elevado para mejor alineación visual con el logo
        
        # Línea divisoria decorativa
        y_current = h - 3.7*cm # Posicionar la línea justo debajo del logo
        c.setLineWidth(2)
        c.line(x0, y_current, w - x0, y_current)  # Línea gruesa
        c.setLineWidth(1)  # Restaurar grosor de línea
        y_current -= 0.5*cm # Dejar un pequeño espacio después de la línea
        
        # Información del código y fecha
        c.setFont("Helvetica", 11)
        c.drawString(x0, y_current, f"Código: {presc['codigo_unico']}")
        c.drawString(w - 6*cm, y_current, f"Fecha: {presc['fecha']}")
        y_current -= 0.6*cm
        
        # Información del paciente
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x0, y_current, "Paciente:")
        c.setFont("Helvetica", 11)
        c.drawString(x0 + 2*cm, y_current, f"{patient['apellidos']}, {patient['nombres']}")
        y_current -= 0.4*cm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x0, y_current, "Cédula:")
        c.setFont("Helvetica", 11)
        c.drawString(x0 + 2*cm, y_current, f"{patient['cedula']}")
        y_current -= 0.4*cm
        # Mostrar alergias si existen
        if patient.get("alergias"):
            c.setFont("Helvetica-Bold", 11)
            c.drawString(x0, y_current, "Alergias:")
            c.setFont("Helvetica", 11)
            c.drawString(x0 + 2*cm, y_current, f"{patient['alergias']}")
            y_current -= 0.6*cm
        y_current -= 0.6*cm
        
        # Función para bloques de información con mejor formato
        def block(title, text):
            nonlocal y_current
            # Resaltar el título con un fondo ligero
            title_width = c.stringWidth(title, "Helvetica-Bold", 12)
            c.setFillColorRGB(0.9, 0.95, 1)  # Fondo azul claro
            c.rect(x0, y_current - 0.2*cm, title_width + 0.5*cm, 0.5*cm, fill=True, stroke=False)
            c.setFillColorRGB(0, 0, 0)  # Restaurar color negro
            
            c.setFont("Helvetica-Bold", 12)
            c.drawString(x0, y_current, title)
            y_current -= 0.6*cm
            c.setFont("Helvetica", 10)
            
            # Procesar el texto para dividir líneas largas
            if text:
                for line in (text or "").splitlines():
                    if line.strip():
                        # Dividir línea si es muy larga
                        current_line = ""
                        words = line.split(' ')
                        for word in words:
                            test_line = current_line + ' ' + word if current_line else word
                            text_width = c.stringWidth(test_line, "Helvetica", 10)
                            if text_width <= (w - 4*cm):
                                current_line = test_line
                            else:
                                if current_line:
                                    c.drawString(x0, y_current, current_line)
                                    y_current -= 0.4*cm
                                current_line = word
                        if current_line:
                            c.drawString(x0, y_current, current_line)
                            y_current -= 0.4*cm
                    else:
                        y_current -= 0.4*cm  # Espacio para líneas vacías
            else:
                c.drawString(x0, y_current, "—")
                y_current -= 0.4*cm
            
            y_current -= 0.4*cm
        
        # Dibujar cada bloque con el nuevo formato
        block("Diagnóstico:", presc["diagnostico"])
        block("Indicaciones:", presc["indicaciones"])
        block("Medicamentos:", presc["medicamentos"])
        block("Recomendaciones:", presc["recomendaciones"])
        
        # Pie de página con información de contacto
        y_current = 4*cm  # Ajustar la posición del pie de página
        c.setLineWidth(1.5)
        c.line(x0, y_current, w - x0, y_current)  # Línea divisoria
        c.setLineWidth(1)  # Restaurar grosor de línea
        y_current -= 0.8*cm
        
        c.setFont("Helvetica-Bold", 10)
        c.drawString(x0, y_current, "Clínica Dental CIDENT")
        y_current -= 0.4*cm
        c.setFont("Helvetica", 9)
        c.drawString(x0, y_current, "Dirección: [Dirección de la clínica] | Teléfono: [Teléfono de contacto]")
        y_current -= 0.3*cm
        c.drawString(x0, y_current, "Email: [Correo electrónico]")
        y_current -= 0.5*cm
        c.setFont("Helvetica", 8)
        c.drawString(x0, y_current, "Generado por el sistema el " + today_iso())
        
        c.showPage()
        c.save()
        
        self.db.update_prescription_pdf_path(presc_id, fpath)
        return fpath

    def _listar_recetas(self):
        self.tree_rec.delete(*self.tree_rec.get_children())
        if not self.patient_id: return
        for r in self.db.prescriptions_of_patient(self.patient_id):
            diag_truncado = (r["diagnostico"] or "")[:80]
            self.tree_rec.insert("", "end", values=(r["id"], r["fecha"], r["codigo_unico"], diag_truncado))

    def _show_prescription_detail(self, event):
        item = self.tree_rec.selection()
        if not item: return
        rec_id = int(self.tree_rec.item(item[0], "values")[0])
        
        row = self.db.get_prescription_by_id(rec_id)
        if not row:
            warn("Receta no encontrada."); return
        
        top = tk.Toplevel(self); top.title(f"Detalle Receta: {row['codigo_unico']}")
        top.geometry("800x800"); top.transient(self); top.grab_set()
        
        main_frame = ttk.Frame(top); main_frame.pack(fill="both", expand=True, padx=10, pady=10)
        ttk.Label(main_frame, text=f"RECETA ODONTOLÓGICA - {row['codigo_unico']}", font=("Arial", 14, "bold")).pack(anchor="w", pady=(0,10))
        
        patient = self.db.find_patient_by_id(row["patient_id"])
        if patient:
            pat_info = f"Paciente: {patient['apellidos']}, {patient['nombres']} | Cédula: {patient['cedula']}"
            ttk.Label(main_frame, text=pat_info, font=("Arial", 10)).pack(anchor="w", pady=(0,5))
        
        ttk.Label(main_frame, text=f"Fecha: {row['fecha']}", font=("Arial", 10)).pack(anchor="w", pady=(0,5))
        
        fields = [("Diagnóstico:", row["diagnostico"]), ("Indicaciones:", row["indicaciones"]), ("Medicamentos:", row["medicamentos"]), ("Recomendaciones:", row["recomendaciones"])]
        for title, content in fields:
            ttk.Label(main_frame, text=title, font=("Arial", 11, "bold")).pack(anchor="w", pady=(10,2))
            txt = tk.Text(main_frame, height=6, wrap="word", state="disabled", bg="white", relief="sunken")
            txt.pack(fill="x", padx=5, pady=(0,10))
            txt.config(state="normal"); txt.insert("1.0", content or "—"); txt.config(state="disabled")
        
        btn_frame = ttk.Frame(main_frame); btn_frame.pack(fill="x", pady=10)
        ttk.Button(btn_frame, text="Imprimir Receta", command=lambda: self._print_prescription(rec_id)).pack(side="left", padx=5)

    def _show_certificate_form(self):
        """Show form to create a medical certificate"""
        if not self.patient_id:
            warn("Primero seleccione un paciente.")
            return
            
        # Create a new window for the certificate form
        top = tk.Toplevel(self)
        top.title("Nuevo Certificado Médico")
        top.geometry("900x750")
        top.transient(self)
        top.grab_set()

        # Main frame
        main_frame = ttk.Frame(top)
        main_frame.pack(fill="both", expand=True, padx=10, pady=10)

        # Patient info
        patient = self.db.find_patient_by_id(self.patient_id)
        pat_info = f"Paciente: {patient['apellidos']}, {patient['nombres']} | Cédula: {patient['cedula']}"
        ttk.Label(main_frame, text=pat_info, font=("Arial", 12, "bold")).pack(anchor="w", pady=(0, 10))
        
        # Certificate type
        ttk.Label(main_frame, text="Tipo de Certificado:", font=("Arial", 10, "bold")).pack(anchor="w")
        cert_type_var = tk.StringVar(value="Certificado Médico")
        cert_types = ["Certificado Médico", "Certificado Dental", "Certificado de Consulta", "Otro"]
        cert_type_combo = ttk.Combobox(main_frame, textvariable=cert_type_var, values=cert_types, state="readonly")
        cert_type_combo.pack(fill="x", pady=(0, 10))
        
        # Prescription selection
        prescription_frame = ttk.LabelFrame(main_frame, text="Datos de la Receta")
        prescription_frame.pack(fill="x", pady=(0, 10))
        
        ttk.Label(prescription_frame, text="Seleccionar receta para obtener datos:", font=("Arial", 10, "bold")).pack(anchor="w")
        
        # Get all prescriptions for the patient
        prescriptions = self.db.prescriptions_of_patient(self.patient_id)
        
        # Create prescription options
        prescription_options = []
        prescription_dict = {}
        for presc in prescriptions:
            option_text = f"Receta {presc['id']} - {presc['fecha']} - {presc['codigo_unico']}"
            prescription_options.append(option_text)
            prescription_dict[option_text] = presc
        
        # Default to last prescription if available
        default_prescription = prescription_options[0] if prescription_options else ""
        
        prescription_var = tk.StringVar(value=default_prescription)
        prescription_combo = ttk.Combobox(prescription_frame, textvariable=prescription_var, values=prescription_options, state="readonly", width=50)
        prescription_combo.pack(fill="x", pady=(0, 5))
        
        # Function to update certificate content based on selected prescription
        def load_prescription_data():
            current_content = content_text.get("1.0", "end-1c")
            
            # Reset to default content with the original patient data
            original_default_date = prescriptions[0]['fecha'] if prescriptions else today_iso()
            reset_content = generate_sample_content(original_default_date)
            content_text.delete("1.0", "end")
            content_text.insert("1.0", reset_content)
            
            selected = prescription_var.get()
            if selected and selected in prescription_dict:
                presc_data = prescription_dict[selected]
                
                # Actualizar la fecha en el contenido del certificado
                if presc_data.get('fecha'):
                    current_content = content_text.get("1.0", "end-1c")
                    # Reemplazar la fecha actual (que podría ser today_iso() o de otra receta)
                    import re
                    updated_content = re.sub(r"en fecha \d{4}-\d{2}-\d{2}", f"en fecha {presc_data['fecha']}", current_content)
                    content_text.delete("1.0", "end")
                    content_text.insert("1.0", updated_content)
                
                # Load diagnosis, recommendations from prescription
                if presc_data.get('diagnostico'):
                    diagnosis_text.delete("1.0", "end")
                    diagnosis_text.insert("1.0", presc_data['diagnostico'])
                    # También actualizar el contenido del certificado
                    current_content = content_text.get("1.0", "end-1c")
                    updated_content = current_content.replace("[Especifique diagnóstico]", presc_data['diagnostico'])
                    content_text.delete("1.0", "end")
                    content_text.insert("1.0", updated_content)
                
                if presc_data.get('recomendaciones'):
                    recommendations_text.delete("1.0", "end")
                    recommendations_text.insert("1.0", presc_data['recomendaciones'])
                    # También actualizar el contenido del certificado
                    current_content = content_text.get("1.0", "end-1c")
                    updated_content = current_content.replace("[Especifique recomendaciones]", presc_data['recomendaciones'])
                    content_text.delete("1.0", "end")
                    content_text.insert("1.0", updated_content)
            
            # Load data from current visit if available
            if self.visit_id:
                visit_data = self.db.visit_by_id(self.visit_id)
                if visit_data:
                    # Load motivo de consulta from visit
                    if visit_data.get('motivo'):
                        # Replace placeholder in content with the actual motive
                        current_content = content_text.get("1.0", "end-1c")
                        updated_content = current_content.replace("[Especifique motivo]", visit_data['motivo'])
                        content_text.delete("1.0", "end")
                        content_text.insert("1.0", updated_content)
                    
                    # Load problema actual from visit
                    if visit_data.get('problema_actual'):
                        # Replace placeholder in content with the actual problem
                        current_content = content_text.get("1.0", "end-1c")
                        updated_content = current_content.replace("[Especifique procedimiento realizado]", visit_data['problema_actual'])
                        content_text.delete("1.0", "end")
                        content_text.insert("1.0", updated_content)

        # Add trace to automatically update when prescription selection changes
        def on_prescription_change(*args):
            # Small delay to ensure the variable has been updated
            top.after(10, load_prescription_data)
        
        prescription_var.trace_add("write", on_prescription_change)
        
        # Button to load data from selected prescription (for manual update)
        ttk.Button(prescription_frame, text="Cargar datos de la receta", command=load_prescription_data).pack(pady=(0, 5))
        
        # Content field
        ttk.Label(main_frame, text="Contenido del Certificado:", font=("Arial", 10, "bold")).pack(anchor="w", pady=(10, 0))
        content_text = tk.Text(main_frame, height=8, wrap="word")
        content_text.pack(fill="both", expand=True, pady=(0, 5))
        
        # Function to generate the default certificate content
        def generate_sample_content(date_str):
            return f"""Se certifica que {patient['nombres']} {patient['apellidos']}, portador(a) de la cédula de identidad No. {patient['cedula']},
fue atendido(a) en esta clínica dental en fecha {date_str}.

El motivo de la consulta fue: [Especifique motivo]

Situación actual: [Especifique procedimiento realizado]

Diagnóstico: [Especifique diagnóstico]

Recomendaciones: [Especifique recomendaciones]

Se expide el presente certificado a petición del interesado para los fines que considere convenientes."""
        
        # Usar la fecha de la última receta si existe, sino la fecha de hoy
        default_date = prescriptions[0]['fecha'] if prescriptions else today_iso()
        sample_content = generate_sample_content(default_date)
        content_text.insert("1.0", sample_content)
        
        # Diagnosis field
        ttk.Label(main_frame, text="Diagnóstico:", font=("Arial", 10, "bold")).pack(anchor="w", pady=(10, 0))
        diagnosis_text = tk.Text(main_frame, height=3, wrap="word")
        diagnosis_text.pack(fill="x", pady=(0, 5))
        
        # Recommendations field
        ttk.Label(main_frame, text="Recomendaciones:", font=("Arial", 10, "bold")).pack(anchor="w", pady=(5, 0))
        recommendations_text = tk.Text(main_frame, height=4, wrap="word")
        recommendations_text.pack(fill="x", pady=(0, 5))

        # If there's a prescription, load its data by default
        if prescriptions:
            last_prescription = prescriptions[0]  # Most recent first
            if last_prescription.get('diagnostico'):
                # Actualizar la fecha en el contenido del certificado
                if last_prescription.get('fecha'):
                    current_content = content_text.get("1.0", "end-1c")
                    import re
                    updated_content = re.sub(r"en fecha \d{4}-\d{2}-\d{2}", f"en fecha {last_prescription['fecha']}", current_content)
                    content_text.delete("1.0", "end")
                    content_text.insert("1.0", updated_content)

                diagnosis_text.delete("1.0", "end")
                diagnosis_text.insert("1.0", last_prescription['diagnostico'])
                # También actualizar el contenido del certificado
                current_content = content_text.get("1.0", "end-1c")
                updated_content = current_content.replace("[Especifique diagnóstico]", last_prescription['diagnostico'])
                content_text.delete("1.0", "end")
                content_text.insert("1.0", updated_content)

            
            if last_prescription.get('recomendaciones'):
                recommendations_text.delete("1.0", "end")
                recommendations_text.insert("1.0", last_prescription['recomendaciones'])
                # También actualizar el contenido del certificado
                current_content = content_text.get("1.0", "end-1c")
                updated_content = current_content.replace("[Especifique recomendaciones]", last_prescription['recomendaciones'])
                content_text.delete("1.0", "end")
                content_text.insert("1.0", updated_content)

        
        # If there's a current visit, load its data
        if self.visit_id:
            visit_data = self.db.visit_by_id(self.visit_id)
            if visit_data:
                # Update content with visit information
                current_content = content_text.get("1.0", "end-1c")
                if visit_data.get('motivo'):
                    current_content = current_content.replace("[Especifique motivo]", visit_data['motivo'])
                if visit_data.get('problema_actual'):
                    current_content = current_content.replace("[Especifique procedimiento realizado]", visit_data['problema_actual'])
                content_text.delete("1.0", "end")
                content_text.insert("1.0", current_content)

        # Initially load the data for the default selected prescription
        load_prescription_data()

        # Buttons
        btn_frame = ttk.Frame(main_frame)
        btn_frame.pack(fill="x", pady=20)
        
        def save_certificate():
            contenido = content_text.get("1.0", "end-1c")
            diagnostico = diagnosis_text.get("1.0", "end-1c").strip()
            recomendaciones = recommendations_text.get("1.0", "end-1c").strip()
            
            if not contenido.strip():
                warn("El contenido del certificado no puede estar vacío.")
                return
                
            # Create the certificate in the database
            cert_id = self.db.create_certificate(
                patient_id=self.patient_id,
                visit_id=self.visit_id,
                tipo=cert_type_var.get(),
                contenido=contenido,
                diagnostico=diagnostico if diagnostico else None,
                tratamiento=None,  # Treatment field removed
                recomendaciones=recomendaciones if recomendaciones else None
            )
            
            # Generate PDF
            pdf_path = self._write_certificate_pdf(cert_id)
            self.db.update_certificate_pdf_path(cert_id, pdf_path)
            
            info("Certificado guardado y PDF generado correctamente.")
            
            # Abrir el PDF generado automáticamente
            try:
                if os.name == 'nt': os.startfile(pdf_path)
                elif sys.platform == 'darwin': subprocess.run(['open', pdf_path])
                else: subprocess.run(['xdg-open', pdf_path])
            except Exception as e:
                err(f"No se pudo abrir el PDF automáticamente: {e}")
            
            top.destroy()
        
        ttk.Button(btn_frame, text="Guardar y Generar PDF", command=save_certificate).pack(side="left", padx=5)
        ttk.Button(btn_frame, text="Cancelar", command=top.destroy).pack(side="left", padx=5)
        
        # Center the window
        top.update_idletasks()
        x = self.winfo_x() + (self.winfo_width() // 2) - (top.winfo_width() // 2)
        y = self.winfo_y() + (self.winfo_height() // 2) - (top.winfo_height() // 2)
        top.geometry(f"+{x}+{y}")

    def _write_certificate_pdf(self, cert_id):
        """Generate a PDF for a medical certificate"""
        if not REPORTLAB_OK:
            raise Exception("Falta reportlab. Instala con: pip install reportlab")
            
        cert = self.db.get_certificate_by_id(cert_id)
        if not cert:
            raise ValueError("Certificado no encontrado.")
            
        patient = self.db.find_patient_by_id(cert["patient_id"])
        if not patient:
            raise ValueError("Paciente del certificado no encontrado.")
            
        # Generate filename
        fn = f"Certificado_{cert['id']}_{cert['fecha']}.pdf".replace(":", "-")
        
        # Create path in patient's certificate subfolder
        from utils import DOCS_DIR
        patient_dir = os.path.join(DOCS_DIR, str(patient['id']))
        certificates_dir = os.path.join(patient_dir, "certificados")
        os.makedirs(certificates_dir, exist_ok=True)
        
        fpath = os.path.join(certificates_dir, fn)

        # Create PDF
        c = pdfcanvas.Canvas(fpath, pagesize=A4)
        w, h = A4
        x0 = 2*cm
        y_current = h - 2*cm

        # Add logo if available
        logo_path = os.path.join(APP_DIR, "CIDENT.png")
        if os.path.exists(logo_path):
            try:
                c.drawImage(logo_path, w - 4.5*cm, h - 3.5*cm, width=2.5*cm, height=2*cm)
            except:
                pass

        # Header with title
        c.setFont("Helvetica-Bold", 18)
        c.drawString(x0, h - 2.2*cm, cert["tipo"])

        # Add title line
        y_current = h - 3.7*cm
        c.setLineWidth(2)
        c.line(x0, y_current, w - x0, y_current)
        c.setLineWidth(1)
        y_current -= 0.5*cm

        # Certificate ID and date
        c.setFont("Helvetica", 11)
        c.drawString(x0, y_current, f"Certificado ID: {cert['id']}")
        c.drawString(w - 6*cm, y_current, f"Fecha: {cert['fecha']}")
        y_current -= 0.7*cm

        # Patient information
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x0, y_current, "Paciente:")
        c.setFont("Helvetica", 11)
        c.drawString(x0 + 2*cm, y_current, f"{patient['apellidos']}, {patient['nombres']}")
        y_current -= 0.5*cm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(x0, y_current, "Cédula:")
        c.setFont("Helvetica", 11)
        c.drawString(x0 + 2*cm, y_current, f"{patient['cedula']}")
        y_current -= 1.2*cm

        # Add certificate content
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x0, y_current, "Contenido:")
        y_current -= 0.7*cm
        c.setFont("Helvetica", 10)
        
        # Add content text with line wrapping
        content_lines = cert["contenido"].split('\n')
        for line in content_lines:
            if line.strip():
                # Split long lines
                words = line.split(' ')
                current_line = ''
                
                for word in words:
                    test_line = current_line + ' ' + word if current_line else word
                    text_width = c.stringWidth(test_line, "Helvetica", 10)
                    
                    if text_width <= (w - 4*cm):
                        current_line = test_line
                    else:
                        if current_line:
                            c.drawString(x0, y_current, current_line)
                            y_current -= 0.5*cm
                        current_line = word
                        
                        # Check if we're near the bottom of the page
                    if y_current < 8*cm: # Adjusted to leave space for signature block
                            c.showPage()
                            y_current = h - 2*cm
                            c.setFont("Helvetica", 10)
                            
                if current_line:
                    c.drawString(x0, y_current, current_line)
                    y_current -= 0.5*cm
            else:
                # Empty line - add spacing
                y_current -= 0.5*cm
            
            # Check if we're near the bottom of the page
            if y_current < 8*cm: # Adjusted to leave space for signature block
                c.showPage()
                y_current = h - 2*cm
                c.setFont("Helvetica", 10)


        # Footer
        # Define fixed positions for the signature block and footer elements
        y_footer_line = 4*cm # Position of the horizontal line at the bottom

        # Odontologist's title and name (above the footer line)
        y_odontologo_title = y_footer_line + 0.5*cm # 0.5cm above the footer line
        y_odontologo_name = y_odontologo_title + 0.4*cm # Space for title text
        y_signature_bottom = y_odontologo_name + 0.5*cm # Space for name text + padding

        # Add signature image and odontologist details
        signature_path = os.path.join(APP_DIR, "FIRMA", "FIRMA.png")
        if os.path.exists(signature_path):
            try:
                c.drawImage(signature_path, x0, y_signature_bottom, width=5*cm, height=2*cm)
            except:
                pass # If image fails to load, continue without it

        c.setFont("Helvetica-Bold", 10)
        c.drawString(x0, y_odontologo_name, "Cintya Thalia Lojano V.")
        
        # Título del odontólogo
        c.setFont("Helvetica", 9)
        c.drawString(x0, y_odontologo_title, "ODONTOLOGA GENERAL")

        # Now, draw the footer line and contact info below it
        c.setLineWidth(1.5)
        c.line(x0, y_footer_line, w - x0, y_footer_line) # Draw the footer line
        c.setLineWidth(1)

        # Draw contact information (below the footer line)
        y_contact_info = y_footer_line - 0.6*cm # 0.6cm below the footer line
        c.setFont("Helvetica", 9)
        c.drawString(x0, y_contact_info, "Dirección: Av. Loja y Don Bosco  |  Teléfono: 0987654321  |  Email: cident@example.com")
        y_contact_info -= 0.45*cm
        
        # Fecha de generación
        c.setFont("Helvetica", 8)
        c.drawString(x0, y_contact_info, "Generado por el sistema el " + today_iso())

        c.showPage()
        c.save()
        
        return fpath

    def _print_prescription(self, prescription_id):
        presc = self.db.get_prescription_by_id(prescription_id)
        if not presc or not presc["pdf_path"]:
            warn("No se ha generado el PDF para esta receta."); return
        pdf_path = presc["pdf_path"]
        if not os.path.exists(pdf_path):
            warn("El archivo PDF no existe."); return
        try:
            if os.name == 'nt': os.startfile(pdf_path)
            elif sys.platform == 'darwin': subprocess.run(['open', pdf_path])
            else: subprocess.run(['xdg-open', pdf_path])
        except Exception as e:
            err(f"No se pudo abrir el PDF: {e}")

    def _build_consultas(self):
        f = self.tab_consultas
        filt = ttk.LabelFrame(f, text="Filtrar atenciones")
        filt.pack(fill="x", padx=8, pady=8)
        
        self.cons_q = tk.StringVar()
        
        ttk.Label(filt, text="Buscar paciente:").grid(row=0, column=0, sticky="e", padx=6, pady=4)
        ttk.Entry(filt, textvariable=self.cons_q, width=30).grid(row=0, column=1, sticky="w")
        
        ttk.Label(filt, text="Desde:").grid(row=1, column=0, sticky="e", padx=6)
        self.cons_from = DateEntry(filt, width=12, date_pattern='yyyy-mm-dd')
        self.cons_from.grid(row=1, column=1, sticky="w")
        
        ttk.Label(filt, text="Hasta:").grid(row=1, column=2, sticky="e", padx=6)
        self.cons_to = DateEntry(filt, width=12, date_pattern='yyyy-mm-dd')
        self.cons_to.grid(row=1, column=3, sticky="w")
        
        ttk.Button(filt, text="Buscar / Filtrar", command=self._refresh_consultas).grid(row=0, column=2, columnspan=2, padx=6)

        self.tree_cons = ttk.Treeview(f, columns=("vid","fecha","estado","paciente","cedula"), show="headings", height=14)
        for c, w in [("vid",60),("fecha",100),("estado",80),("paciente",420),("cedula",120)]:
            self.tree_cons.heading(c, text=c.upper()); self.tree_cons.column(c, width=w, anchor="w")
        self.tree_cons.pack(fill="both", expand=True, padx=8, pady=8)
        
        btns = ttk.Frame(f); btns.pack(fill="x", padx=8, pady=8)
        ttk.Button(btns, text="Cargar Paciente y Atención", command=self._cargar_desde_consulta).pack(side="left", padx=4)
        self.tree_cons.bind("<Double-1>", self._cargar_desde_consulta)

    def _refresh_consultas(self):
        self.tree_cons.delete(*self.tree_cons.get_children())
        q = self.cons_q.get().strip()
        from_d = self.cons_from.get_date().isoformat()
        to_d = self.cons_to.get_date().isoformat()

        results = []
        
        if q:
            # Search for specific patients
            patients_to_scan = self.db.search_patients(q)
            for p in patients_to_scan:
                if not p: continue
                for v in self.db.visits_of_patient(p["id"], from_d, to_d):
                    results.append((v, p))
        elif self.patient_id:
            # Show visits for the currently selected patient
            p = self.db.find_patient_by_id(self.patient_id)
            if p:
                for v in self.db.visits_of_patient(p["id"], from_d, to_d):
                    results.append((v, p))
        else:
            # Show all visits if no search term and no specific patient
            all_visits = self.db.get_all_visits(from_d, to_d)
            for v in all_visits:
                p = self.db.find_patient_by_id(v["patient_id"])
                if p:
                    results.append((v, p))

        for v, p in results:
            paciente = f"{p['apellidos']}, {p['nombres']}"
            self.tree_cons.insert("", "end", values=(v["id"], v["fecha"], v["estado"], paciente, p["cedula"]))

    def _cargar_desde_consulta(self, event=None):
        item = self.tree_cons.selection()
        if not item:
            warn("Selecciona una fila.")
            return
        vid = int(self.tree_cons.item(item[0], "values")[0])
        v = self.db.visit_by_id(vid)
        p = self.db.find_patient_by_id(v["patient_id"])
        
        self._load_patient_data(p)
        self._load_visit_data(v)
        info("Paciente y atención cargados.")

    def _build_adjuntos(self):
        f = self.tab_adjuntos
        btns = ttk.Frame(f); btns.pack(fill="x", padx=8, pady=8)
        ttk.Button(btns, text="Añadir adjunto", command=self._add_attachment).pack(side="left", padx=4)
        ttk.Button(btns, text="Refrescar", command=self._refresh_attachments).pack(side="left", padx=4)
        ttk.Button(btns, text="Abrir carpeta del paciente", command=self._open_patient_folder).pack(side="left", padx=4)

        self.tree_adj = ttk.Treeview(f, columns=("id","fecha","nombre","ruta"), show="headings", height=14)
        for c, w in [("id",60),("fecha",100),("nombre",360),("ruta",600)]:
            self.tree_adj.heading(c, text=c.upper()); self.tree_adj.column(c, width=w, anchor="w")
        self.tree_adj.pack(fill="both", expand=True, padx=8, pady=8)
        self.tree_adj.bind("<Double-1>", self._open_attachment)

    def _add_attachment(self):
        if not self.patient_id:
            warn("Primero selecciona/crea paciente.")
            return
        path = filedialog.askopenfilename(title="Selecciona archivo")
        if not path: return
        nombre = simpledialog.askstring("Nombre del adjunto", "Ej.: Radiografía panorámica", initialvalue=os.path.basename(path))
        if not nombre: return
        self.db.add_attachment(self.patient_id, self.visit_id, nombre, path)
        info("Adjunto guardado.")
        self._refresh_attachments()

    def _refresh_attachments(self):
        self.tree_adj.delete(*self.tree_adj.get_children())
        if not self.patient_id: return
        for a in self.db.attachments_of_patient(self.patient_id):
            self.tree_adj.insert("", "end", values=(a["id"], a["fecha"], a["nombre"], a["file_path"]))

    def _open_attachment(self, event):
        item = self.tree_adj.selection()
        if not item: return
        path = self.tree_adj.item(item[0], "values")[3]
        
        # Determinar tipo de archivo y manejar adecuadamente
        file_extension = os.path.splitext(path)[1].lower()
        image_extensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.tiff', '.webp']
        pdf_extensions = ['.pdf']
        text_extensions = ['.txt', '.doc', '.docx', '.rtf']
        
        if file_extension in image_extensions:
            # Mostrar vista previa de imagen en una ventana nueva
            self._show_image_preview(path)
        elif file_extension in pdf_extensions:
            # Intentar mostrar PDF si es posible, sino abrir externamente
            self._show_pdf_preview(path)
        elif file_extension in text_extensions:
            # Mostrar vista previa de texto
            self._show_text_preview(path)
        else:
            # Para otros tipos, abrir con la aplicación por defecto
            try:
                if os.name == "nt": os.startfile(path)
                elif sys.platform == "darwin": subprocess.run(['open', path])
                else: subprocess.run(['xdg-open', path])
            except Exception as e:
                err(f"No se pudo abrir el archivo. {e}")

    def _show_image_preview(self, image_path):
        """Mostrar vista previa de imagen en una ventana nueva"""
        try:
            from PIL import Image, ImageTk
            # Crear ventana para mostrar la imagen
            img_window = tk.Toplevel(self)
            img_window.title(f"Vista previa - {os.path.basename(image_path)}")
            img_window.geometry("800x600")
            
            # Cargar imagen
            img = Image.open(image_path)
            
            # Calcular dimensiones para no exceder la ventana
            img_width, img_height = img.size
            max_width, max_height = 750, 550
            
            scale = min(max_width/img_width, max_height/img_height)
            if scale < 1:  # Solo escalar si la imagen es más grande que la ventana
                new_width = int(img_width * scale)
                new_height = int(img_height * scale)
                img = img.resize((new_width, new_height), Image.Resampling.LANCZOS)
            
            # Convertir a PhotoImage
            photo = ImageTk.PhotoImage(img)
            
            # Crear label para mostrar la imagen
            img_label = tk.Label(img_window, image=photo)
            img_label.image = photo  # Mantener referencia
            img_label.pack(expand=True, fill='both')
            
            # Botón para cerrar
            ttk.Button(img_window, text="Cerrar", command=img_window.destroy).pack(pady=5)
            
        except Exception as e:
            warn(f"No se pudo mostrar la vista previa de la imagen: {e}")
            # Si falla, abrir con la aplicación por defecto
            try:
                if os.name == "nt": os.startfile(image_path)
                elif sys.platform == "darwin": subprocess.run(['open', image_path])
                else: subprocess.run(['xdg-open', image_path])
            except Exception as e2:
                err(f"No se pudo abrir el archivo. Error: {e2}")

    def _show_pdf_preview(self, pdf_path):
        """Mostrar mensaje o abrir PDF (la vista previa de PDF requiere bibliotecas adicionales)"""
        # Para una vista previa completa de PDF se necesitarían bibliotecas adicionales
        # como PyMuPDF o pdf2image. Por ahora, mostramos una opción básica
        from tkinter import messagebox
        result = messagebox.askyesno(
            "Vista previa de PDF", 
            f"¿Desea abrir el archivo PDF?\n\n{os.path.basename(pdf_path)}\n\n(Para vista previa completa se requiere instalación adicional)",
            icon='question'
        )
        if result:
            try:
                if os.name == "nt": os.startfile(pdf_path)
                elif sys.platform == "darwin": subprocess.run(['open', pdf_path])
                else: subprocess.run(['xdg-open', pdf_path])
            except Exception as e:
                err(f"No se pudo abrir el PDF: {e}")

    def _show_text_preview(self, text_path):
        """Mostrar vista previa de archivo de texto"""
        try:
            # Crear ventana para mostrar el texto
            text_window = tk.Toplevel(self)
            text_window.title(f"Vista previa - {os.path.basename(text_path)}")
            text_window.geometry("600x500")
            
            # Crear frame para el área de texto con scrollbar
            text_frame = ttk.Frame(text_window)
            text_frame.pack(fill='both', expand=True, padx=10, pady=10)
            
            # Crear text widget con scrollbar
            text_widget = tk.Text(text_frame, wrap='word')
            text_scrollbar = ttk.Scrollbar(text_frame, orient='vertical', command=text_widget.yview)
            text_widget.configure(yscrollcommand=text_scrollbar.set)
            
            text_widget.pack(side='left', fill='both', expand=True)
            text_scrollbar.pack(side='right', fill='y')
            
            # Leer y mostrar el contenido del archivo
            with open(text_path, 'r', encoding='utf-8') as f:
                content = f.read()
            text_widget.insert('1.0', content)
            text_widget.config(state='disabled')  # Solo lectura
            
            # Botón para cerrar
            ttk.Button(text_window, text="Cerrar", command=text_window.destroy).pack(pady=5)
            
        except Exception as e:
            warn(f"No se pudo leer el archivo de texto: {e}")
            try:
                if os.name == "nt": os.startfile(text_path)
                elif sys.platform == "darwin": subprocess.run(['open', text_path])
                else: subprocess.run(['xdg-open', path])
            except Exception as e2:
                err(f"No se pudo abrir el archivo: {e2}")

    def _open_patient_folder(self):
        """Abrir la carpeta de documentos del paciente actual en el explorador"""
        if not self.patient_id:
            warn("Primero debe seleccionar un paciente.")
            return
            
        from utils import DOCS_DIR
        import os
        patient_folder = os.path.join(DOCS_DIR, str(self.patient_id))
        
        # Asegurarse de que las subcarpetas existan
        os.makedirs(os.path.join(patient_folder, "recetas"), exist_ok=True)
        os.makedirs(os.path.join(patient_folder, "atencion"), exist_ok=True)
        os.makedirs(os.path.join(patient_folder, "adjuntos"), exist_ok=True)
        
        try:
            if os.name == "nt":  # Windows
                os.startfile(patient_folder)
            elif sys.platform == "darwin":  # macOS
                subprocess.run(["open", patient_folder])
            else:  # Linux y otros
                subprocess.run(["xdg-open", patient_folder])
        except Exception as e:
            err(f"No se pudo abrir la carpeta del paciente: {e}")