"use client";
import React, { useEffect, useState, useRef } from "react";
import * as d3 from "d3";

export default function Home() {
  const [repoPath, setRepoPath] = useState("");
  const [repoData, setRepoData] = useState(null);
  const [error, setError] = useState(null);
  const svgRef = useRef(null);

  useEffect(() => {
    if (repoData) {
      drawDiagram(repoData.structure);
    }
  }, [repoData]);

  const handleFetch = async () => {
    setError(null);
    try {
      const response = await fetch(`http://127.0.0.1:8080/analyze?repo=${encodeURIComponent(repoPath)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch repository data");
      }
      const data = await response.json();
      setRepoData(data);
    } catch (err) {
      setError(err.message);
    }
  };

  const drawDiagram = (structure) => {
    d3.select(svgRef.current).selectAll("*").remove();

    const width = 1600; // Wider view
    const height = 800; // Increased height
    const margin = { top: 40, right: 200, bottom: 50, left: 200 };

    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    const zoom = d3.zoom().scaleExtent([0.5, 2]).on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });

    d3.select(svgRef.current).call(zoom);

    const root = d3.hierarchy(structure, (d) => d.children);
    const treeLayout = d3.tree().size([height - 100, width - 400]);
    treeLayout(root);

    const links = svg.selectAll(".link")
      .data(root.links())
      .enter()
      .append("path")
      .attr("class", "link")
      .attr("fill", "none")
      .attr("stroke", "#aaa")
      .attr("stroke-width", "2px")
      .attr(
        "d",
        d3
          .linkHorizontal()
          .x((d) => d.y)
          .y((d) => d.x)
      );

    const nodes = svg.selectAll(".node")
      .data(root.descendants())
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    nodes.append("circle")
      .attr("r", 8)
      .style("fill", (d) => (d.data.isDir ? "#4CAF50" : "#2196F3"))
      .style("stroke", "#333")
      .style("stroke-width", "2px");

    nodes.append("text")
      .attr("dx", (d) => (d.children ? -12 : 12))
      .attr("dy", 5)
      .style("font-size", "14px")
      .style("fill", "#333")
      .style("user-select", "none")
      .text((d) => d.data.name);

    nodes.on("click", (event, d) => {
      if (d.children) {
        d._children = d.children;
        d.children = null;
      } else {
        d.children = d._children;
        d._children = null;
      }
      drawDiagram(structure);
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
          <h2 className="text-lg font-bold mt-4">Repository Structure</h2>
          <div className="overflow-auto border bg-gray-100">
            <svg ref={svgRef}></svg>
          </div>
        </div>
      )}
    </div>
  );
}
