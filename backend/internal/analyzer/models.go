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
				// Simply add the field line as is.
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
