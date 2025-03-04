"use client";
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface TreeNode {
  name: string;
  children?: TreeNode[];
}

interface RepoDiagramProps {
  directoryTree: TreeNode;
  branchSpacing: number;
  horizontalScale: number;
  verticalSpacing: number;
}

const RepoDiagram: React.FC<RepoDiagramProps> = ({
  directoryTree,
  branchSpacing,
  horizontalScale,
  verticalSpacing,
}) => {
  const svgRepoRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!directoryTree) return;
    if (!svgRepoRef.current) return;
    d3.select(svgRepoRef.current).selectAll("*").remove();

    // Base dimensions.
    const baseWidth = 1600;
    const baseHeight = 800;
    const margin = { top: 40, right: 200, bottom: 50, left: 200 };

    const width = (baseWidth - 400) * horizontalScale;
    const height = (baseHeight - 100) * verticalSpacing;

    const svg = d3
      .select(svgRepoRef.current)
      .attr("width", baseWidth)
      .attr("height", baseHeight)
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Enable zooming and panning.
    const zoom:any = d3.zoom().scaleExtent([0.5, 2]).on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });
    d3.select(svgRepoRef.current).call(zoom);

    const root:any = d3.hierarchy(directoryTree);
    (root as any).x0 = height / 2;
    (root as any).y0 = 0;

    // Collapse all nodes initially (except root).
    if (root.children) {
      root.children.forEach(collapse);
    }

    let i = 0;
    function update(source: any) {
      const treeLayout = d3.tree().size([height, width]).separation(() => branchSpacing);
      treeLayout(root);
      const nodes = root.descendants();
      const links = root.links();

      // --- Nodes ---
      const node:any = svg.selectAll("g.node").data(nodes, (d: any) => d.id || (d.id = ++i));
      const nodeEnter = node
        .enter()
        .append("g")
        .attr("class", "node")
        .attr("transform", (d: any) => `translate(${source.y0},${source.x0})`)
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

      const nodeUpdate = nodeEnter.merge(node);
      nodeUpdate
        .transition()
        .duration(200)
        .attr("transform", (d: any) => `translate(${d.y},${d.x})`);

      nodeUpdate
        .select("circle")
        .attr("r", 8)
        .style("fill", (d: any) => (d.children ? "#555" : "#999"));

      const nodeExit = node
        .exit()
        .transition()
        .duration(200)
        .attr("transform", (d:any) => `translate(${source.y},${source.x})`)
        .remove();

      nodeExit.select("circle").attr("r", 1e-6);

      // --- Links ---
      const link:any = svg.selectAll("path.link").data(links, (d: any) => d.target.id);
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

      const linkUpdate = linkEnter.merge(link);
      linkUpdate
        .transition()
        .duration(200)
        .attr("d", (d: any) => diagonal(d.source, d.target));

      link
        .exit()
        .transition()
        .duration(200)
        .attr("d", (d: any) => {
          const o = { x: source.x, y: source.y };
          return diagonal(o, o);
        })
        .remove();

      nodes.forEach((d: any) => {
        d.x0 = d.x;
        d.y0 = d.y;
      });
    }

    function diagonal(s: any, d: any) {
      return `M ${s.y} ${s.x} C ${(s.y + d.y) / 2} ${s.x}, ${(s.y + d.y) / 2} ${d.x}, ${d.y} ${d.x}`;
    }

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

    function collapse(d: any) {
      if (d.children) {
        d._children = d.children;
        d._children.forEach(collapse);
        d.children = null;
      }
    }

    update(root);
  }, [directoryTree, branchSpacing, horizontalScale, verticalSpacing]);

  return <svg ref={svgRepoRef}></svg>;
};

export default RepoDiagram;
