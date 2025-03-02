"use client";
import React, { useEffect, useState, useRef } from "react";
import * as d3 from "d3";
import mermaid from "mermaid";
import dynamic from "next/dynamic";

const MermaidDiagram = dynamic(
  () => import("@/app/components/MermaidDiagram"),
  { ssr: false }
);

interface RepoData {
  totalLineCount: number;
  fileCount: number;
  languageStats: Record<string, number>;
  // Add other properties if needed.
}

// A new component to render a static Mermaid diagram.
const StaticDiagram = ({ chart }: { chart: string }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      mermaid.initialize({ startOnLoad: true, theme: "default" });
      if (containerRef.current) {
        containerRef.current.innerHTML = chart;
        mermaid.init(undefined, containerRef.current);
      }
    } catch (err) {
      console.error("Mermaid error:", err);
    }
  }, [chart]);
  

  return <div ref={containerRef} className="mermaid"></div>;
};

export default function Home() {
  const [repoData, setRepoData] = useState<any>(null);
  const [repoPath, setRepoPath] = useState("");
  const [error, setError] = useState(null);

  // Slider state variables for tree layout adjustments.
  const [branchSpacing, setBranchSpacing] = useState(1);
  const [horizontalScale, setHorizontalScale] = useState(1);
  const [verticalSpacing, setVerticalSpacing] = useState(1);

  // SVG refs for different diagrams
  const svgRepoRef = useRef(null);
  const svgDBRef = useRef(null);
  const svgGitCommitsRef = useRef(null);
  const svgBranchesRef = useRef(null);

  // Re-draw the directory tree whenever repoData, branchSpacing, or treeScale changes.
  useEffect(() => {
    if (repoData) {
      const filteredTree = filterDirectoryTree(repoData.directoryTree);
      drawRepoDiagram(filteredTree, branchSpacing, horizontalScale, verticalSpacing);
    }
  }, [repoData, branchSpacing, horizontalScale, verticalSpacing]);

  // Other diagrams (database, git commits, branches) drawn when repoData changes.
  useEffect(() => {
    if (repoData) {
      if (repoData.databaseInfo) {
        drawDatabaseDiagram(repoData.databaseInfo);
      }
      if (repoData.gitCommits) {
        drawGitCommitsDiagram(repoData.gitCommits);
      }
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
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Recursively filter out nodes whose name is ".git"
  const filterDirectoryTree = (node: any) => {
    if (node.name === ".git") return null;
    const newNode = { ...node };
    if (newNode.children) {
      newNode.children = newNode.children
        .map(filterDirectoryTree)
        .filter((child: any) => child !== null);
    }
    return newNode;
  };

  // Draw the directory tree (collapsible tree) using D3.
  const drawRepoDiagram = (directoryTree: any, spacingFactor: any, hScale: any, vScale: any) => {
    d3.select(svgRepoRef.current).selectAll("*").remove();

    // Base dimensions.
    const baseWidth = 1600;
    const baseHeight = 800;
    const margin = { top: 40, right: 200, bottom: 50, left: 200 };

    // Adjust dimensions using scale factors.
    const width = (baseWidth - 400) * hScale;
    const height = (baseHeight - 100) * vScale;

    const svg = d3
      .select(svgRepoRef.current)
      .attr("width", baseWidth)
      .attr("height", baseHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Enable zooming and panning.
    const zoom: any = d3.zoom().scaleExtent([0.5, 2]).on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });
    d3.select(svgRepoRef.current).call(zoom);

    // Create the hierarchy.
    const root: any = d3.hierarchy(directoryTree, (d) => d.children);
    root.x0 = height / 2;
    root.y0 = 0;

    // Collapse all nodes initially (except root).
    if (root.children) {
      root.children.forEach(collapse);
    }

    let i = 0; // used for node IDs

    // Update function: computes layout and renders nodes/links.
    function update(source: any) {
      const treeLayout = d3
        .tree()
        .size([height, width])
        .separation((a, b) => spacingFactor);

      treeLayout(root);

      const nodes = root.descendants();
      const links = root.links();

      // --- Nodes ---
      const node = svg.selectAll("g.node").data(nodes, (d: any) => d.id || (d.id = ++i));

      // Enter new nodes at the parent's previous position.
      const nodeEnter: any = node
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", (d) => `translate(${source.y0},${source.x0})`)
        .on("click", click);

      nodeEnter
        .append("circle")
        .attr("r", 1e-6)
        .style("fill", (d: any) => (d.children ? "#555" : "#999"))
        .style("stroke", "#333")
        .style("stroke-width", "2px");

      nodeEnter
        .append("text")
        .attr("dy", ".35em")
        .attr("x", (d: any) => (d.children ? -13 : 13))
        .attr("text-anchor", (d: any) => (d.children ? "end" : "start"))
        .style("font-size", "14px")
        .style("user-select", "none")
        .text((d: any) => d.data.name);

      // Transition nodes to their new positions.
      const nodeUpdate = nodeEnter.merge(node);
      nodeUpdate
        .transition()
        .duration(200)
        .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

      nodeUpdate
        .select("circle")
        .attr("r", 8)
        .style("fill", (d: any) => (d.children ? "#555" : "#999"));

      // Transition exiting nodes to the parent's new position.
      const nodeExit = node
        .exit()
        .transition()
        .duration(200)
        .attr("transform", (d) => `translate(${source.y},${source.x})`)
        .remove();

      nodeExit.select("circle").attr("r", 1e-6);

      // --- Links ---
      const link: any = svg.selectAll("path.link").data(links, (d: any) => d.target.id);

      // Enter any new links at the parent's previous position.
      const linkEnter = link
        .enter()
        .insert("path", "g")
        .attr("class", "link")
        .attr("fill", "none")
        .attr("stroke", "#aaa")
        .attr("stroke-width", "2px")
        .attr("d", (d: any) => {
          const o = { x: source.x0, y: source.y0 };
          return diagonal(o, o);
        });

      // Transition links to their new positions.
      const linkUpdate = linkEnter.merge(link);
      linkUpdate
        .transition()
        .duration(200)
        .attr("d", (d: any) => diagonal(d.source, d.target));

      // Transition exiting links.
      link
        .exit()
        .transition()
        .duration(200)
        .attr("d", (d: any) => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      // Save the new positions for transition.
      nodes.forEach((d: any) => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    // Creates a curved (diagonal) path from parent to the child nodes.
    function diagonal(s: any, d: any) {
      return `M ${s.y} ${s.x} C ${(s.y + d.y) / 2} ${s.x}, ${(s.y + d.y) / 2} ${d.x}, ${d.y} ${d.x}`;
    }

    // Toggle children on click.
    function click(event: any, d: any) {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      update(d);
    }

    // Collapse the node and all its children.
    function collapse(d: any) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    // Initial update to render the tree.
    update(root);
  };

  // Draw the database diagram with draggable tables and updating relationship lines.
  const drawDatabaseDiagram = (databaseInfo: any) => {
    d3.select(svgDBRef.current).selectAll("*").remove();
    const svg = d3.select(svgDBRef.current).attr("width", 1600).attr("height", 800);

    // Create a group for relationship lines so they can be updated easily.
    const linesGroup = svg.append("g").attr("class", "lines-group");

    const tableNames = Object.keys(databaseInfo);
    const numTables = tableNames.length;
    const columns = Math.ceil(Math.sqrt(numTables));
    const tableWidth = 250;
    const horizontalSpacing = 50;
    const verticalSpacing = 50;

    // This object will store each table's current position, its relative field offsets,
    // and a reference to its group.
    const tablePositions: any = {};

    // Group tables into rows.
    const rows: any = [];
    tableNames.forEach((table, i) => {
      const rowIndex = Math.floor(i / columns);
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex].push(table);
    });

    // Pre-calculate table heights.
    const tableHeights: any = {};
    tableNames.forEach((table) => {
      const fields = databaseInfo[table];
      const tableNameHeight = 30,
        columnHeaderHeight = 20,
        fieldRowHeight = 20;
      tableHeights[table] = tableNameHeight + columnHeaderHeight + fields.length * fieldRowHeight;
    });

    // Calculate dynamic y positions.
    const rowYPositions: any = [];
    let currentY = 50;
    rows.forEach((row: any, rowIndex: any) => {
      let maxHeight = 0;
      row.forEach((table: string | number) => {
        if (tableHeights[table] > maxHeight) maxHeight = tableHeights[table];
      });
      rowYPositions[rowIndex] = currentY;
      currentY += maxHeight + verticalSpacing;
    });

    // Draw tables and record field positions (relative offsets).
    rows.forEach((row: any, rowIndex: any) => {
      row.forEach((table: any, colIndex: any) => {
        const x = colIndex * (tableWidth + horizontalSpacing) + 50;
        const y = rowYPositions[rowIndex];
        const fields = databaseInfo[table];
        const tableNameHeight = 30,
          columnHeaderHeight = 20,
          fieldRowHeight = 20;
        const rectHeight = tableNameHeight + columnHeaderHeight + fields.length * fieldRowHeight;

        // Create the table group and attach drag behavior.
        const group = svg
          .append("g")
          .attr("transform", `translate(${x}, ${y})`)
          .call(
            d3
              .drag<SVGGElement, unknown>()
              .on("start", function (this: SVGGElement, event: any) {
                d3.select(this).raise().classed("active", true);
              })
              .on("drag", function (this: SVGGElement, event: any) {
                d3.select(this).attr("transform", `translate(${event.x}, ${event.y})`);
                tablePositions[table].x = event.x;
                tablePositions[table].y = event.y;
                updateRelationships(); // update relationship lines
              })
              .on("end", function (this: SVGGElement, event: any) {
                d3.select(this).classed("active", false);
              })
          );

        // Draw table rectangle and headers.
        group
          .append("rect")
          .attr("width", tableWidth)
          .attr("height", rectHeight)
          .attr("fill", "#fff")
          .attr("stroke", "#000");

        group
          .append("text")
          .attr("x", tableWidth / 2)
          .attr("y", tableNameHeight / 2 + 10)
          .attr("text-anchor", "middle")
          .attr("font-weight", "bold")
          .text(table);

        group
          .append("line")
          .attr("x1", 0)
          .attr("y1", tableNameHeight)
          .attr("x2", tableWidth)
          .attr("y2", tableNameHeight)
          .attr("stroke", "#000");

        group
          .append("text")
          .attr("x", 5)
          .attr("y", tableNameHeight + columnHeaderHeight / 2 + 10)
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .text("Field");

        group
          .append("text")
          .attr("x", tableWidth / 2)
          .attr("y", tableNameHeight + columnHeaderHeight / 2 + 10)
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .text("Type");

        group
          .append("line")
          .attr("x1", tableWidth / 2)
          .attr("y1", tableNameHeight)
          .attr("x2", tableWidth / 2)
          .attr("y2", rectHeight)
          .attr("stroke", "#000");

        // Record field relative positions (offsets within the group).
        const fieldOffsets: any = [];
        fields.forEach((fieldStr: any, j: any) => {
          const tokens = fieldStr.trim().split(/\s+/);
          const fieldName = tokens[0] || "";
          const fieldType = tokens[1] || "";
          const localY = tableNameHeight + columnHeaderHeight + j * fieldRowHeight + fieldRowHeight / 1.5;
          group
            .append("text")
            .attr("x", 5)
            .attr("y", localY)
            .attr("font-size", "12px")
            .text(fieldName);
          group
            .append("text")
            .attr("x", tableWidth / 2 + 5)
            .attr("y", localY)
            .attr("font-size", "12px")
            .text(fieldType);
          fieldOffsets.push({
            name: fieldName,
            dx: 5, // x-offset within the group
            dy: localY // y-offset within the group
          });
        });
        // Find primary key field (assumed to be named "ID").
        const primaryField = fieldOffsets.find((f: { name: string }) => f.name === "ID") || null;
        // Store current absolute position and relative offsets.
        tablePositions[table] = {
          group,
          x, // current x (updated on drag)
          y, // current y (updated on drag)
          width: tableWidth,
          rectHeight,
          fields: fieldOffsets,
          primaryKey: primaryField
        };
      });
    });

    // Draw initial relationship lines.
    tableNames.forEach((sourceTable) => {
      const sourceInfo = tablePositions[sourceTable];
      sourceInfo.fields.forEach((field: { name: string; dx: any; dy: any; }) => {
        if (field.name !== "ID" && field.name.endsWith("ID")) {
          const candidate = field.name.slice(0, -2);
          // Find target table by case-insensitive match.
          const targetTable = tableNames.find(
            (t) => t.toLowerCase() === candidate.toLowerCase()
          );
          if (targetTable && tablePositions[targetTable].primaryKey) {
            const targetInfo = tablePositions[targetTable];
            const sourceX = sourceInfo.x + field.dx;
            const sourceY = sourceInfo.y + field.dy;
            const targetX = targetInfo.x + targetInfo.primaryKey.dx;
            const targetY = targetInfo.y + targetInfo.primaryKey.dy;
            const midX = (sourceX + targetX) / 2;
            linesGroup
              .append("path")
              .attr(
                "d",
                `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`
              )
              .attr("stroke", "red")
              .attr("stroke-width", 1.5)
              .attr("fill", "none")
              .attr("marker-end", "url(#arrow)")
              .attr("class", "relationship-line")
              .attr("data-source-table", sourceTable)
              .attr("data-source-field", field.name)
              .attr("data-target-table", targetTable);
          }
        }
      });
    });

    // Define an arrow marker.
    svg.append("defs")
      .append("marker")
      .attr("id", "arrow")
      .attr("viewBox", "0 0 10 10")
      .attr("refX", 5)
      .attr("refY", 5)
      .attr("markerWidth", 6)
      .attr("markerHeight", 6)
      .attr("orient", "auto-start-reverse")
      .append("path")
      .attr("d", "M 0 0 L 10 5 L 0 10 z")
      .attr("fill", "red");

    // Function to update relationship lines based on current table positions.
    function updateRelationships() {
      svg.selectAll(".relationship-line")
        .attr("d", function () {
          const sourceTable = d3.select(this).attr("data-source-table");
          const sourceFieldName = d3.select(this).attr("data-source-field");
          const targetTable = d3.select(this).attr("data-target-table");
          const sourceInfo = tablePositions[sourceTable];
          const targetInfo = tablePositions[targetTable];
          const sourceField = sourceInfo.fields.find((f: { name: string; }) => f.name === sourceFieldName);
          const targetField = targetInfo.primaryKey;
          const sourceX = sourceInfo.x + sourceField.dx;
          const sourceY = sourceInfo.y + sourceField.dy;
          const targetX = targetInfo.x + targetField.dx;
          const targetY = targetInfo.y + targetField.dy;
          const midX = (sourceX + targetX) / 2;
          return `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`;
        });
      // Raise the lines group so it always stays on top.
      linesGroup.raise();
    }
    linesGroup.raise();
  };

  // Draw Git commits.
  const drawGitCommitsDiagram = (gitCommits: any) => {
    d3.select(svgGitCommitsRef.current).selectAll("*").remove();
    const width = 800,
      rowHeight = 50,
      height = gitCommits.length * rowHeight + 50;
    const svg = d3.select(svgGitCommitsRef.current).attr("width", width).attr("height", height);
    gitCommits.forEach((commit: any, i: any) => {
      const y = i * rowHeight + 30;
      const group = svg.append("g").attr("transform", `translate(20, ${y})`);
      group.append("circle").attr("r", 8).attr("fill", "#2196F3");
      group
        .append("text")
        .attr("x", 20)
        .attr("y", 5)
        .style("font-size", "12px")
        .text(`${commit.hash.substring(0, 7)} - ${commit.message}`);
      group
        .append("text")
        .attr("x", 20)
        .attr("y", 20)
        .style("font-size", "10px")
        .style("fill", "#555")
        .text(`${commit.author} @ ${commit.date}`);
    });
    for (let i = 0; i < gitCommits.length - 1; i++) {
      const y1 = i * rowHeight + 30,
        y2 = (i + 1) * rowHeight + 30;
      svg.append("line")
        .attr("x1", 20)
        .attr("y1", y1)
        .attr("x2", 20)
        .attr("y2", y2)
        .attr("stroke", "#aaa")
        .attr("stroke-width", 2);
    }
  };

  // Draw branch information.
  const drawBranchesDiagram = (branches: any) => {
    d3.select(svgBranchesRef.current).selectAll("*").remove();
    const width = 800,
      rowHeight = 30,
      height = branches.length * rowHeight + 30;
    const svg = d3.select(svgBranchesRef.current).attr("width", width).attr("height", height);
    branches.forEach((branch: any, i: any) => {
      const y = i * rowHeight + 20;
      const group = svg.append("g").attr("transform", `translate(20, ${y})`);
      group
        .append("rect")
        .attr("width", 300)
        .attr("height", rowHeight - 5)
        .attr("fill", "#eee")
        .attr("stroke", "#ccc");
      group
        .append("text")
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
        <button onClick={handleFetch} className="bg-blue-500 text-white px-4 py-2 rounded">
          Analyze Repository
        </button>
      </div>
      {/* Slider for Branch Spacing Factor */}
      <div className="my-4">
        <label className="mr-2" style={{ color: "white" }}>
          Branch Spacing Factor:
        </label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={branchSpacing}
          onChange={(e) => setBranchSpacing(parseFloat(e.target.value))}
        />
        <span className="ml-2" style={{ color: "white" }}>
          {branchSpacing}
        </span>
      </div>
      {/* Slider for Horizontal Scale Factor */}
      <div className="my-4">
        <label className="mr-2" style={{ color: "white" }}>
          Horizontal Scale Factor:
        </label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={horizontalScale}
          onChange={(e) => setHorizontalScale(parseFloat(e.target.value))}
        />
        <span className="ml-2" style={{ color: "white" }}>
          {horizontalScale}
        </span>
      </div>
      {/* Slider for Vertical Spacing Factor */}
      <div className="my-4">
        <label className="mr-2" style={{ color: "white" }}>
          Vertical Spacing Factor:
        </label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={verticalSpacing}
          onChange={(e) => setVerticalSpacing(parseFloat(e.target.value))}
        />
        <span className="ml-2" style={{ color: "white" }}>
          {verticalSpacing}
        </span>
      </div>
      {error && <p className="text-red-500">{error}</p>}
      {repoData && (
        <div>
          {/* Repository Statistics Section */}
          <h2 className="text-lg font-bold mt-4" style={{ color: "white" }}>
            Repository Statistics
          </h2>
          <div className="border bg-gray-100 p-2 mb-4" style={{ color: "black" }}>
            <div className="border bg-gray-100 p-2 mb-4" style={{ color: "black" }}>
              <p>Total Lines: {repoData.totalLineCount}</p>
              <p>File Count: {repoData.fileCount}</p>
              <div>
                <h3 className="font-bold">Languages Used:</h3>
                <ul>
                  {Object.entries(repoData.languageStats).map(([lang, count]: any) => (
                    <li key={lang}>
                      {lang}: {count}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
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
            {/* New Static Diagram Section */}
            <h2 className="text-lg font-bold mt-4">System Diagram</h2>
            <div className="overflow-auto border bg-gray-100 p-2">
            <MermaidDiagram
              chart={
                "flowchart LR\n" +
                "A --> B[Git Repository Analyzer]\n" +
                "B --> C[Git Repository Analyzer]\n" +
                "B --> D[Database & Model Extraction]\n" +
                "B --> E[Git Commit History & Branches]"
              }
            />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
