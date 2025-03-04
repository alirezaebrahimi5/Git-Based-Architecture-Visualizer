package analyzer

import (
	"io/fs"
	"io/ioutil"
	"os"
	"path/filepath"
	"regexp"
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

// BuildFileTree constructs a FileNode tree starting from rootPath.
// It collects model definitions and database info from files using framework‑specific analyzers.
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

		// Calculate relative path and create/traverse nodes.
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

		// Process files.
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

			// For Go files in "models" folders, use the Go analyzer.
			if strings.Contains(strings.ToLower(filepath.Dir(path)), "models") && strings.HasSuffix(d.Name(), ".go") {
				content, dbInfo := AnalyzeModelFile(path)
				models[relativePath] = content
				for k, v := range dbInfo {
					databaseInfo[k] = v
				}
			}

			// For Python files, check if they might contain Django models.
			if strings.HasSuffix(d.Name(), ".py") {
				contentBytes, err := os.ReadFile(path)
				if err == nil {
					contentStr := string(contentBytes)
					// Check for the Django model import.
					if strings.Contains(contentStr, "from django.db import models") {
						djangoModels, err := AnalyzeDjangoModels(path)
						if err == nil && len(djangoModels) > 0 {
							// Save the entire file content as a model file.
							models[relativePath] = contentStr
							// Merge extracted Django models (with fields) into databaseInfo.
							for modelName, fields := range djangoModels {
								databaseInfo[modelName] = fields
							}
						}
					}
				}
			}

			// TODO: Add analyzers for additional frameworks/languages (Rails, Node.js, etc.)
		}

		return nil
	})

	return rootNode, models, databaseInfo, err
}

// AnalyzeDjangoModels analyzes a Python file for Django model definitions.
// It returns a map where keys are model names and values are slices of strings
// representing each field definition in the desired format:
//
//	FieldName FieldType FieldArgs
//
// This updated version uses (?s) so that field definitions spanning multiple lines
// (which is common for relational fields) are correctly captured.
func AnalyzeDjangoModels(filePath string) (map[string][]string, error) {
	result := make(map[string][]string)

	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return result, err
	}
	contentStr := string(content)

	// Regex to match Django model class definitions.
	reModel := regexp.MustCompile(`(?m)^class\s+(\w+)\s*\(.*models\.Model\):`)
	modelMatches := reModel.FindAllStringSubmatchIndex(contentStr, -1)
	if modelMatches == nil {
		return result, nil
	}

	// Process each Django model found.
	for i, match := range modelMatches {
		modelName := contentStr[match[2]:match[3]]
		// Determine the block for the model.
		startBlock := match[1]
		var endBlock int
		if i < len(modelMatches)-1 {
			endBlock = modelMatches[i+1][0]
		} else {
			endBlock = len(contentStr)
		}
		block := contentStr[startBlock:endBlock]

		// Regex to match field definitions within the model block.
		// (?s) flag allows the dot to match newlines (to capture multi-line definitions).
		// This matches lines like:
		//     field_name = models.FieldType(arg1, arg2, ...)
		reField := regexp.MustCompile(`(?sm)^\s*(\w+)\s*=\s*models\.([A-Za-z0-9_]+)\((.*?)\)`)
		fieldMatches := reField.FindAllStringSubmatch(block, -1)
		var fields []string
		for _, fieldMatch := range fieldMatches {
			if len(fieldMatch) >= 4 {
				fieldName := strings.TrimSpace(fieldMatch[1])
				fieldType := strings.TrimSpace(fieldMatch[2])
				args := strings.TrimSpace(fieldMatch[3])
				// Format the field as: FieldName FieldType FieldArgs
				fieldDetail := fieldName + " " + fieldType + " " + args
				fields = append(fields, fieldDetail)
			}
		}
		result[modelName] = fields
	}

	return result, nil
}
