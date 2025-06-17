// src/types/erd.ts
export interface ErdEntity {
    id: string;
    name: string;
    fqName: string;
    path: string;
}

export interface ErdRelation {
    name: string;
    fqName: string;
    type: string;
    pkRef: string;
    fkRef: string;
}

export interface ErdDiagram {
    version: string;
    name: string;
    entities: ErdEntity[];
    relations: ErdRelation[];
}


export interface ParsedERD {
    entities: ErdEntity[];
    relations: ErdRelation[];
}
