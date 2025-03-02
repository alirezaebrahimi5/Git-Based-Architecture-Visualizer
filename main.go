package main

import (
	"encoding/json"
	"io/fs"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/go-git/go-git/v5"
	"github.com/gorilla/mux"
)

type FileNode struct {
	Name     string     `json:"name"`
	Path     string     `json:"path"`
	IsDir    bool       `json:"isDir"`
	Children []FileNode `json:"children,omitempty"`
}

type RepoAnalysis struct {
	Structure FileNode `json:"structure"`
	Files     []string `json:"files"`
}

func analyzeRepo(w http.ResponseWriter, r *http.Request) {
	repoPath := r.URL.Query().Get("repo")
	if repoPath == "" {
		http.Error(w, "Missing repo query parameter", http.StatusBadRequest)
		return
	}

	// Open the repository
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		http.Error(w, "Could not open repository", http.StatusInternalServerError)
		return
	}

	// Generate the file tree structure
	rootNode, err := buildFileTree(repoPath)
	if err != nil {
		http.Error(w, "Error reading repository structure", http.StatusInternalServerError)
		return
	}

	// Get modified files using Git status
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

	response := RepoAnalysis{
		Structure: rootNode,
		Files:     files,
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

// BuildFileTree recursively generates a tree of the file structure
func buildFileTree(rootPath string) (FileNode, error) {
	rootNode := FileNode{
		Name:  filepath.Base(rootPath),
		Path:  rootPath,
		IsDir: true,
	}

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		relativePath := strings.TrimPrefix(path, rootPath)
		relativePath = strings.TrimPrefix(relativePath, string(os.PathSeparator))

		if relativePath == "" {
			return nil
		}

		node := FileNode{
			Name:  d.Name(),
			Path:  relativePath,
			IsDir: d.IsDir(),
		}

		if d.IsDir() {
			subTree, err := buildFileTree(filepath.Join(rootPath, relativePath))
			if err != nil {
				return err
			}
			node.Children = subTree.Children
		}

		rootNode.Children = append(rootNode.Children, node)
		return nil
	})

	return rootNode, err
}

// corsMiddleware adds CORS headers to the HTTP response
func corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		// Handle preflight OPTIONS request
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

	// Apply CORS middleware
	http.Handle("/", corsMiddleware(r))

	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
