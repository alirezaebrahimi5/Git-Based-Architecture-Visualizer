package handlers

import (
	"encoding/json"
	"net/http"

	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/analyzer"
)

// AnalyzeRepoHandler handles the /analyze endpoint.
func AnalyzeRepoHandler(w http.ResponseWriter, r *http.Request) {
	repoPath := r.URL.Query().Get("repo")
	if repoPath == "" {
		http.Error(w, "Missing repo query parameter", http.StatusBadRequest)
		return
	}

	analysis, err := analyzer.AnalyzeRepo(repoPath)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(analysis)
}
