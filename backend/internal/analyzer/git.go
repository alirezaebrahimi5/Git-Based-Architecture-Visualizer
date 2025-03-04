package analyzer

import (
	"strings"

	"alirezaebrahimi5/Git-Based-Architecture-Visualizer/internal/domain"

	"github.com/go-git/go-git/v5"
	"github.com/go-git/go-git/v5/plumbing"
)

// GetGitCommits retrieves up to 50 recent commits from the repository.
func GetGitCommits(repo *git.Repository) ([]domain.CommitNode, error) {
	commits := []domain.CommitNode{}
	commitIter, err := repo.Log(&git.LogOptions{})
	if err != nil {
		return nil, err
	}
	defer commitIter.Close()

	for i := 0; i < 50; i++ {
		c, err := commitIter.Next()
		if err != nil {
			break
		}
		commitNode := domain.CommitNode{
			Hash:    c.Hash.String(),
			Message: strings.Split(c.Message, "\n")[0],
			Author:  c.Author.Name,
			Date:    c.Author.When.Format("2006-01-02 15:04:05"),
			Parents: getParents(c.ParentHashes),
		}
		commits = append(commits, commitNode)
	}
	return commits, nil
}

// getParents converts parent hashes to a slice of strings.
func getParents(parents []plumbing.Hash) []string {
	var p []string
	for _, parent := range parents {
		p = append(p, parent.String())
	}
	return p
}

// GetBranches retrieves branch information from the repository.
func GetBranches(repo *git.Repository) ([]domain.BranchInfo, error) {
	branches := []domain.BranchInfo{}
	refIter, err := repo.Branches()
	if err != nil {
		return nil, err
	}
	err = refIter.ForEach(func(ref *plumbing.Reference) error {
		branches = append(branches, domain.BranchInfo{
			Name: ref.Name().Short(),
			Hash: ref.Hash().String(),
		})
		return nil
	})
	if err != nil {
		return nil, err
	}
	return branches, nil
}
