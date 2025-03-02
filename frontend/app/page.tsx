"use client";
import React, { useEffect, useState, useRef } from "react";
import * as d3 from "d3";

export default function Home() {
  const [repoPath, setRepoPath] = useState("");
  const [repoData, setRepoData] = useState(null);
  const [error, setError] = useState(null);

  // SVG refs for the different diagrams
  const svgRepoRef = useRef(null);
  const svgDBRef = useRef(null);
  const svgGitCommitsRef = useRef(null);
  const svgBranchesRef = useRef(null);

  useEffect(() => {
    if (repoData) {
      // Draw the file directory tree using the "directoryTree" field.
      drawRepoDiagram(repoData.directoryTree);

      // Draw the database diagram
      if (repoData.databaseInfo) {
        drawDatabaseDiagram(repoData.databaseInfo);
      }

      // Draw Git commit history
      if (repoData.gitCommits) {
        drawGitCommitsDiagram(repoData.gitCommits);
      }

      // Draw branch information
      if (repoData.branches) {
        drawBranchesDiagram(repoData.branches);
      }
    }
  }, [repoData]);

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
    } catch (err) {
      setError(err.message);
    }
  };

  // Draw the file directory tree using d3.hierarchy and d3.tree
  const drawRepoDiagram = (directoryTree) => {
    d3.select(svgRepoRef.current).selectAll("*").remove();

    const width = 1600;
    const height = 800;
    const margin = { top: 40, right: 200, bottom: 50, left: 200 };

    const svg = d3
      .select(svgRepoRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom().scaleExtent([0.5, 2]).on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });
    d3.select(svgRepoRef.current).call(zoom);

    const root = d3.hierarchy(directoryTree, (d) => d.children);
    const treeLayout = d3.tree().size([height - 100, width - 400]);
    treeLayout(root);

    svg
      .selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#aaa")
      .attr("stroke-width", "2px")
      .attr("d", d3.linkHorizontal().x((d) => d.y).y((d) => d.x));

    const nodes = svg
      .selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    nodes
      .append("circle")
      .attr("r", 8)
      .style("fill", (d) => (d.data.isDir ? "#4CAF50" : "#2196F3"))
      .style("stroke", "#333")
      .style("stroke-width", "2px");

    nodes
      .append("text")
      .attr("dx", (d) => (d.children ? -12 : 12))
      .attr("dy", 5)
      .style("font-size", "14px")
      .style("fill", "#333")
      .style("user-select", "none")
      .text((d) => d.data.name);
  };

  // Draw the database diagram with improved table layout.
  // Now handles fields as strings. It splits each field string into tokens,
  // using the first token as the field name and the second as the type.
  const drawDatabaseDiagram = (databaseInfo) => {
    d3.select(svgDBRef.current).selectAll("*").remove();

    const svg = d3.select(svgDBRef.current)
      .attr("width", 1600)
      .attr("height", 800);

    const tableNames = Object.keys(databaseInfo);
    const numTables = tableNames.length;

    // Determine grid dimensions (roughly a square grid)
    const columns = Math.ceil(Math.sqrt(numTables));
    const tableWidth = 250;
    const horizontalSpacing = 50;

    tableNames.forEach((table, i) => {
      // Compute grid position
      const col = i % columns;
      const row = Math.floor(i / columns);
      const x = col * (tableWidth + horizontalSpacing) + 50;
      const y = row * 200 + 50; // 200 px height slot per table

      // Get field strings for the table (each string contains field definition)
      const fields = databaseInfo[table];

      // Define heights for different sections
      const tableNameHeight = 30;
      const columnHeaderHeight = 20;
      const fieldRowHeight = 20;
      const rectHeight = tableNameHeight + columnHeaderHeight + fields.length * fieldRowHeight;

      // Create a group for the table box
      const group = svg.append("g")
        .attr("transform", `translate(${x}, ${y})`);

      // Draw the outer rectangle for the table
      group.append("rect")
        .attr("width", tableWidth)
        .attr("height", rectHeight)
        .attr("fill", "#fff")
        .attr("stroke", "#000");

      // Add table name as header (centered)
      group.append("text")
        .attr("x", tableWidth / 2)
        .attr("y", tableNameHeight / 2 + 10)
        .attr("text-anchor", "middle")
        .attr("font-weight", "bold")
        .text(table);

      // Draw a horizontal line to separate the table name from the column headers
      group.append("line")
        .attr("x1", 0)
        .attr("y1", tableNameHeight)
        .attr("x2", tableWidth)
        .attr("y2", tableNameHeight)
        .attr("stroke", "#000");

      // Add column headers for "Field" and "Type"
      group.append("text")
        .attr("x", 5)
        .attr("y", tableNameHeight + columnHeaderHeight / 2 + 10)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("Field");

      group.append("text")
        .attr("x", tableWidth / 2)
        .attr("y", tableNameHeight + columnHeaderHeight / 2 + 10)
        .attr("font-size", "12px")
        .attr("font-weight", "bold")
        .text("Type");

      // Draw a vertical line to separate Field and Type columns
      group.append("line")
        .attr("x1", tableWidth / 2)
        .attr("y1", tableNameHeight)
        .attr("x2", tableWidth / 2)
        .attr("y2", rectHeight)
        .attr("stroke", "#000");

      // Draw each field row.
      // For each field string, split into tokens and extract field name and type.
      fields.forEach((fieldStr, j) => {
        const tokens = fieldStr.trim().split(/\s+/);
        const fieldName = tokens[0] || "";
        const fieldType = tokens[1] || "";
        const rowY = tableNameHeight + columnHeaderHeight + j * fieldRowHeight + fieldRowHeight / 1.5;

        group.append("text")
          .attr("x", 5)
          .attr("y", rowY)
          .attr("font-size", "12px")
          .text(fieldName);

        group.append("text")
          .attr("x", tableWidth / 2 + 5)
          .attr("y", rowY)
          .attr("font-size", "12px")
          .text(fieldType);
      });
    });

    // (Optional) Draw relationships between tables here if desired.
  };

  // Draw Git commits as a vertical list with connecting lines
  const drawGitCommitsDiagram = (gitCommits) => {
    d3.select(svgGitCommitsRef.current).selectAll("*").remove();

    const width = 800;
    const rowHeight = 50;
    const height = gitCommits.length * rowHeight + 50;

    const svg = d3.select(svgGitCommitsRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create a vertical list of commits
    gitCommits.forEach((commit, i) => {
      const y = i * rowHeight + 30;
      const group = svg.append("g")
        .attr("transform", `translate(20, ${y})`);

      // Draw a circle for the commit node
      group.append("circle")
        .attr("r", 8)
        .attr("fill", "#2196F3");

      // Draw commit details: short hash, message, author and date
      group.append("text")
        .attr("x", 20)
        .attr("y", 5)
        .style("font-size", "12px")
        .text(`${commit.hash.substring(0, 7)} - ${commit.message}`);

      group.append("text")
        .attr("x", 20)
        .attr("y", 20)
        .style("font-size", "10px")
        .style("fill", "#555")
        .text(`${commit.author} @ ${commit.date}`);
    });

    // Optionally, draw lines connecting the commit nodes vertically.
    for (let i = 0; i < gitCommits.length - 1; i++) {
      const y1 = i * rowHeight + 30;
      const y2 = (i + 1) * rowHeight + 30;
      svg.append("line")
        .attr("x1", 20)
        .attr("y1", y1)
        .attr("x2", 20)
        .attr("y2", y2)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 2);
    }
  };

  // Draw branch information as a simple list
  const drawBranchesDiagram = (branches) => {
    d3.select(svgBranchesRef.current).selectAll("*").remove();

    const width = 800;
    const rowHeight = 30;
    const height = branches.length * rowHeight + 30;

    const svg = d3.select(svgBranchesRef.current)
      .attr("width", width)
      .attr("height", height);

    branches.forEach((branch, i) => {
      const y = i * rowHeight + 20;
      const group = svg.append("g")
        .attr("transform", `translate(20, ${y})`);

      // Draw a rectangle as background for each branch entry
      group.append("rect")
        .attr("width", 300)
        .attr("height", rowHeight - 5)
        .attr("fill", "#eee")
        .attr("stroke", "#ccc");

      // Display branch name and commit hash
      group.append("text")
        .attr("x", 10)
        .attr("y", 15)
        .attr("font-size", "12px")
        .text(`${branch.name}: ${branch.hash.substring(0, 7)}`);
    });
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
        <button
          onClick={handleFetch}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Analyze Repository
        </button>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {repoData && (
        <div>
          <h2 className="text-lg font-bold mt-4">Directory Tree</h2>
          <div className="overflow-auto border bg-gray-100">
            <svg ref={svgRepoRef}></svg>
          </div>

          <h2 className="text-lg font-bold mt-4">Database Diagram</h2>
          <div className="overflow-auto border bg-gray-100">
            <svg ref={svgDBRef}></svg>
          </div>

          <h2 className="text-lg font-bold mt-4">Git Commit History</h2>
          <div className="overflow-auto border bg-gray-100">
            <svg ref={svgGitCommitsRef}></svg>
          </div>

          <h2 className="text-lg font-bold mt-4">Branches</h2>
          <div className="overflow-auto border bg-gray-100">
            <svg ref={svgBranchesRef}></svg>
          </div>
        </div>
      )}
    </div>
  );
}
