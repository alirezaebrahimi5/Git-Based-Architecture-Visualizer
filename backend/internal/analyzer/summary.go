package analyzer

import (
	"strconv"
	"strings"

	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/domain" // Adjust module path as needed.
)

// GenerateSummary creates a textual summary from the repository analysis.
func GenerateSummary(analysis domain.RepoAnalysis) string {
	var sb strings.Builder
	sb.WriteString("Repository Summary:\n")
	sb.WriteString("The repository contains ")
	sb.WriteString(strconv.Itoa(analysis.FileCount))
	sb.WriteString(" files with a total of ")
	sb.WriteString(strconv.Itoa(analysis.TotalLineCount))
	sb.WriteString(" lines.\n")
	sb.WriteString("Key components detected:\n")

	if len(analysis.Models) > 0 {
		sb.WriteString("- Model extraction from files in 'models' folders.\n")
	}
	if len(analysis.DatabaseInfo) > 0 {
		sb.WriteString("- Database extraction and table definitions found.\n")
	}
	if len(analysis.GitCommits) > 0 {
		sb.WriteString("- Git commit history analyzed.\n")
	}
	if len(analysis.Branches) > 0 {
		sb.WriteString("- Branch information is available.\n")
	}
	if len(analysis.LanguageStats) > 0 {
		sb.WriteString("- Languages used: ")
		langs := []string{}
		for lang, count := range analysis.LanguageStats {
			langs = append(langs, lang+":"+strconv.Itoa(count))
		}
		sb.WriteString(strings.Join(langs, ", "))
		sb.WriteString(".\n")
	}
	return sb.String()
}
