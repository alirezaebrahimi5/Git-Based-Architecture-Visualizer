"use client"
import React, { useEffect, useState } from "react";
import * as d3 from "d3";

export default function Home() {
  const [files, setFiles] = useState([]);
  const [repoPath, setRepoPath] = useState("");
  const [error, setError] = useState(null);

  useEffect(() => {
    if (files.length > 0) {
      drawGraph();
    }
  }, [files]);

  const handleFetch = async () => {
    setError(null);
    try {
      const response = await fetch(`http://127.0.0.1:8080/analyze?repo=${encodeURIComponent(repoPath)}`);
      if (!response.ok) {
        throw new Error("Failed to fetch repository data");
      }
      const data = await response.json();
      setFiles(data.files);
    } catch (err) {
      setError(err.message);
    }
  };

  const drawGraph = () => {
    d3.select("#graph").selectAll("*").remove();

    const width = 800;
    const height = 600;

    const svg = d3.select("#graph")
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const nodes = files.map((file, index) => ({ id: index, name: file }));
    const links = [];

    const simulation = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(-50))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.selectAll("line")
      .data(links)
      .enter()
      .append("line")
      .style("stroke", "#999");

    const node = svg.selectAll("circle")
      .data(nodes)
      .enter()
      .append("circle")
      .attr("r", 5)
      .style("fill", "#69b3a2");

    node.append("title").text(d => d.name);

    simulation.nodes(nodes).on("tick", () => {
      node.attr("cx", d => d.x).attr("cy", d => d.y);
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);
    });
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold">Git-Based Architecture Visualizer</h1>
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
      {error && <p className="text-red-500">Error: {error}</p>}
      <div id="graph" className="border rounded bg-gray-100 w-full h-[600px]"></div>
    </div>
  );
}
