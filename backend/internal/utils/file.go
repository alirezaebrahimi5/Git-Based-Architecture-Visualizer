package utils

import (
	"os"
	"strings"
)

// CountFileLines reads the file at filePath and counts its newline characters.
func CountFileLines(filePath string) int {
	content, err := os.ReadFile(filePath)
	if err != nil {
		return 0
	}
	return strings.Count(string(content), "\n")
}
