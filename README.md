![Repository Diagram](/media/exp1.png)


```markdown
# Git Repository Visualizer

The Git Repository Visualizer is a full-stack application that analyzes a Git repository and presents its structure, commit history, branch details, and model information using interactive visualizations.

## Overview

This project consists of two main parts:

- **Backend (Go):**  
  An HTTP server that scans a local Git repository, builds a detailed file tree (including file metrics and language statistics), extracts model and database information from source files, and retrieves Git commit and branch data using [go-git](https://pkg.go.dev/github.com/go-git/go-git/v5).

- **Frontend (React & D3.js):**  
  A web application that visualizes the repository analysis using interactive diagrams. Visualizations include a collapsible directory tree (or an alternative flow diagram), a database diagram, a Git commit history timeline, and branch information.

## Features

- **Repository Analysis:**  
  Builds a file tree with additional metadata (file size, line count, detected language).

- **Model & Database Extraction:**  
  Automatically extracts database table structures from model files (e.g., Go structs in "models" folders).

- **Git Integration:**  
  Retrieves the latest commits and branch details using the go-git library.

- **Interactive Visualizations:**  
  Displays:
  - A collapsible (click-to-expand) directory tree diagram.
  - A database diagram with draggable tables.
  - A Git commit timeline.
  - Branch information.

- **Zoom & Pan:**  
  Visualizations support zooming and panning to help navigate large repositories.

## Technologies Used

- **Backend:**  
  - [Go](https://golang.org/)
  - [go-git](https://pkg.go.dev/github.com/go-git/go-git/v5)
  - [Gorilla Mux](https://github.com/gorilla/mux)

- **Frontend:**  
  - [React](https://reactjs.org/)
  - [D3.js](https://d3js.org/)

## Getting Started

### Prerequisites

- **Backend:**  
  - Go (version 1.16 or higher recommended)

- **Frontend:**  
  - Node.js (version 14 or higher)
  - npm or yarn

### Installation

#### Backend Setup

1. **Clone the Repository:**
   ```bash
   git clone https://github.com/alirezaebrahimi5/git-repo-visualizer.git
   cd git-repo-visualizer/backend
   ```

2. **Download Dependencies:**
   If you are using Go modules, run:
   ```bash
   go mod download
   ```

3. **Run the Server:**
   ```bash
   go run main.go
   ```
   The server will start on [http://localhost:8080](http://localhost:8080).

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
   The application will typically run on [http://localhost:3000](http://localhost:3000).

## API Endpoint

### `GET /analyze`

Analyzes the repository specified by the `repo` query parameter and returns a JSON object containing:

- Directory tree with file metrics.
- Latest Git commits (up to 50).
- Branch information.
- Modified files from Git status.
- Extracted model and database details.
- Aggregated statistics (total lines, file count, language stats).

**Example Request:**
```http
GET http://localhost:8080/analyze?repo=/path/to/your/repository
```

**Example Response:**
```json
{
  "directoryTree": { /* File tree structure with metrics */ },
  "gitCommits": [ /* Array of commit details */ ],
  "branches": [ /* Array of branch info */ ],
  "files": [ /* List of modified files */ ],
  "models": { /* Extracted model file contents */ },
  "databaseInfo": { /* Extracted database info */ },
  "totalLineCount": 12345,
  "fileCount": 67,
  "languageStats": {
    "Go": 42,
    "JavaScript": 25,
    "Unknown": 0
  }
}
```

## Project Structure

```
git-repo-visualizer/
├── backend/
│   ├── main.go          # Go server and repository analysis code.
│   ├── go.mod           # Go modules file.
│   └── (other Go files)
└── frontend/
    ├── src/
    │   ├── App.js       # Main React component.
    │   └── components/  # React components including D3 visualization functions.
    ├── public/
    ├── package.json     # Frontend dependencies and scripts.
    └── README.md        # Frontend-specific instructions (if needed).
```

## Troubleshooting

- **.git Directory Not Displayed:**  
  The backend builds the file tree by processing every path from a single pass over the repository. Ensure the repository path is correct and that there is a `.git` folder present. The updated tree-building method now includes `.git` and all subdirectories.

- **CORS Issues:**  
  A basic CORS middleware is included in the Go server. Adjust the settings if necessary for your environment.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

## Acknowledgements

- [go-git](https://github.com/go-git/go-git)
- [Gorilla Mux](https://github.com/gorilla/mux)
- [D3.js](https://d3js.org/)
- [React](https://reactjs.org/)
