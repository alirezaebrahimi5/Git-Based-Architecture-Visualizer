package analyzer

import (
	"io/ioutil"
	"regexp"
	"strings"
)

// AnalyzeModelFile reads the file at filePath and extracts model and database info.
func AnalyzeModelFile(filePath string) (string, map[string][]string) {
	content, err := ioutil.ReadFile(filePath)
	if err != nil {
		return "", nil
	}
	contentStr := string(content)
	dbInfo := extractDatabaseInfo(contentStr)
	return contentStr, dbInfo
}

// extractDatabaseInfo parses file content for Go struct and SQL table definitions.
func extractDatabaseInfo(content string) map[string][]string {
	dbInfo := make(map[string][]string)

	// Match Go struct models (GORM-based).
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

	// Match SQL table definitions.
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
