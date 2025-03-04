"use client";
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface Branch {
  name: string;
  hash: string;
}

interface BranchesDiagramProps {
  branches: Branch[];
}

const BranchesDiagram: React.FC<BranchesDiagramProps> = ({ branches }) => {
  const svgBranchesRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    d3.select(svgBranchesRef.current).selectAll("*").remove();
    const width = 800,
      rowHeight = 30,
      height = branches.length * rowHeight + 30;
    const svg = d3.select(svgBranchesRef.current).attr("width", width).attr("height", height);
    branches.forEach((branch, i) => {
      const y = i * rowHeight + 20;
      const group = svg.append("g").attr("transform", `translate(20, ${y})`);
      group.append("rect")
        .attr("width", 300)
        .attr("height", rowHeight - 5)
        .attr("fill", "#eee")
        .attr("stroke", "#ccc");
      group.append("text")
        .attr("x", 10)
        .attr("y", 15)
        .attr("font-size", "12px")
        .text(`${branch.name}: ${branch.hash.substring(0, 7)}`);
    });
  }, [branches]);

  return <svg ref={svgBranchesRef}></svg>;
};

export default BranchesDiagram;
