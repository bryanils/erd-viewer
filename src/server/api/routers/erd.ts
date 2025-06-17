// src/server/api/routers/erd.ts
import { z } from "zod";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { parseErdFile, xmlToMermaidERD } from "~/utils/erdParser";

export const erdRouter = createTRPCRouter({
    parseFile: publicProcedure
        .input(z.object({
            fileContent: z.string()
        }))
        .mutation(async ({ input }) => {
            try {
                const diagram = parseErdFile(input.fileContent);
                return {
                    success: true,
                    diagram,
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to parse ERD file",
                };
            }
        }),
    parseToMermaid: publicProcedure
        .input(z.object({
            fileContent: z.string()
        }))
        .mutation(async ({ input }) => {
            try {
                const diagram = xmlToMermaidERD(input.fileContent);
                return {
                    success: true,
                    diagram,
                };
            } catch (error) {
                return {
                    success: false,
                    error: error instanceof Error ? error.message : "Failed to parse ERD file",
                };
            }
        }),
});