package analyzer

import (
	"io/ioutil"
	"regexp"
	"strings"
)

// AnalyzeModelFile analyzes a Go file for model definitions (e.g. GORM models)
// and extracts the file content and database-related info.
func AnalyzeModelFile(filePath string) (string, map[string][]string) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return "", nil
	}
	contentStr := string(content)
	dbInfo := extractDatabaseInfo(contentStr)
	return contentStr, dbInfo
}

// extractDatabaseInfo parses file content to find Go struct models and SQL table definitions.
func extractDatabaseInfo(content string) map[string][]string {
	dbInfo := make(map[string][]string)

	// Regex for Go struct models.
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

	// Regex for SQL table definitions.
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

// AnalyzeDjangoModels analyzes a Python file for Django model definitions.
// It returns a map where keys are model names and values are slices of strings
// representing each field definition in the format:
//
//	FieldName FieldType FieldArgs
//
// The regex now matches classes that inherit from models.Model, AbstractUser, or AbstractBaseUser.
func AnalyzeDjangoModels(filePath string) (map[string][]string, error) {
	result := make(map[string][]string)

	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return result, err
	}
	contentStr := string(content)

	// Updated regex to capture classes inheriting from models.Model, AbstractUser, or AbstractBaseUser.
	reModel := regexp.MustCompile(`(?ms)^class\s+(\w+)\s*\(.*?(?:models\.Model|AbstractUser|AbstractBaseUser).*?\):`)
	modelMatches := reModel.FindAllStringSubmatchIndex(contentStr, -1)
	if modelMatches == nil {
		return result, nil
	}

	// Process each Django model found.
	for i, match := range modelMatches {
		modelName := contentStr[match[2]:match[3]]
		startBlock := match[1]
		var endBlock int
		if i < len(modelMatches)-1 {
			endBlock = modelMatches[i+1][0]
		} else {
			endBlock = len(contentStr)
		}
		block := contentStr[startBlock:endBlock]

		// Regex to match field definitions within the model block.
		reField := regexp.MustCompile(`(?ms)^\s*(\w+)\s*=\s*models\.([A-Za-z0-9_]+)\((.*?)\)`)
		fieldMatches := reField.FindAllStringSubmatch(block, -1)
		var fields []string
		for _, fieldMatch := range fieldMatches {
			if len(fieldMatch) >= 4 {
				fieldName := strings.TrimSpace(fieldMatch[1])
				fieldType := strings.TrimSpace(fieldMatch[2])
				args := strings.TrimSpace(fieldMatch[3])
				fieldDetail := fieldName + " " + fieldType + " " + args
				fields = append(fields, fieldDetail)
			}
		}
		result[modelName] = fields
	}

	return result, nil
}
