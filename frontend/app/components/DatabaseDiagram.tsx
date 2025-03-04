"use client";
import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

interface DatabaseDiagramProps {
  databaseInfo: Record<string, string[]>;
}

interface TablePosition {
  x: number;
  y: number;
  width: number;
  rectHeight: number;
  fields: {
    name: string;
    type: string;
    args: string;
    dx: number;
    dy: number;
  }[];
  primaryKey: { name: string; dx: number; dy: number } | null;
  group: any;
}

const DatabaseDiagram: React.FC<DatabaseDiagramProps> = ({ databaseInfo }) => {
  const svgDBRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!databaseInfo) return;
    d3.select(svgDBRef.current).selectAll("*").remove();
    const svg = d3.select(svgDBRef.current).attr("width", 1600).attr("height", 800);

    // Group for relationship lines.
    const linesGroup = svg.append("g").attr("class", "lines-group");

    const tableNames = Object.keys(databaseInfo);
    const numTables = tableNames.length;
    const columns = Math.ceil(Math.sqrt(numTables));
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

    // Calculate dynamic y positions.
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

    // Draw tables.
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
              .on("end", function (event) {
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

        const fieldOffsets: {
          name: string;
          type: string;
          args: string;
          dx: number;
          dy: number;
        }[] = [];

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
        // Assume primary key is the field named "ID".
        const primaryField = fieldOffsets.find((f) => f.name === "ID") || null;
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

    // Draw relationships.
    tableNames.forEach((sourceTable) => {
      const sourceInfo = tablePositions[sourceTable];
      sourceInfo.fields.forEach((field) => {
        // For Django relations, check if field type is a relation type.
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
            // Use first token from field.args as candidate.
            const tokens = field.args.split(/\s+/);
            if (tokens.length > 0) {
              candidate = tokens[0].replace(/[,;]/g, "");
            }
          }
          const targetTable = tableNames.find(
            (t) => t.toLowerCase() === candidate.toLowerCase()
          );
          if (targetTable && tablePositions[targetTable].primaryKey) {
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

    // Define an arrow marker.
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

    function updateRelationships() {
      svg.selectAll(".relationship-line").attr("d", function () {
        const sourceTable = d3.select(this).attr("data-source-table");
        const sourceFieldName = d3.select(this).attr("data-source-field");
        const targetTable = d3.select(this).attr("data-target-table");
        const sourceInfo = tablePositions[sourceTable];
        const targetInfo = tablePositions[targetTable];
        const sourceField:any = sourceInfo.fields.find((f) => f.name === sourceFieldName);
        const targetField:any = targetInfo.primaryKey;
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
