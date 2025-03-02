"use client";
import React, { useEffect, useRef } from "react";
import mermaid from "mermaid";

interface MermaidDiagramProps {
  chart: string;
}

const MermaidDiagram: React.FC<MermaidDiagramProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      // Initialize Mermaid with auto-start disabled.
      mermaid.initialize({ startOnLoad: false, theme: "default" });
      if (containerRef.current) {
        // Set a unique id on the container.
        if (!containerRef.current.id) {
          containerRef.current.id =
            "mermaid-" + Math.random().toString(36).substring(2, 9);
        }
        // Set the Mermaid diagram definition.
        containerRef.current.innerHTML = chart;
        // Delay the run call to allow innerHTML update.
        setTimeout(() => {
          mermaid.run({ querySelector: `#${containerRef.current!.id}` });
        }, 0);
      }
    } catch (err: any) {
      console.error("Mermaid error:", err.message || err.toString());
    }
  }, [chart]);

  return <div ref={containerRef} className="mermaid" />;
};

export default MermaidDiagram;
