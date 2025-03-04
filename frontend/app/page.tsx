"use client";
import React, { useState } from "react";
import RepoDiagram from "./components/RepoDiagram";
import DatabaseDiagram from "./components/DatabaseDiagram";
import GitCommitsDiagram from "./components/GitCommitsDiagram";
import BranchesDiagram from "./components/BranchesDiagram";
import dynamic from "next/dynamic";

const MermaidDiagram = dynamic(() => import("./components/MermaidDiagram"), { ssr: false });

interface RepoData {
  totalLineCount: number;
  fileCount: number;
  languageStats: Record<string, number>;
  directoryTree: any;
  databaseInfo: Record<string, string[]>;
  gitCommits: any[];
  branches: any[];
  llmMermaid: string;
}

export default function Home() {
  const [repoData, setRepoData] = useState<RepoData | null>(null);
  const [repoPath, setRepoPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [branchSpacing, setBranchSpacing] = useState(1);
  const [horizontalScale, setHorizontalScale] = useState(1);
  const [verticalSpacing, setVerticalSpacing] = useState(1);

  const handleFetch = async () => {
    setError(null);
    try {
      const response = await fetch(
        `http://127.0.0.1:8080/analyze?repo=${encodeURIComponent(repoPath)}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch repository data");
      }
      const data = await response.json();
      setRepoData(data);
      console.log("Fetched Data:", data);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Recursively filter out nodes named ".git" from the directory tree.
  const filterDirectoryTree = (node: any): any => {
    if (node.name === ".git") return null;
    const newNode = { ...node };
    if (newNode.children) {
      newNode.children = newNode.children.map(filterDirectoryTree).filter((child: any) => child !== null);
    }
    return newNode;
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Git Repository Visualizer</h1>
      <div className="my-4">
        <input
          type="text"
          placeholder="Enter repository path"
          value={repoPath}
          onChange={(e) => setRepoPath(e.target.value)}
          className="border px-2 py-1 mr-2"
        />
        <button onClick={handleFetch} className="bg-blue-500 text-white px-4 py-2 rounded">
          Analyze Repository
        </button>
      </div>
      <div className="my-4">
        <label className="mr-2 text-white">Branch Spacing Factor:</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={branchSpacing}
          onChange={(e) => setBranchSpacing(parseFloat(e.target.value))}
        />
        <span className="ml-2 text-white">{branchSpacing}</span>
      </div>
      <div className="my-4">
        <label className="mr-2 text-white">Horizontal Scale Factor:</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={horizontalScale}
          onChange={(e) => setHorizontalScale(parseFloat(e.target.value))}
        />
        <span className="ml-2 text-white">{horizontalScale}</span>
      </div>
      <div className="my-4">
        <label className="mr-2 text-white">Vertical Spacing Factor:</label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={verticalSpacing}
          onChange={(e) => setVerticalSpacing(parseFloat(e.target.value))}
        />
        <span className="ml-2 text-white">{verticalSpacing}</span>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {repoData && (
        <div>
          {/* Repository Statistics */}
          <h2 className="text-lg font-bold mt-4 text-white">Repository Statistics</h2>
          <div className="border bg-gray-100 p-2 mb-4 text-black">
            <p>Total Lines: {repoData.totalLineCount}</p>
            <p>File Count: {repoData.fileCount}</p>
            <div>
              <h3 className="font-bold">Languages Used:</h3>
              <ul>
                {Object.entries(repoData.languageStats).map(([lang, count]) => (
                  <li key={lang}>
                    {lang}: {count}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {/* Directory Tree Diagram */}
          <h2 className="text-lg font-bold mt-4 text-white">Directory Tree</h2>
          <div className="overflow-auto border bg-gray-100">
            <RepoDiagram
              directoryTree={filterDirectoryTree(repoData.directoryTree)}
              branchSpacing={branchSpacing}
              horizontalScale={horizontalScale}
              verticalSpacing={verticalSpacing}
            />
          </div>
          {/* Database Diagram */}
          <h2 className="text-lg font-bold mt-4 text-white">Database Diagram</h2>
          <div className="overflow-auto border bg-gray-100">
            <DatabaseDiagram databaseInfo={repoData.databaseInfo} />
          </div>
          {/* Git Commit History Diagram */}
          <h2 className="text-lg font-bold mt-4 text-white">Git Commit History</h2>
          <div className="overflow-auto border bg-gray-100">
            <GitCommitsDiagram gitCommits={repoData.gitCommits} />
          </div>
          {/* Branches Diagram */}
          <h2 className="text-lg font-bold mt-4 text-white">Branches</h2>
          <div className="overflow-auto border bg-gray-100">
            <BranchesDiagram branches={repoData.branches} />
          </div>
          {/* Mermaid (System) Diagram */}
          <h2 className="text-lg font-bold mt-4 text-white">System Diagram</h2>
          <div className="overflow-auto border bg-gray-100 p-2">
            <MermaidDiagram
              chart={
                "flowchart LR\n" +
                "A[Repo Analyzer] --> B[Database Extraction]\n" +
                "A --> C[Git Commits & Branches]\n" +
                "B --> D[Model & Relation Extraction]"
              }
            />
          </div>
        </div>
      )}
    </div>
  );
}
