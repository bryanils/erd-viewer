// src/utils/erdParser.ts
import { XMLParser } from "fast-xml-parser";
import type { ParsedERD, ErdDiagram, ErdRelation, ErdEntity } from "~/types/erd"

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


/**
 * Parses XML ERD format and converts it to Mermaid ERD syntax
 * @param xmlString - The XML string containing the ERD data
 * @returns Mermaid ERD diagram as a string
 */
export function xmlToMermaidERD(xmlString: string): string {
    try {
        // Parse the XML
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        // Check for parsing errors
        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML format');
        }

        const parsedData = parseXMLERD(xmlDoc);
        return generateMermaidERD(parsedData);
    } catch (error) {
        throw new Error(`Failed to parse XML ERD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Parses the XML document and extracts entities and relations
 * @param xmlDoc - Parsed XML document
 * @returns Parsed ERD data
 */
function parseXMLERD(xmlDoc: Document): ParsedERD {
    const entities: ErdEntity[] = [];
    const relations: ErdRelation[] = [];

    // Parse entities
    const entityElements = xmlDoc.querySelectorAll('entity');
    entityElements.forEach(entityEl => {
        const id = entityEl.getAttribute('id') || '';
        const name = entityEl.getAttribute('name') || '';
        const fqName = entityEl.getAttribute('fq-name') || '';
        const pathEl = entityEl.querySelector('path');
        const path = pathEl?.getAttribute('name') || '';

        entities.push({
            id,
            name,
            fqName,
            path
        });
    });

    // Parse relations
    const relationElements = xmlDoc.querySelectorAll('relation');
    relationElements.forEach(relationEl => {
        const name = relationEl.getAttribute('name') || '';
        const fqName = relationEl.getAttribute('fq-name') || '';
        const type = relationEl.getAttribute('type') || '';
        const pkRef = relationEl.getAttribute('pk-ref') || '';
        const fkRef = relationEl.getAttribute('fk-ref') || '';

        relations.push({
            name,
            fqName,
            type,
            pkRef,
            fkRef
        });
    });

    return { entities, relations };
}

/**
 * Generates Mermaid ERD syntax from parsed data
 * @param data - Parsed ERD data
 * @returns Mermaid ERD diagram string
 */
function generateMermaidERD(data: ParsedERD): string {
    const { entities, relations } = data;

    // Create entity lookup map
    const entityMap = new Map<string, ErdEntity>();
    entities.forEach(entity => {
        entityMap.set(entity.id, entity);
    });

    let mermaidERD = 'erDiagram\n';

    // Add entities (Mermaid will auto-create them from relationships, but we can define them explicitly)
    entities.forEach(entity => {
        mermaidERD += `    ${sanitizeEntityName(entity.name)} {\n`;
        mermaidERD += `        string id PK "Primary Key"\n`;
        mermaidERD += `    }\n`;
    });

    // Add relationships
    relations.forEach(relation => {
        const pkEntity = entityMap.get(relation.pkRef);
        const fkEntity = entityMap.get(relation.fkRef);

        if (pkEntity && fkEntity) {
            const pkEntityName = sanitizeEntityName(pkEntity.name);
            const fkEntityName = sanitizeEntityName(fkEntity.name);

            // In ERD, the entity with the foreign key "belongs to" the entity with the primary key
            // Using ||--o{ notation: one-to-many relationship
            mermaidERD += `    ${pkEntityName} ||--o{ ${fkEntityName} : "${relation.name}"\n`;
        }
    });

    return mermaidERD;
}

/**
 * Sanitizes entity names for Mermaid compatibility
 * @param name - Original entity name
 * @returns Sanitized name
 */
function sanitizeEntityName(name: string): string {
    // Replace spaces and special characters with underscores
    // Keep only alphanumeric characters and underscores
    return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/_{2,}/g, '_');
}

/**
 * Alternative function that returns a more detailed Mermaid ERD with relationship cardinalities
 * @param xmlString - The XML string containing the ERD data
 * @returns Enhanced Mermaid ERD diagram as a string
 */
export function xmlToMermaidERDDetailed(xmlString: string): string {
    try {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(xmlString, 'text/xml');

        const parserError = xmlDoc.querySelector('parsererror');
        if (parserError) {
            throw new Error('Invalid XML format');
        }

        const parsedData = parseXMLERD(xmlDoc);
        return generateDetailedMermaidERD(parsedData);
    } catch (error) {
        throw new Error(`Failed to parse XML ERD: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

/**
 * Generates a more detailed Mermaid ERD with better relationship representation
 * @param data - Parsed ERD data
 * @returns Detailed Mermaid ERD diagram string
 */
function generateDetailedMermaidERD(data: ParsedERD): string {
    const { entities, relations } = data;

    const entityMap = new Map<string, ErdEntity>();
    entities.forEach(entity => {
        entityMap.set(entity.id, entity);
    });

    let mermaidERD = 'erDiagram\n\n';

    // Group relations by entities to better understand the relationships
    const relationshipCounts = new Map<string, number>();
    relations.forEach(relation => {
        const key = `${relation.pkRef}-${relation.fkRef}`;
        relationshipCounts.set(key, (relationshipCounts.get(key) || 0) + 1);
    });

    // Add relationships with appropriate cardinality
    const processedRelations = new Set<string>();

    relations.forEach(relation => {
        const pkEntity = entityMap.get(relation.pkRef);
        const fkEntity = entityMap.get(relation.fkRef);
        const relationKey = `${relation.pkRef}-${relation.fkRef}`;

        if (pkEntity && fkEntity && !processedRelations.has(relationKey)) {
            const pkEntityName = sanitizeEntityName(pkEntity.name);
            const fkEntityName = sanitizeEntityName(fkEntity.name);
            const relationCount = relationshipCounts.get(relationKey) || 1;

            // Determine relationship type based on foreign key relationships
            let relationshipNotation = '||--o{'; // one-to-many (default for FK relationships)

            if (relationCount > 1) {
                // Multiple foreign keys might indicate a different relationship
                relationshipNotation = '||--||'; // one-to-one
            }

            mermaidERD += `    ${pkEntityName} ${relationshipNotation} ${fkEntityName} : "references"\n`;
            processedRelations.add(relationKey);
        }
    });

    return mermaidERD;
}