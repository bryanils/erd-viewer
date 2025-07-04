"use client";

import React, { useEffect, useMemo, useState } from 'react';
import type { ErdDiagram } from "~/types/erd";

interface ErdDiagramRendererProps {
    diagram: ErdDiagram;
}

export function ErdDiagramRenderer({ diagram }: ErdDiagramRendererProps) {
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tablePositions, setTablePositions] = useState<Map<string, any>>(new Map());
    const [dragState, setDragState] = useState<{
        isDragging: boolean;
        draggedTable: string | null;
        offset: { x: number; y: number };
    }>({
        isDragging: false,
        draggedTable: null,
        offset: { x: 0, y: 0 }
    });
    const [zoom, setZoom] = useState(1); // Start at normal zoom

    // Initialize table positions on first load
    useEffect(() => {
        if (tablePositions.size === 0 && diagram.entities.length > 0) {
            // DYNAMIC calculation based on actual entity count
            const entityCount = diagram.entities.length;
            const tableWidth = 250;
            const tableHeight = 150;
            const spacingX = 300;
            const spacingY = 200;
            const padding = 50;

            let cols, rows;
            if (entityCount === 1) {
                cols = 1;
                rows = 1;
            } else if (entityCount <= 4) {
                cols = Math.min(2, entityCount);
                rows = Math.ceil(entityCount / cols);
            } else {
                cols = Math.ceil(Math.sqrt(entityCount * 1.2)); // Slightly wider layout
                rows = Math.ceil(entityCount / cols);
            }

            const newPositions = new Map();
            diagram.entities.forEach((entity, index) => {
                const row = Math.floor(index / cols);
                const col = index % cols;
                newPositions.set(entity.id, {
                    x: col * spacingX + padding,
                    y: row * spacingY + padding,
                    width: tableWidth,
                    height: tableHeight
                });
            });
            setTablePositions(newPositions);
        }
    }, [diagram.entities, tablePositions.size]);

    const { svgWidth, svgHeight, connections, optimalZoom } = useMemo(() => {
        // Calculate actual content bounds
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

        for (const pos of tablePositions.values()) {
            minX = Math.min(minX, pos.x);
            minY = Math.min(minY, pos.y);
            maxX = Math.max(maxX, pos.x + pos.width);
            maxY = Math.max(maxY, pos.y + pos.height);
        }

        // Add padding around content
        const padding = 100;
        const contentWidth = maxX - minX + (2 * padding);
        const contentHeight = maxY - minY + (2 * padding);

        // Set minimum dimensions
        const svgWidth = Math.max(contentWidth, 400);
        const svgHeight = Math.max(contentHeight, 300);

        // Calculate optimal zoom to fit content in viewport
        const viewportWidth = 1000; // Approximate container width
        const viewportHeight = 600; // Approximate container height
        const optimalZoom = Math.min(
            viewportWidth / svgWidth,
            viewportHeight / svgHeight,
            1.0 // Don't zoom in beyond 100%
        );

        // Calculate connections based on current positions
        const connections = diagram.relations.map(relation => {
            const sourcePos = tablePositions.get(relation.pkRef);
            const targetPos = tablePositions.get(relation.fkRef);

            if (!sourcePos || !targetPos) return null;

            return {
                ...relation,
                x1: sourcePos.x + sourcePos.width / 2,
                y1: sourcePos.y + sourcePos.height,
                x2: targetPos.x + targetPos.width / 2,
                y2: targetPos.y,
            };
        }).filter(Boolean);

        return { svgWidth, svgHeight, connections, optimalZoom };
    }, [diagram.relations, tablePositions]);

    // Auto-fit zoom when positions change
    useEffect(() => {
        if (tablePositions.size > 0 && optimalZoom > 0) {
            setZoom(optimalZoom);
        }
    }, [optimalZoom, tablePositions.size]);

    const getRelatedTables = (tableId: string) => {
        const related = new Set<string>();
        diagram.relations.forEach(rel => {
            if (rel.pkRef === tableId) related.add(rel.fkRef);
            if (rel.fkRef === tableId) related.add(rel.pkRef);
        });
        return related;
    };

    const handleMouseDown = (event: React.MouseEvent, tableId: string) => {
        event.preventDefault();
        const svgRect = (event.currentTarget.closest('svg') as SVGElement)?.getBoundingClientRect();
        if (!svgRect) return;

        const pos = tablePositions.get(tableId);
        if (!pos) return;

        const mouseX = event.clientX - svgRect.left;
        const mouseY = event.clientY - svgRect.top;

        setDragState({
            isDragging: true,
            draggedTable: tableId,
            offset: {
                x: mouseX - pos.x,
                y: mouseY - pos.y
            }
        });
    };

    const handleMouseMove = (event: React.MouseEvent) => {
        if (!dragState.isDragging || !dragState.draggedTable) return;

        const svgRect = (event.currentTarget as SVGElement).getBoundingClientRect();
        const mouseX = event.clientX - svgRect.left;
        const mouseY = event.clientY - svgRect.top;

        const newX = mouseX - dragState.offset.x;
        const newY = mouseY - dragState.offset.y;

        setTablePositions(prev => {
            const newPositions = new Map(prev);
            const currentPos = newPositions.get(dragState.draggedTable!);
            if (currentPos) {
                newPositions.set(dragState.draggedTable!, {
                    ...currentPos,
                    x: Math.max(0, newX),
                    y: Math.max(0, newY)
                });
            }
            return newPositions;
        });
    };

    const handleMouseUp = () => {
        setDragState({
            isDragging: false,
            draggedTable: null,
            offset: { x: 0, y: 0 }
        });
    };

    const handleZoomIn = () => {
        setZoom(prev => Math.min(prev * 1.2, 2));
    };

    const handleZoomOut = () => {
        setZoom(prev => Math.max(prev / 1.2, 0.1));
    };

    const handleFitToView = () => {
        setZoom(optimalZoom > 0 ? optimalZoom : 1);
    };

    if (diagram.entities.length === 0) {
        return (
            <div className="flex items-center justify-center h-96 bg-gray-50 rounded-lg">
                <div className="text-center">
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No Entities Found</h3>
                    <p className="text-gray-600">The ERD file doesn't contain any entities to display.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Diagram Header */}
            <div className="rounded-lg bg-white p-6 shadow">
                <h2 className="text-2xl font-semibold text-gray-900">{diagram.name}</h2>
                <div className="mt-2 flex space-x-4 text-sm text-gray-600">
                    <span>Version: {diagram.version}</span>
                    <span>Tables: {diagram.entities.length}</span>
                    <span>Relationships: {diagram.relations.length}</span>
                </div>
                {selectedTable && (
                    <div className="mt-2 text-sm text-blue-600">
                        Selected: {diagram.entities.find(e => e.id === selectedTable)?.name}
                    </div>
                )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-2 mb-4">
                <button
                    onClick={handleZoomOut}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                    Zoom Out
                </button>
                <button
                    onClick={handleZoomIn}
                    className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                    Zoom In
                </button>
                <button
                    onClick={handleFitToView}
                    className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                >
                    Fit All Tables
                </button>
                <span className="text-sm text-gray-600 ml-2">
                    Zoom: {Math.round(zoom * 100)}%
                </span>
            </div>

            {/* SVG Diagram */}
            <div className="rounded-lg bg-white shadow p-4 overflow-auto" style={{ maxHeight: '80vh', width: '100%' }}>
                <svg
                    width={svgWidth * zoom}
                    height={svgHeight * zoom}
                    viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                    className="border border-gray-200 mx-auto block"
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    {/* Background */}
                    <defs>
                        <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#f3f4f6" strokeWidth="1" />
                        </pattern>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7"
                            refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                        </marker>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />

                    {/* Connection Lines */}
                    {connections.map((connection, index) => {
                        if (!connection) return null;

                        const isHighlighted = selectedTable &&
                            (connection.pkRef === selectedTable || connection.fkRef === selectedTable);

                        return (
                            <g key={index}>
                                <line
                                    x1={connection.x1}
                                    y1={connection.y1}
                                    x2={connection.x2}
                                    y2={connection.y2}
                                    stroke={isHighlighted ? "#ef4444" : "#3b82f6"}
                                    strokeWidth={isHighlighted ? "3" : "2"}
                                    markerEnd="url(#arrowhead)"
                                />
                                <text
                                    x={(connection.x1 + connection.x2) / 2}
                                    y={(connection.y1 + connection.y2) / 2 - 5}
                                    textAnchor="middle"
                                    fontSize="10"
                                    fill="#374151"
                                    className="pointer-events-none"
                                >
                                    {connection.name}
                                </text>
                            </g>
                        );
                    })}

                    {/* Table Boxes */}
                    {diagram.entities.map((entity) => {
                        const pos = tablePositions.get(entity.id);
                        if (!pos) return null;

                        const isSelected = selectedTable === entity.id;
                        const relatedTables = getRelatedTables(entity.id);
                        const isRelated = selectedTable && relatedTables.has(selectedTable);

                        return (
                            <g key={entity.id}>
                                <rect
                                    x={pos.x}
                                    y={pos.y}
                                    width={pos.width}
                                    height={pos.height}
                                    fill={isSelected ? "#dbeafe" : isRelated ? "#fef3c7" : "white"}
                                    stroke={isSelected ? "#3b82f6" : isRelated ? "#f59e0b" : "#d1d5db"}
                                    strokeWidth={isSelected ? "3" : "2"}
                                    rx="8"
                                    className="cursor-move hover:stroke-blue-500"
                                    onClick={() => setSelectedTable(isSelected ? null : entity.id)}
                                    onMouseDown={(e) => handleMouseDown(e, entity.id)}
                                />

                                {/* Table Header */}
                                <rect
                                    x={pos.x}
                                    y={pos.y}
                                    width={pos.width}
                                    height="30"
                                    fill="#3b82f6"
                                    rx="8"
                                    className="cursor-pointer"
                                    onClick={() => setSelectedTable(isSelected ? null : entity.id)}
                                />
                                <rect
                                    x={pos.x}
                                    y={pos.y + 22}
                                    width={pos.width}
                                    height="8"
                                    fill="#3b82f6"
                                />

                                {/* Table Name */}
                                <text
                                    x={pos.x + pos.width / 2}
                                    y={pos.y + 20}
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="14"
                                    fontWeight="bold"
                                    className="cursor-pointer pointer-events-none"
                                >
                                    {entity.name}
                                </text>

                                {/* Table Details */}
                                <text
                                    x={pos.x + 10}
                                    y={pos.y + 50}
                                    fill="#374151"
                                    fontSize="11"
                                    className="pointer-events-none"
                                >
                                    {entity.fqName}
                                </text>

                                {entity.path && (
                                    <text
                                        x={pos.x + 10}
                                        y={pos.y + 70}
                                        fill="#6b7280"
                                        fontSize="10"
                                        fontStyle="italic"
                                        className="pointer-events-none"
                                    >
                                        Schema: {entity.path}
                                    </text>
                                )}

                                <text
                                    x={pos.x + 10}
                                    y={pos.y + 90}
                                    fill="#9ca3af"
                                    fontSize="9"
                                    className="pointer-events-none"
                                >
                                    ID: {entity.id}
                                </text>

                                {/* Connection count */}
                                <text
                                    x={pos.x + pos.width - 10}
                                    y={pos.y + 90}
                                    textAnchor="end"
                                    fill="#3b82f6"
                                    fontSize="9"
                                    fontWeight="bold"
                                    className="pointer-events-none"
                                >
                                    {relatedTables.size} connections
                                </text>
                            </g>
                        );
                    })}
                </svg>
            </div>

            {/* Instructions */}
            <div className="rounded-lg bg-blue-50 p-4 border border-blue-200">
                <h3 className="text-sm font-medium text-blue-800 mb-2">How to Use</h3>
                <div className="text-xs text-blue-700 space-y-1">
                    <p>• Click on any table to highlight it and its relationships</p>
                    <p>• Drag tables to rearrange them - connections will follow automatically</p>
                    <p>• Blue arrows show foreign key relationships (pointing from primary key to foreign key table)</p>
                    <p>• Yellow highlighting shows related tables when a table is selected</p>
                    <p>• Scroll to navigate through the diagram</p>
                </div>
            </div>

            {/* Summary Statistics */}
            <div className="rounded-lg bg-white p-6 shadow">
                <h3 className="mb-4 text-lg font-medium text-gray-900">Summary</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div className="rounded-md bg-blue-50 p-4">
                        <div className="text-2xl font-bold text-blue-900">{diagram.entities.length}</div>
                        <div className="text-sm text-blue-700">Total Tables</div>
                    </div>
                    <div className="rounded-md bg-green-50 p-4">
                        <div className="text-2xl font-bold text-green-900">{diagram.relations.length}</div>
                        <div className="text-sm text-green-700">Total Relationships</div>
                    </div>
                    <div className="rounded-md bg-purple-50 p-4">
                        <div className="text-2xl font-bold text-purple-900">
                            {new Set(diagram.entities.map(e => e.path)).size}
                        </div>
                        <div className="text-sm text-purple-700">Unique Schemas</div>
                    </div>
                </div>
            </div>
        </div>
    );
}
