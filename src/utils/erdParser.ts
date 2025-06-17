// src/utils/erdParser.ts
import { XMLParser } from "fast-xml-parser";
import type { ErdDiagram, ErdEntity, ErdRelation } from "~/types/erd";

export function parseErdFile(xmlContent: string): ErdDiagram {
    const parser = new XMLParser({
        ignoreAttributes: false,
        attributeNamePrefix: "@_",
        parseAttributeValue: true,
        trimValues: true,
    });

    let parsedXml;
    try {
        parsedXml = parser.parse(xmlContent);
    } catch (error) {
        throw new Error("Invalid XML format");
    }

    const diagram = parsedXml.diagram;
    if (!diagram) {
        throw new Error("No diagram element found");
    }

    const version = diagram["@_version"] || "1";
    const name = diagram["@_name"] || "Untitled Diagram";

    // Parse entities
    const entities: ErdEntity[] = [];

    // Entities can be directly under entities or under entities.data-source
    let entitiesData = diagram.entities?.entity;

    // If not found directly, look under data-source
    if (!entitiesData && diagram.entities?.["data-source"]) {
        const dataSources = Array.isArray(diagram.entities["data-source"])
            ? diagram.entities["data-source"]
            : [diagram.entities["data-source"]];

        // Collect entities from all data sources
        dataSources.forEach((dataSource: any) => {
            if (dataSource.entity) {
                const sourceEntities = Array.isArray(dataSource.entity) ? dataSource.entity : [dataSource.entity];
                sourceEntities.forEach((entity: any) => {
                    const id = entity["@_id"] || "";
                    const entityName = entity["@_name"] || "";
                    const fqName = entity["@_fq-name"] || "";
                    const path = entity.path?.["@_name"] || "";

                    entities.push({
                        id,
                        name: entityName,
                        fqName,
                        path,
                    });
                });
            }
        });
    } else if (entitiesData) {
        // Handle direct entity structure
        const entityArray = Array.isArray(entitiesData) ? entitiesData : [entitiesData];

        entityArray.forEach((entity: any) => {
            const id = entity["@_id"] || "";
            const entityName = entity["@_name"] || "";
            const fqName = entity["@_fq-name"] || "";
            const path = entity.path?.["@_name"] || "";

            entities.push({
                id,
                name: entityName,
                fqName,
                path,
            });
        });
    }

    // Parse relations
    const relations: ErdRelation[] = [];
    const relationsData = diagram.relations?.relation;

    if (relationsData) {
        const relationArray = Array.isArray(relationsData) ? relationsData : [relationsData];

        relationArray.forEach((relation: any) => {
            const name = relation["@_name"] || "";
            const fqName = relation["@_fq-name"] || "";
            const type = relation["@_type"] || "";
            const pkRef = relation["@_pk-ref"] || "";
            const fkRef = relation["@_fk-ref"] || "";

            relations.push({
                name,
                fqName,
                type,
                pkRef,
                fkRef,
            });
        });
    }

    return {
        version,
        name,
        entities,
        relations,
    };
}
