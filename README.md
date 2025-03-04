# Git Repository Visualizer

![Repository Diagram](/media/exp1.png)

The Git Repository Visualizer is a full‑stack application designed to analyze Git repositories and present a detailed, interactive view of their structure, Git history, branch details, and model/database information. The project’s architecture has been refactored into clean, modular components both on the backend and the frontend.

---

## Updated Architecture

### Backend

The backend is written in Go and organized using a clean architecture approach. Key modules and packages include:

- **Internals:**  
  Contains core business logic for repository analysis. Modules include:
  - **File & Directory Analysis:** Scans the repository to build a detailed file tree, count lines, and detect programming languages.
  - **Model & Database Extraction:** Extracts model definitions and database structures from source files. It supports both Go (e.g. GORM models) and Django (Python) model analysis.
  - **LLM Integration:** An optional module that interacts with a local LLM to generate Mermaid flowchart definitions from repository summaries.

- **Handlers:**  
  HTTP endpoint handlers that:
  - Expose the `/analyze` endpoint.
  - Process query parameters, invoke repository analysis services, and return structured JSON responses containing file tree, Git commit history, branch data, extracted models, and aggregated statistics.

- **Middlewares:**  
  Implements cross-cutting concerns such as CORS, logging, and error handling.

- **Third‑Party Libraries:**  
  - [go‑git](https://pkg.go.dev/github.com/go‑git/go‑git/v5) for Git operations.
  - [Gorilla Mux](https://github.com/gorilla/mux) for routing.

### Frontend

The frontend is built with React and uses D3.js for dynamic and interactive data visualizations. The code is modularized into reusable components:

- **Components:**
  - **RepoDiagram:** Displays the repository’s file/directory structure as a collapsible tree.
  - **DatabaseDiagram:** Renders a zoomable, pannable, and draggable database diagram with red relation lines to depict foreign key, one‑to‑one, and many‑to‑many relationships.
  - **GitCommitsDiagram:** Shows a timeline of recent Git commits.
  - **BranchesDiagram:** Displays branch information.
  - **MermaidDiagram:** Dynamically imports a Mermaid-based system diagram component.

- **Interactivity:**
  - Each diagram is designed to support zoom, pan, and drag interactions.
  - The DatabaseDiagram, for example, organizes tables and their relationships into separate SVG groups to ensure relation lines (rendered in red) always remain visible above the tables—even during drag events.

- **Technologies & Libraries:**
  - [React](https://reactjs.org/) for the component architecture.
  - [D3.js](https://d3js.org/) for custom SVG visualizations.
  - [Next.js](https://nextjs.org/) (with dynamic imports) for improved performance and SSR when needed.
  - [Mermaid](https://mermaid.js.org/) for generating flowchart diagrams.

---

## Features

- **Repository Analysis:**  
  Builds an enriched file tree with file size, line count, and language detection.
  
- **Model & Database Extraction:**  
  - Extracts database structure from both Go (e.g. GORM structs) and Django model files.
  - Detects field relations and displays them as red connection lines.

- **Git Integration:**  
  Retrieves the latest commits and branch details via go‑git.

- **Interactive Visualizations:**  
  - Collapsible directory tree.
  - Zoomable and draggable database diagram with relationship lines.
  - Git commit timeline and branch diagrams.
  - Mermaid-generated system diagram.

- **Advanced Interaction:**  
  The frontend supports zooming, panning, and dragging at both the overall diagram level (via a central transform group) and at the individual table level, ensuring smooth navigation even for large repositories.

---

## Getting Started

### Prerequisites

#### Backend
- Go (v1.16 or higher recommended)

#### Frontend
- Node.js (v14 or higher)
- npm or yarn

### Installation

#### Backend Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/alirezaebrahimi5/git-repo-visualizer.git
   cd git-repo-visualizer/backend
   ```

2. **Download Dependencies:**
   ```bash
   go mod download
   ```

3. **Run the Server:**
   ```bash
   go run main.go
   ```
   The server will run on [http://localhost:8080](http://localhost:8080).

#### Frontend Setup

1. **Navigate to the Frontend Directory:**
   ```bash
   cd ../frontend
   ```

2. **Install Dependencies:**
   ```bash
   npm install
   # or
   yarn install
   ```

3. **Start the React App:**
   ```bash
   npm run dev
   # or
   yarn dev
   ```
   The app typically runs on [http://localhost:3000](http://localhost:3000).

---

## API Endpoint

### `GET /analyze`

Analyzes the repository specified by the `repo` query parameter and returns a JSON object containing:

- **Directory Tree:** Detailed file tree with metrics.
- **Git Commits:** Latest commit data (up to 50 commits).
- **Branches:** Branch information.
- **Modified Files:** Files with recent changes (from Git status).
- **Models:** Extracted model definitions (source file content).
- **Database Info:** Field and relation data for the models.
- **Aggregated Statistics:** Total lines of code, file count, and language usage statistics.

**Example Request:**
```http
GET http://localhost:8080/analyze?repo=/path/to/your/repository
```

**Example Response:**
```json
{
  "directoryTree": { /* Detailed file tree structure */ },
  "gitCommits": [ /* Commit details */ ],
  "branches": [ /* Branch information */ ],
  "files": [ /* Modified files */ ],
  "models": { /* Model file contents */ },
  "databaseInfo": { /* Field and relation data */ },
  "totalLineCount": 12345,
  "fileCount": 67,
  "languageStats": {
    "Go": 42,
    "JavaScript": 25,
    "Python": 98,
    "Unknown": 0
  },
  "llmMermaid": "LLM Error: exit status 2"
}
```

---

## Project Structure

```
git-repo-visualizer/
├── backend/
│   ├── internals/           # Core business logic (file analysis, model extraction, LLM integration)
│   ├── handlers/            # HTTP endpoint handlers (e.g., /analyze)
│   ├── middlewares/         # CORS, logging, and other middleware
│   ├── main.go              # Application entry point
│   ├── go.mod               # Dependency management
│   └── (other supporting Go files)
└── frontend/
    ├── src/
    │   ├── components/      # Diagram components (RepoDiagram, DatabaseDiagram, etc.)
    │   ├── pages/           # Main pages (e.g., Home)
    │   └── styles/          # CSS and styling files
    ├── public/              # Public assets
    ├── package.json         # Frontend dependency management
    └── README.md            # Frontend-specific instructions
```

---

## Troubleshooting

- **Missing Repository Data:**  
  Ensure the provided repository path is correct and includes a `.git` folder.

- **CORS Issues:**  
  Verify the backend’s CORS middleware settings if the frontend cannot reach the backend.

- **Abstract User Model:**  
  The custom abstract User model (located in `apps/account/user.py`) is intentionally not included in the extracted database info since it is used only as a base class for authentication.

---

## Short Description

The Git Repository Visualizer is a full‑stack tool that analyzes local Git repositories. Its backend, written in Go and structured with clean architecture principles, extracts detailed file trees, model definitions, and Git history. The frontend, built with React and D3.js, provides interactive diagrams that allow users to explore repository structures, database models with relationship mapping, and Git commit history—all with smooth zoom, pan, and drag interactions.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [go‑git](https://github.com/go‑git/go‑git)
- [Gorilla Mux](https://github.com/gorilla/mux)
- [D3.js](https://d3js.org/)
- [React](https://reactjs.org/)
- [Mermaid](https://mermaid.js.org/)