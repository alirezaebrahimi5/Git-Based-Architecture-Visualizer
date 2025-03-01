// Backend (main.go)
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	"github.com/go-git/go-git/v5"
	"github.com/gorilla/mux"
)

type RepoStructure struct {
	Files []string `json:"files"`
}

func analyzeRepo(w http.ResponseWriter, r *http.Request) {
	repoPath := r.URL.Query().Get("repo")
	if repoPath == "" {
		http.Error(w, "Missing repo query parameter", http.StatusBadRequest)
		return
	}

	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		fmt.Printf("error: %v", err)
		http.Error(w, "Could not open repository", http.StatusInternalServerError)
		return
	}

	files := []string{}
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

	for file := range status {
		files = append(files, file)
	}

	response := RepoStructure{Files: files}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
	r := mux.NewRouter()
	r.HandleFunc("/analyze", analyzeRepo).Methods("GET")

	log.Println("Server running on http://localhost:8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
