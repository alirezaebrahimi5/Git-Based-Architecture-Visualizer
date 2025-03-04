package llm

import (
	"os/exec"
)

// GenerateMermaidFlowchart sends a prompt to a local LLM via a Python script
// and returns the generated Mermaid diagram definition.
func GenerateMermaidFlowchart(prompt string) (string, error) {
	cmd := exec.Command("python3", "generate_mermaid.py", prompt)
	output, err := cmd.Output()
	if err != nil {
		return "", err
	}
	return string(output), nil
}
