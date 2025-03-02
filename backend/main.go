package main

import (
	"encoding/json"
	"io/fs"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
	"github.com/gorilla/mux"
)

// FileNode now includes extra properties for files.
type FileNode struct {
	Name      string     `json:"name"`
	Path      string     `json:"path"`
	IsDir     bool       `json:"isDir"`
	LineCount int        `json:"lineCount,omitempty"`
	FileSize  int64      `json:"fileSize,omitempty"`
	Language  string     `json:"language,omitempty"`
	Children  []FileNode `json:"children,omitempty"`
}

type CommitNode struct {
	Hash    string   `json:"hash"`
	Message string   `json:"message"`
	Author  string   `json:"author"`
	Date    string   `json:"date"`
	Parents []string `json:"parents"`
}

type BranchInfo struct {
	Name string `json:"name"`
	Hash string `json:"hash"`
}

type RepoAnalysis struct {
	DirectoryTree  FileNode            `json:"directoryTree"`
	GitCommits     []CommitNode        `json:"gitCommits"`
	Branches       []BranchInfo        `json:"branches"`
	Files          []string            `json:"files"`
	Models         map[string]string   `json:"models"`
	DatabaseInfo   map[string][]string `json:"databaseInfo"`
	TotalLineCount int                 `json:"totalLineCount"`
	FileCount      int                 `json:"fileCount"`
	LanguageStats  map[string]int      `json:"languageStats"`
}

// extensionLanguageMap provides a basic mapping from file extensions to a language name.
var extensionLanguageMap = map[string]string{
	".go":   "Go",
	".js":   "JavaScript",
	".ts":   "TypeScript",
	".py":   "Python",
	".java": "Java",
	".c":    "C",
	".cpp":  "C++",
	".cs":   "C#",
	".rb":   "Ruby",
	".php":  "PHP",
	".html": "HTML",
	".css":  "CSS",
	".json": "JSON",
	".xml":  "XML",
	".sh":   "Shell",
	".md":   "Markdown",
	// Add more mappings as needed.
}

// countFileLines reads the file and counts the number of newline characters.
func countFileLines(filePath string) int {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return 0
	}
	return strings.Count(string(content), "\n")
}

// extractDatabaseInfo extracts table structures from model files.
func extractDatabaseInfo(content string) map[string][]string {
	dbInfo := make(map[string][]string)

	// Match Go struct models (GORM-based)
	goStructPattern := `type\s+(\w+)\s+struct\s+\{([^}]+)\}`
	reGoStruct := regexp.MustCompile(goStructPattern)

	matches := reGoStruct.FindAllStringSubmatch(content, -1)
	for _, match := range matches {
		if len(match) > 2 {
			tableName := match[1]
			fields := strings.Split(match[2], "\n")
			for _, field := range fields {
				field = strings.TrimSpace(field)
				if field == "" {
					continue
				}
				dbInfo[tableName] = append(dbInfo[tableName], field)
			}
		}
	}

	// Match SQL tables
	sqlTablePattern := `CREATE\s+TABLE\s+(\w+)\s*\(([^)]+)\)`
	reSQLTable := regexp.MustCompile(sqlTablePattern)

	sqlMatches := reSQLTable.FindAllStringSubmatch(content, -1)
	for _, match := range sqlMatches {
		if len(match) > 2 {
			tableName := match[1]
			fields := strings.Split(match[2], ",")
			for _, field := range fields {
				field = strings.TrimSpace(field)
				dbInfo[tableName] = append(dbInfo[tableName], field)
			}
		}
	}

	return dbInfo
}

// analyzeModelFiles reads file content and analyzes models.
func analyzeModelFiles(filePath string) (string, map[string][]string) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return "", nil
	}

	contentStr := string(content)
	dbInfo := extractDatabaseInfo(contentStr)

	return contentStr, dbInfo
}

// buildFileTree constructs a FileNode tree and collects models and database info.
// It also collects file size, line count, and language for each file.
// buildFileTree constructs a FileNode tree without double-recursing.
// It also collects models and database info, and records file size, line count, and language.
func buildFileTree(rootPath string) (FileNode, map[string]string, map[string][]string, error) {
	rootNode := FileNode{
		Name:  filepath.Base(rootPath),
		Path:  "",
		IsDir: true,
	}
	models := make(map[string]string)
	databaseInfo := make(map[string][]string)

	// Walk through all files and directories starting from rootPath.
	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relativePath := strings.TrimPrefix(path, rootPath)
		relativePath = strings.TrimPrefix(relativePath, string(os.PathSeparator))
		// Skip the root itself.
		if relativePath == "" {
			return nil
		}
		// Split the relative path into parts.
		parts := strings.Split(relativePath, string(os.PathSeparator))
		currentNode := &rootNode

		// Traverse (or create) the node for each part.
		for i, part := range parts {
			// Check if this part already exists as a child.
			var child *FileNode
			for j := range currentNode.Children {
				if currentNode.Children[j].Name == part {
					child = &currentNode.Children[j]
					break
				}
			}
			// If not found, create a new node.
			if child == nil {
				newNode := FileNode{
					Name: part,
					Path: filepath.Join(currentNode.Path, part),
					// A node is a directory if it's not the last part or if WalkDir says it’s a directory.
					IsDir: (i < len(parts)-1) || d.IsDir(),
				}
				currentNode.Children = append(currentNode.Children, newNode)
				child = &currentNode.Children[len(currentNode.Children)-1]
			}
			currentNode = child
		}

		// For files, record extra details.
		if !d.IsDir() {
			info, err := d.Info()
			if err == nil {
				currentNode.FileSize = info.Size()
				currentNode.LineCount = countFileLines(path)
			}
			ext := filepath.Ext(d.Name())
			if lang, ok := extensionLanguageMap[ext]; ok {
				currentNode.Language = lang
			}
			// If the file is in a "models" folder and is a Go file, process for model extraction.
			if strings.Contains(strings.ToLower(filepath.Dir(path)), "models") && strings.HasSuffix(d.Name(), ".go") {
				content, dbInfo := analyzeModelFiles(path)
				models[relativePath] = content
				for k, v := range dbInfo {
					databaseInfo[k] = v
				}
			}
		}

		return nil
	})

	return rootNode, models, databaseInfo, err
}

// computeAggregates recursively computes total lines, file count, and language stats from a FileNode tree.
func computeAggregates(node FileNode) (totalLines int, fileCount int, languageStats map[string]int) {
	languageStats = make(map[string]int)
	var rec func(n FileNode)
	rec = func(n FileNode) {
		if !n.IsDir {
			fileCount++
			totalLines += n.LineCount
			lang := n.Language
			if lang == "" {
				lang = "Unknown"
			}
			languageStats[lang]++
		}
		for _, child := range n.Children {
			rec(child)
		}
	}
	rec(node)
	return totalLines, fileCount, languageStats
}

// getGitCommits retrieves Git commits (limit to latest 50).
func getGitCommits(repo *git.Repository) ([]CommitNode, error) {
	commits := []CommitNode{}
	commitIter, err := repo.Log(&git.LogOptions{})
	if err != nil {
		return nil, err
	}
	defer commitIter.Close()

	for i := 0; i < 50; i++ {
		c, err := commitIter.Next()
		if err != nil {
			break
		}
		commitNode := CommitNode{
			Hash:    c.Hash.String(),
			Message: strings.Split(c.Message, "\n")[0],
			Author:  c.Author.Name,
			Date:    c.Author.When.Format("2006-01-02 15:04:05"),
			Parents: func() []string {
				var p []string
				for _, parent := range c.ParentHashes {
					p = append(p, parent.String())
				}
				return p
			}(),
		}
		commits = append(commits, commitNode)
	}
	return commits, nil
}

// getBranches retrieves branch information.
func getBranches(repo *git.Repository) ([]BranchInfo, error) {
	branches := []BranchInfo{}
	refIter, err := repo.Branches()
	if err != nil {
		return nil, err
	}
	err = refIter.ForEach(func(ref *plumbing.Reference) error {
		branches = append(branches, BranchInfo{
			Name: ref.Name().Short(),
			Hash: ref.Hash().String(),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return branches, nil
}

// analyzeRepo analyzes the repository and returns model details along with aggregated file info.
func analyzeRepo(w http.ResponseWriter, r *http.Request) {
	repoPath := r.URL.Query().Get("repo")
	if repoPath == "" {
		http.Error(w, "Missing repo query parameter", http.StatusBadRequest)
		return
	}

	// Open the repository.
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		http.Error(w, "Could not open repository", http.StatusInternalServerError)
		return
	}

	// Generate the file tree structure (with extra file details).
	rootNode, models, databaseInfo, err := buildFileTree(repoPath)
	if err != nil {
		http.Error(w, "Error reading repository structure", http.StatusInternalServerError)
		return
	}

	// Compute aggregates: total lines, file count, language stats.
	totalLines, fileCount, languageStats := computeAggregates(rootNode)

	// Get modified files using Git status.
	wt, err := repo.Worktree()
	if err != nil {
		http.Error(w, "Could not access worktree", http.StatusInternalServerError)
		return
	}

	status, err := wt.Status()
	if err != nil {
		http.Error(w, "Could not retrieve repository status", http.StatusInternalServerError)
		return
	}

	files := []string{}
	for file := range status {
		files = append(files, file)
	}

	// Retrieve Git commits and branch info.
	commits, err := getGitCommits(repo)
	if err != nil {
		http.Error(w, "Could not retrieve git commits", http.StatusInternalServerError)
		return
	}

	branches, err := getBranches(repo)
	if err != nil {
		http.Error(w, "Could not retrieve branches", http.StatusInternalServerError)
		return
	}

	response := RepoAnalysis{
		DirectoryTree:  rootNode,
		GitCommits:     commits,
		Branches:       branches,
		Files:          files,
		Models:         models,
		DatabaseInfo:   databaseInfo,
		TotalLineCount: totalLines,
		FileCount:      fileCount,
		LanguageStats:  languageStats,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// corsMiddleware adds CORS headers.
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/analyze", analyzeRepo).Methods("GET")

	http.Handle("/", corsMiddleware(r))

	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
