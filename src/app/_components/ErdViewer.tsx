"use client";

import { useState, useRef } from "react";
import { api } from "~/trpc/react";
import type { ErdDiagram } from "~/types/erd";
import { ErdDiagramRenderer } from "./ErdDiagramRenderer";

export default function ErdViewer() {
    const [diagram, setDiagram] = useState<ErdDiagram | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const parseFileMutation = api.erd.parseFile.useMutation({
        onSuccess: (result) => {
            setLoading(false);
            if (result.success && result.diagram) {
                setDiagram(result.diagram);
                setError(null);
            } else {
                setError(result.error || "Failed to parse file");
                setDiagram(null);
            }
        },
        onError: (error) => {
            setLoading(false);
            setError(error.message);
            setDiagram(null);
        },
    });

    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        if (!file.name.endsWith('.erd')) {
            setError('Please select a .erd file');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const fileContent = await file.text();
            parseFileMutation.mutate({ fileContent });
        } catch (err) {
            setLoading(false);
            setError('Failed to read file');
        }
    };

    const openFileDialog = () => {
        fileInputRef.current?.click();
    };

    return (
        <div className="bg-gray-50 m-4 rounded-lg">
            <div className="w-full max-w-none mx-auto p-6">
                <div className="mb-4">
                    <p className="text-gray-600">Upload and visualize .erd files</p>
                </div>

                <div className="mb-6">
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".erd"
                        onChange={handleFileUpload}
                        className="hidden"
                    />
                    <button
                        onClick={openFileDialog}
                        disabled={loading}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
                    >
                        {loading ? "Processing..." : "Open ERD File"}
                    </button>
                </div>

                {error && (
                    <div className="mb-6 rounded-md bg-red-50 p-4">
                        <div className="flex">
                            <div className="ml-3">
                                <h3 className="text-sm font-medium text-red-800">Error</h3>
                                <div className="mt-2 text-sm text-red-700">
                                    <p>{error}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {diagram && <ErdDiagramRenderer diagram={diagram} />}
            </div>
        </div>
    );
}
