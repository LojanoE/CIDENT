# GEMINI Project Context: Dental Clinic EMR

## Project Overview

This project is a desktop application for managing dental patient records (Electronic Medical Record - EMR). It is built with Python and uses the `tkinter` library for its graphical user interface.

The application provides a comprehensive solution for a dental practice, allowing users to manage patient information, track clinical visits, visualize dental history through an interactive odontogram, generate prescriptions, and attach relevant files like X-rays.

**Main Technologies:**
*   **Language:** Python 3
*   **UI:** `tkinter` (via `ttk` for a modern look)
*   **Database:** SQLite
*   **PDF Generation:** `reportlab`

**Key Features:**
*   **Patient Management:** Create, search, and update patient profiles.
*   **Clinical Visits:** Record detailed information for each patient visit, with a distinction between `draft` and `final` records.
*   **Interactive Odontogram:** A graphical interface to mark the status of each tooth (and specific zones on each tooth) with different colors and notes.
*   **Prescription Generation:** Create and manage medical prescriptions, including exporting them as PDF files with a unique code.
*   **File Attachments:** Upload and associate files (like images or documents) with a patient's record.
*   **Data Integrity:** The application uses a local SQLite database and performs automatic backups to the `/backups` directory upon making changes.
*   **Search & Reporting:** Functionality to search for patients and filter clinical visits by date. It can also generate a PDF summary of a visit.

## Building and Running

This is a Python application that can be run directly from the source code.

**1. Install Dependencies:**

The project requires the `reportlab` library to generate PDFs. You can install it using pip:

```sh
pip install reportlab
```

**2. Run the Application:**

The main entry point for the application appears to be `main_v4.py`. To run the application, execute the following command from the project root directory:

```sh
python main_v4.py
```

## Development Conventions

*   **Entry Point:** `main_v4.py` is the most recent and feature-complete version and should be considered the main file. Other `main_v*.py` and `clinica_odontologia.py` files appear to be older development versions.
*   **Database:** The database schema is defined in the `SCHEMA` string variable within the main Python file. The `DB` class encapsulates all database interactions. The database file is located at `data/clinica.db`.
*   **UI:** The user interface is built within the `App` class using `tkinter`. The UI is organized into a series of tabs (`ttk.Notebook`) for different functionalities (Patient, Visit, Odontogram, etc.).
*   **File Organization:**
    *   `data/clinica.db`: The main SQLite database.
    *   `data/docs/`: Stores file attachments for patients.
    *   `exports/`: Default location for exported PDF files (prescriptions, reports).
    *   `backups/`: Contains timestamped backups of the database, created automatically on data modification.
*   **Code Style:** The code is procedural with object-oriented elements. UI-building methods, database interaction methods, and event handlers are clearly separated within the `App` class.
