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
  table: string;
  x: number;
  y: number;
  width: number;
  rectHeight: number;
  fields: FieldInfo[];
  primaryKey: { name: string; dx: number; dy: number } | null;
  group: SVGGElement | null;
}

const DatabaseDiagram: React.FC<DatabaseDiagramProps> = ({ databaseInfo }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  // We'll store table positions in a mutable object.
  const tablePositions: Record<string, TablePosition> = {};

  useEffect(() => {
    if (!databaseInfo) return;
    // Clear previous content.
    d3.select(svgRef.current).selectAll("*").remove();

    // Basic dimensions.
    const width = 1600;
    const height = 1200;

    // Create the SVG element.
    const svg = d3
      .select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("preserveAspectRatio", "xMidYMid meet");

    // Create a parent group that contains both tables and relationship lines.
    const diagramGroup = svg.append("g").attr("class", "diagram-group");
    // Create two separate groups: one for tables, one for relation lines.
    const tablesGroup = diagramGroup.append("g").attr("class", "tables-group");
    const linesGroup = diagramGroup.append("g").attr("class", "lines-group");

    // Setup d3-zoom on the SVG that transforms the entire diagramGroup.
    const zoom:any = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.5, 3])
      .translateExtent([[-width, -height], [width * 2, height * 2]])
      .on("zoom", (event) => {
        diagramGroup.attr("transform", event.transform);
      });
    svg.call(zoom);

    // Layout parameters.
    const tableNames = Object.keys(databaseInfo);
    const columns = Math.ceil(Math.sqrt(tableNames.length));
    const tableWidth = 250;
    const tableNameHeight = 30;
    const columnHeaderHeight = 20;
    const fieldRowHeight = 20;
    const horizontalSpacing = 50;
    const verticalSpacing = 50;

    // Group table names into rows.
    const rows: string[][] = [];
    tableNames.forEach((table, i) => {
      const rowIndex = Math.floor(i / columns);
      if (!rows[rowIndex]) rows[rowIndex] = [];
      rows[rowIndex].push(table);
    });

    // Compute row y positions based on table heights.
    const tableHeights: Record<string, number> = {};
    tableNames.forEach((table) => {
      const fields = databaseInfo[table];
      tableHeights[table] =
        tableNameHeight + columnHeaderHeight + fields.length * fieldRowHeight;
    });
    const rowYPositions: number[] = [];
    let currentY = 50;
    rows.forEach((row) => {
      let maxHeight = 0;
      row.forEach((table) => {
        if (tableHeights[table] > maxHeight) maxHeight = tableHeights[table];
      });
      rowYPositions.push(currentY);
      currentY += maxHeight + verticalSpacing;
    });

    // Draw tables and record positions.
    rows.forEach((row, rowIndex) => {
      let xOffset = 50;
      row.forEach((tableName) => {
        const fields = databaseInfo[tableName];
        const rectHeight =
          tableNameHeight + columnHeaderHeight + fields.length * fieldRowHeight;
        // Append a group for this table inside tablesGroup.
        const tableGroup = tablesGroup
          .append("g")
          .attr("class", "table-group")
          .attr("transform", `translate(${xOffset}, ${rowYPositions[rowIndex]})`)
          .call(
            d3
              .drag<SVGGElement, unknown>()
              .on("start", function (event) {
                d3.select(this).raise().classed("active", true);
              })
              .on("drag", function (event) {
                d3.select(this).attr("transform", `translate(${event.x}, ${event.y})`);
                tablePositions[tableName].x = event.x;
                tablePositions[tableName].y = event.y;
                updateRelationships();
              })
              .on("end", function () {
                d3.select(this).classed("active", false);
              })
          );

        // Draw table rectangle.
        tableGroup
          .append("rect")
          .attr("width", tableWidth)
          .attr("height", rectHeight)
          .attr("fill", "#fff")
          .attr("stroke", "#000");

        // Table name.
        tableGroup
          .append("text")
          .attr("x", tableWidth / 2)
          .attr("y", tableNameHeight / 2 + 10)
          .attr("text-anchor", "middle")
          .attr("font-weight", "bold")
          .text(tableName);

        // Field headings.
        tableGroup
          .append("text")
          .attr("x", 5)
          .attr("y", tableNameHeight + columnHeaderHeight / 2 + 10)
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .text("Field");

        tableGroup
          .append("text")
          .attr("x", tableWidth / 2 + 5)
          .attr("y", tableNameHeight + columnHeaderHeight / 2 + 10)
          .attr("font-size", "12px")
          .attr("font-weight", "bold")
          .text("Type");

        // Draw header separator lines.
        tableGroup
          .append("line")
          .attr("x1", 0)
          .attr("y1", tableNameHeight + columnHeaderHeight)
          .attr("x2", tableWidth)
          .attr("y2", tableNameHeight + columnHeaderHeight)
          .attr("stroke", "#000");

        tableGroup
          .append("line")
          .attr("x1", tableWidth / 2)
          .attr("y1", tableNameHeight)
          .attr("x2", tableWidth / 2)
          .attr("y2", rectHeight)
          .attr("stroke", "#000");

        // Collect field information.
        const fieldOffsets: FieldInfo[] = [];
        fields.forEach((fieldStr, index) => {
          const tokens = fieldStr.trim().split(/\s+/);
          const fieldName = tokens[0] || "";
          const fieldType = tokens[1] || "";
          const fieldArgs = tokens.slice(2).join(" ") || "";
          const localY =
            tableNameHeight + columnHeaderHeight + index * fieldRowHeight + fieldRowHeight / 1.5;
          tableGroup
            .append("text")
            .attr("x", 5)
            .attr("y", localY)
            .attr("font-size", "12px")
            .text(fieldName);
          tableGroup
            .append("text")
            .attr("x", tableWidth / 2 + 5)
            .attr("y", localY)
            .attr("font-size", "12px")
            .text(fieldType);
          fieldOffsets.push({
            name: fieldName,
            type: fieldType,
            args: fieldArgs,
            dx: 5, // relative offset from left of table
            dy: localY, // relative to tableGroup origin
          });
        });

        // Determine primary key. If no explicit "ID", use fallback at top-center.
        let primaryKey:any = fieldOffsets.find((f) => f.name === "ID");
        if (!primaryKey) {
          primaryKey = { name: "ID", dx: tableWidth / 2, dy: 20 };
        }

        tablePositions[tableName] = {
          table: tableName,
          group: tableGroup.node() as SVGGElement,
          x: xOffset,
          y: rowYPositions[rowIndex],
          width: tableWidth,
          rectHeight,
          fields: fieldOffsets,
          primaryKey,
        };

        xOffset += tableWidth + horizontalSpacing;
      });
    });

    // Draw relationship lines.
    Object.values(tablePositions).forEach((sourcePos) => {
      sourcePos.fields.forEach((field) => {
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
          // Find target table (case-insensitive).
          let targetPos = Object.values(tablePositions).find(
            (pos) => pos.table.toLowerCase() === candidate.toLowerCase()
          );
          if (!targetPos) {
            // Create pseudo node.
            targetPos = {
              table: candidate,
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
              group: null,
            };
            tablePositions[candidate] = targetPos;
          }
          if (targetPos && targetPos.primaryKey) {
            const sourceX = sourcePos.x + field.dx;
            const sourceY = sourcePos.y + field.dy;
            const targetX = targetPos.x + targetPos.primaryKey.dx;
            const targetY = targetPos.y + targetPos.primaryKey.dy;
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
              .attr("data-source-table", sourcePos.table)
              .attr("data-source-field", field.name)
              .attr("data-target-table", targetPos.table);
          }
        }
      });
    });

    // Define arrow marker.
    const defs = diagramGroup.append("defs");
    defs.append("marker")
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

    // Update relation positions when tables are dragged.
    function updateRelationships() {
      linesGroup.selectAll(".relationship-line").attr("d", function () {
        const sourceTable = d3.select(this).attr("data-source-table");
        const sourceFieldName = d3.select(this).attr("data-source-field");
        const targetTable = d3.select(this).attr("data-target-table");
        const sourcePos = tablePositions[sourceTable];
        const targetPos = tablePositions[targetTable];
        if (!sourcePos || !targetPos) return "";
        const sourceField = sourcePos.fields.find((f) => f.name === sourceFieldName);
        const targetField = targetPos.primaryKey;
        if (!sourceField || !targetField) return "";
        const sourceX = sourcePos.x + sourceField.dx;
        const sourceY = sourcePos.y + sourceField.dy;
        const targetX = targetPos.x + targetField.dx;
        const targetY = targetPos.y + targetField.dy;
        const midX = (sourceX + targetX) / 2;
        return `M${sourceX},${sourceY} C${midX},${sourceY} ${midX},${targetY} ${targetX},${targetY}`;
      });
    }

    // Center the diagram initially.
    const diagramBBox = (diagramGroup.node() as SVGGElement).getBBox();
    const offsetX = width / 2 - (diagramBBox.x + diagramBBox.width / 2);
    const offsetY = height / 2 - (diagramBBox.y + diagramBBox.height / 2);
    svg.call(zoom.transform, d3.zoomIdentity.translate(offsetX, offsetY).scale(0.8));
  }, [databaseInfo]);

  return <svg ref={svgRef} style={{ width: "100%", height: "100%", background: "#f9f9f9" }} />;
};

export default DatabaseDiagram;
