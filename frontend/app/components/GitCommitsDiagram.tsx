"use client";
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface GitCommit {
  hash: string;
  message: string;
  author: string;
  date: string;
}

interface GitCommitsDiagramProps {
  gitCommits: GitCommit[];
}

const GitCommitsDiagram: React.FC<GitCommitsDiagramProps> = ({ gitCommits }) => {
  const svgGitCommitsRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    d3.select(svgGitCommitsRef.current).selectAll("*").remove();
    const width = 800,
      rowHeight = 50,
      height = gitCommits.length * rowHeight + 50;
    const svg = d3.select(svgGitCommitsRef.current).attr("width", width).attr("height", height);
    gitCommits.forEach((commit, i) => {
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
  }, [gitCommits]);

  return <svg ref={svgGitCommitsRef}></svg>;
};

export default GitCommitsDiagram;
