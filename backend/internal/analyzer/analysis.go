package analyzer

import (
	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/domain" // Adjust module path as needed.
	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/llm"

	"github.com/go-git/go-git/v5"
)

// AnalyzeRepo orchestrates the entire repository analysis.
func AnalyzeRepo(repoPath string) (domain.RepoAnalysis, error) {
	var analysis domain.RepoAnalysis

	// Open the repository.
	repo, err := git.PlainOpen(repoPath)
	if err != nil {
		return analysis, err
	}

	// Build file tree and extract models/database info.
	rootNode, models, databaseInfo, err := BuildFileTree(repoPath)
	if err != nil {
		return analysis, err
	}

	// Compute aggregates.
	totalLines, fileCount, languageStats := ComputeAggregates(rootNode)

	// Get Git status (modified files).
	wt, err := repo.Worktree()
	if err != nil {
		return analysis, err
	}
	status, err := wt.Status()
	if err != nil {
		return analysis, err
	}
	var files []string
	for file := range status {
		files = append(files, file)
	}

	// Retrieve Git commits and branches.
	commits, err := GetGitCommits(repo)
	if err != nil {
		return analysis, err
	}
	branches, err := GetBranches(repo)
	if err != nil {
		return analysis, err
	}

	// Assemble analysis.
	analysis = domain.RepoAnalysis{
		DirectoryTree:  rootNode,
		GitCommits:     commits,
		Branches:       branches,
		Files:          files,
		Models:         models,
		DatabaseInfo:   databaseInfo,
		TotalLineCount: totalLines,
		FileCount:      fileCount,
		LanguageStats:  languageStats,
		LLMMermaid:     "", // Will be set below.
	}

	// Generate a textual summary from the analysis.
	summary := GenerateSummary(analysis)

	// Use LLM integration to generate a Mermaid diagram.
	mermaidDiagram, err := llm.GenerateMermaidFlowchart(summary)
	if err != nil {
		mermaidDiagram = "LLM Error: " + err.Error()
	}
	analysis.LLMMermaid = mermaidDiagram

	return analysis, nil
}
