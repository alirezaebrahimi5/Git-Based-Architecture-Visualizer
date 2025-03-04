"use client";
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface DatabaseDiagramProps {
  databaseInfo: Record<string, string[]>;
}

interface FieldInfo {
  name: string;
  type: string;
  args: string;
  dx: number;
  dy: number;
}

interface TablePosition {
  x: number;
  y: number;
  width: number;
  rectHeight: number;
  fields: FieldInfo[];
  primaryKey: { name: string; dx: number; dy: number } | null;
  group: any;
}

interface RelationData {
  sourceTable: string;
  targetTable: string;
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  fields: string[];
}

const DatabaseDiagram: React.FC<DatabaseDiagramProps> = ({ databaseInfo }) => {
  const svgDBRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!databaseInfo) return;
    // Clear any previous content.
    d3.select(svgDBRef.current).selectAll("*").remove();

    // Create svg with viewBox and zoom/pan support.
    const svg = d3
      .select(svgDBRef.current)
      .attr("width", 1600)
      .attr("height", 800)
      .attr("viewBox", "0 0 1600 800")
      .attr("preserveAspectRatio", "xMidYMid meet");
    const zoom:any = d3.zoom().scaleExtent([0.5, 3]).on("zoom", (event) => {
      svg.attr("transform", event.transform);
    });
    d3.select(svgDBRef.current).call(zoom);

    // Group for relation lines.
    const linesGroup = svg.append("g").attr("class", "lines-group");

    let tableNames = Object.keys(databaseInfo);
    const columns = Math.ceil(Math.sqrt(tableNames.length));
    const tableWidth = 250;
    const horizontalSpacing = 50;
    const verticalSpacing = 50;

    const tablePositions: Record<string, TablePosition> = {};

    // Group tables into rows.
    const rows: string[][] = [];
    tableNames.forEach((table, i) => {
      const rowIndex = Math.floor(i / columns);
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex].push(table);
    });

    // Pre-calculate table heights.
    const tableHeights: Record<string, number> = {};
    tableNames.forEach((table) => {
      const fields = databaseInfo[table];
      const tableNameHeight = 30,
        columnHeaderHeight = 20,
        fieldRowHeight = 20;
      tableHeights[table] = tableNameHeight + columnHeaderHeight + fields.length * fieldRowHeight;
    });

    // Calculate y positions for rows.
    const rowYPositions: number[] = [];
    let currentY = 50;
    rows.forEach((row, rowIndex) => {
      let maxHeight = 0;
      row.forEach((table) => {
        if (tableHeights[table] > maxHeight) maxHeight = tableHeights[table];
      });
      rowYPositions[rowIndex] = currentY;
      currentY += maxHeight + verticalSpacing;
    });

    // Draw tables and record positions.
    rows.forEach((row, rowIndex) => {
      row.forEach((table, colIndex) => {
        const x = colIndex * (tableWidth + horizontalSpacing) + 50;
        const y = rowYPositions[rowIndex];
        const fields = databaseInfo[table];
        const tableNameHeight = 30,
          columnHeaderHeight = 20,
          fieldRowHeight = 20;
        const rectHeight = tableNameHeight + columnHeaderHeight + fields.length * fieldRowHeight;

        const group = svg
          .append("g")
          .attr("transform", `translate(${x}, ${y})`)
          .call(
            d3
              .drag<SVGGElement, unknown>()
              .on("start", function (event) {
                d3.select(this).raise().classed("active", true);
              })
              .on("drag", function (event) {
                d3.select(this).attr("transform", `translate(${event.x}, ${event.y})`);
                tablePositions[table].x = event.x;
                tablePositions[table].y = event.y;
                updateRelationships();
              })
              .on("end", function () {
                d3.select(this).classed("active", false);
              })
          );

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
          .attr("x", tableWidth / 2 + 5)
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

        const fieldOffsets: FieldInfo[] = [];
        fields.forEach((fieldStr, j) => {
          const tokens = fieldStr.trim().split(/\s+/);
          const fieldName = tokens[0] || "";
          const fieldType = tokens[1] || "";
          const fieldArgs = tokens.slice(2).join(" ") || "";
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
            type: fieldType,
            args: fieldArgs,
            dx: 5,
            dy: localY,
          });
        });
        // Determine primary key.
        let primaryField:any = fieldOffsets.find((f) => f.name === "ID");
        if (!primaryField && fieldOffsets.length > 0) {
          // Fallback: use a pseudo primary key at the center top.
          primaryField = { name: "ID", dx: tableWidth / 2, dy: 30 };
        }
        tablePositions[table] = {
          group,
          x,
          y,
          width: tableWidth,
          rectHeight,
          fields: fieldOffsets,
          primaryKey: primaryField,
        };
      });
    });

    // Draw relationships (foreign keys, one-to-one, many-to-many).
    tableNames.forEach((sourceTable) => {
      const sourceInfo = tablePositions[sourceTable];
      sourceInfo.fields.forEach((field) => {
        if (
          field.name !== "ID" &&
          (field.name.endsWith("ID") ||
            field.type === "ForeignKey" ||
            field.type === "OneToOneField" ||
            field.type === "ManyToManyField")
        ) {
          let candidate = "";
          if (field.name.endsWith("ID")) {
            candidate = field.name.slice(0, -2);
          } else {
            const toMatch = field.args.match(/to\s*=\s*["']([^"']+)["']/);
            if (toMatch && toMatch[1]) {
              const parts = toMatch[1].split(".");
              candidate = parts.length > 1 ? parts[1] : parts[0];
            } else {
              const tokens = field.args.split(/\s+/);
              if (tokens.length > 0) {
                candidate = tokens[0].replace(/[,;]/g, "");
              }
            }
          }
          // Look up target table by candidate (case-insensitive)
          let targetTable = tableNames.find(
            (t) => t.toLowerCase() === candidate.toLowerCase()
          );
          if (!targetTable) {
            // Create a pseudo node for the missing target.
            targetTable = candidate;
            tableNames.push(targetTable);
            tablePositions[targetTable] = {
              group: null,
              x: 1300,
              y: 50,
              width: tableWidth,
              rectHeight: 80,
              fields: [{
                name: "ID",
                type: "AutoField",
                args: "",
                dx: tableWidth / 2,
                dy: 30,
              }],
              primaryKey: { name: "ID", dx: tableWidth / 2, dy: 30 },
            };
          }
          if (tablePositions[targetTable] && tablePositions[targetTable].primaryKey) {
            const targetInfo:any = tablePositions[targetTable];
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

    // Define arrow marker.
    svg
      .append("defs")
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

    // Function to update relation positions on drag.
    function updateRelationships() {
      svg.selectAll(".relationship-line").attr("d", function () {
        const sourceTable: any = d3.select(this).attr("data-source-table");
        const sourceFieldName = d3.select(this).attr("data-source-field");
        const targetTable = d3.select(this).attr("data-target-table");
        const sourceInfo = tablePositions[sourceTable];
        const targetInfo = tablePositions[targetTable];
        const sourceField: any = sourceInfo.fields.find((f) => f.name === sourceFieldName);
        const targetField: any = targetInfo.primaryKey;
        const sourceX = sourceInfo.x + sourceField.dx;
        const sourceY = sourceInfo.y + sourceField.dy;
        const targetX = targetInfo.x + targetField.dx;
        const targetY = targetInfo.y + targetField.dy;
        const midX = (sourceX + targetX) / 2;
        return `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`;
      });
      linesGroup.raise();
    }
    linesGroup.raise();
  }, [databaseInfo]);

  return <svg ref={svgDBRef}></svg>;
};

export default DatabaseDiagram;
