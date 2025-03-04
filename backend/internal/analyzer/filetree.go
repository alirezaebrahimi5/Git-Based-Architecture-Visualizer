package analyzer

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"

	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/domain"
	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/utils"
)

// extensionLanguageMap maps file extensions to language names.
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
}

// BuildFileTree constructs a FileNode tree starting from rootPath. It also
// collects models and database info from model files.
func BuildFileTree(rootPath string) (domain.FileNode, map[string]string, map[string][]string, error) {
	rootNode := domain.FileNode{
		Name:  filepath.Base(rootPath),
		Path:  "",
		IsDir: true,
	}
	models := make(map[string]string)
	databaseInfo := make(map[string][]string)

	err := filepath.WalkDir(rootPath, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		relativePath := strings.TrimPrefix(path, rootPath)
		relativePath = strings.TrimPrefix(relativePath, string(os.PathSeparator))
		if relativePath == "" {
			return nil
		}
		parts := strings.Split(relativePath, string(os.PathSeparator))
		currentNode := &rootNode

		for i, part := range parts {
			var child *domain.FileNode
			for j := range currentNode.Children {
				if currentNode.Children[j].Name == part {
					child = &currentNode.Children[j]
					break
				}
			}
			if child == nil {
				newNode := domain.FileNode{
					Name:  part,
					Path:  filepath.Join(currentNode.Path, part),
					IsDir: (i < len(parts)-1) || d.IsDir(),
				}
				currentNode.Children = append(currentNode.Children, newNode)
				child = &currentNode.Children[len(currentNode.Children)-1]
			}
			currentNode = child
		}

		if !d.IsDir() {
			info, err := d.Info()
			if err == nil {
				currentNode.FileSize = info.Size()
				currentNode.LineCount = utils.CountFileLines(path)
			}
			ext := filepath.Ext(d.Name())
			if lang, ok := extensionLanguageMap[ext]; ok {
				currentNode.Language = lang
			}
			// Delegate model extraction for files in a "models" folder.
			if strings.Contains(strings.ToLower(filepath.Dir(path)), "models") && strings.HasSuffix(d.Name(), ".go") {
				content, dbInfo := AnalyzeModelFile(path)
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
