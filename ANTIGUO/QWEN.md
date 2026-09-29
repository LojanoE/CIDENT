# QWEN Project Context: Dental Clinic Management System (CIDENT)

## Project Overview

This is a comprehensive desktop application for managing dental clinic operations built with Python and Tkinter. The application provides a complete Electronic Medical Record (EMR) solution for dental practices, called CIDENT.

**Main Technologies:**
*   **Language:** Python 3
*   **UI Framework:** Tkinter with ttk for themed widgets
*   **UI Enhancement Libraries:** `ttkthemes` for theme support, `tkcalendar` for date selection
*   **Database:** SQLite (via Python's built-in sqlite3)
*   **PDF Generation:** `reportlab`
*   **Image Processing:** `Pillow (PIL)`
*   **Storage:** File system for attachments and exports

**Key Features:**
*   **Patient Management:** Create, search, and update patient profiles with complete contact information
*   **Clinical Visits:** Record comprehensive visit details with support for draft and final statuses
*   **Interactive Odontogram:** Visual representation of teeth with color-coded status for different zones (Vestibular, Lingual, Mesial, Distal, Oclusal)
*   **Prescription Management:** Create and manage prescriptions with PDF export functionality featuring clinic logo
*   **File Attachments:** Upload and manage clinical documents, X-rays, and other files
*   **Dashboard:** Statistics and overview of clinic operations
*   **Search & Reporting:** Advanced search capabilities and PDF report generation
*   **Automatic Backups:** Database backup functionality with timestamped files
*   **Data Validation:** Input validation and type conversion utilities
*   **Birth Date Management:** Calculates patient age from birth date automatically
*   **Enhanced PDFs:** Includes odontogram images and descriptions in visit reports, and modern prescription format with logo

## Project Structure

```
C:\Users\DELL\Documents\PYTHON\14_CIDENT\
├── app.py              # Main UI application class (ThemedTk with tabbed interface)
├── CIDENT.png          # Clinic logo for PDF generation
├── database.py         # Database layer with SQLite schema and CRUD operations
├── main.py             # Application entry point
├── utils.py            # Utility functions, constants, and helpers
├── requirements.txt    # Project dependencies
├── data/               # Local data directory
│   └── docs/           # Patient file attachments
├── exports/            # Generated PDF exports
├── backups/            # Automatic database backups
└── .venv/              # Python virtual environment
```

## Building and Running

This is a Python application that can be run directly from the source code.

**1. Set up Python Environment:**
```sh
# Create and activate a virtual environment (recommended)
python -m venv .venv
.venv\Scripts\activate  # On Windows
# or
source .venv/bin/activate  # On macOS/Linux
```

**2. Install Dependencies:**
```sh
pip install -r requirements.txt
pip install Pillow  # for image processing in PDF generation
```

**3. Run the Application:**
```sh
python main.py
```

## Database Schema

The application uses SQLite with the following tables:

*   **patients:** Patient information (ID, cedula, names, contact details, fecha_nacimiento)
*   **visits:** Clinical visit records (ID, patient_id, date, clinical notes, status)
*   **odontogram:** Tooth condition records (ID, visit_id, patient_id, tooth number, zone, state, color, notes)
*   **prescriptions:** Medical prescriptions (ID, patient_id, visit_id, diagnosis, medications, PDF path)
*   **attachments:** File attachments (ID, patient_id, visit_id, file path, name)

## Development Conventions

*   **Entry Point:** `main.py` creates an instance of the `App` class from `app.py`
*   **Database:** The `DB` class in `database.py` handles all database operations
*   **UI Structure:** The `App` class extends `ThemedTk` and uses a tabbed interface (`ttk.Notebook`)
*   **File Organization:**
    *   `data/clinica.db` - Main SQLite database
    *   `data/docs/` - Patient document attachments
    *   `exports/` - Generated PDF files (reports and prescriptions)
    *   `backups/` - Automatic database backups with timestamped names
*   **Naming Conventions:** PEP 8 compliant with descriptive variable names
*   **Internationalization:** Spanish language interface (labels, messages, etc.)

## Key Classes and Functions

### App Class (`app.py`)
*   Extends `ThemedTk` with a custom theme ("radiance")
*   Implements tabbed interface with 7 tabs: Dashboard, Patient, Visit, Odontogram, Prescriptions, Consultations, Attachments
*   Manages state for current patient and visit
*   Handles UI events and database operations

### DB Class (`database.py`)
*   Manages SQLite database connection and schema
*   Provides CRUD operations for all entities (patients, visits, odontogram, prescriptions, attachments)
*   Implements automatic backup on data changes
*   Handles database schema creation and updates

### Utility Functions (`utils.py`)
*   Path management for various directories
*   Type conversion functions (`to_int`, `to_float`, `safe_str`)
*   Age calculation from birth date (`calcular_edad`)
*   UI messaging wrappers (`info`, `warn`, `err`, `yesno`)
*   Date utilities (`today_iso`)
*   Database backup functionality

## Special Features

*   **Interactive Odontogram:** Allows dentists to visually mark tooth conditions with different colors and zones
*   **Dual Visit Status:** Supports draft and final visit states for review workflow
*   **PDF Generation:** Creates professional reports and prescriptions in PDF format with clinic branding
*   **Automatic Backups:** Creates timestamped database backups when data is modified
*   **Search Functionality:** Comprehensive patient and visit search capabilities
*   **File Management:** Organized storage of patient documents and clinical files
*   **Birth Date Management:** Automatically calculates patient age from birth date
*   **Enhanced Recetas:** Modern PDF format with clinic logo and improved layout
*   **Odontogram Visualization:** Includes both image and textual description in visit reports