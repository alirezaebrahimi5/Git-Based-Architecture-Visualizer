package domain

// FileNode represents a file or directory in the repository.
type FileNode struct {
	Name      string     `json:"name"`
	Path      string     `json:"path"`
	IsDir     bool       `json:"isDir"`
	LineCount int        `json:"lineCount,omitempty"`
	FileSize  int64      `json:"fileSize,omitempty"`
	Language  string     `json:"language,omitempty"`
	Children  []FileNode `json:"children,omitempty"`
}

// CommitNode represents a Git commit.
type CommitNode struct {
	Hash    string   `json:"hash"`
	Message string   `json:"message"`
	Author  string   `json:"author"`
	Date    string   `json:"date"`
	Parents []string `json:"parents"`
}

// BranchInfo holds Git branch information.
type BranchInfo struct {
	Name string `json:"name"`
	Hash string `json:"hash"`
}

// RepoAnalysis aggregates all results from the repository analysis.
type RepoAnalysis struct {
	DirectoryTree  FileNode            `json:"directoryTree"`
	GitCommits     []CommitNode        `json:"gitCommits"`
	Branches       []BranchInfo        `json:"branches"`
	Files          []string            `json:"files"`
	Models         map[string]string   `json:"models"`
	DatabaseInfo   map[string][]string `json:"databaseInfo"`
	TotalLineCount int                 `json:"totalLineCount"`
	FileCount      int                 `json:"fileCount"`
	LanguageStats  map[string]int      `json:"languageStats"`
	LLMMermaid     string              `json:"llmMermaid"`
}
