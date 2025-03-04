package analyzer

import "alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/domain"

// ComputeAggregates recursively computes total line count, file count, and language statistics.
func ComputeAggregates(node domain.FileNode) (totalLines int, fileCount int, languageStats map[string]int) {
	languageStats = make(map[string]int)
	var rec func(n domain.FileNode)
	rec = func(n domain.FileNode) {
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
