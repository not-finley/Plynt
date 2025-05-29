export function parseOBJ(objText: string) {
    const rawPositions: number[][] = [];
    const rawNormals: number[][] = [];
    const rawUVs: number[][] = [];

    const finalPositions: number[] = [];
    const finalNormals: number[] = [];
    const finalUVs: number[] = [];
    const indices: number[] = [];

    const vertexMap = new Map<VertexKey, number>(); // maps "vIndex//vnIndex" → final index
    let nextIndex = 0;

    const lines = objText.split("\n");
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === "v") {
            rawPositions.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (parts[0] === "vt") {
            rawUVs.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
            ]);
        }else if (parts[0] === "vn") {
            rawNormals.push([
                parseFloat(parts[1]),
                parseFloat(parts[2]),
                parseFloat(parts[3]),
            ]);
        } else if (parts[0] === "f") {
            const faceVertices = parts.slice(1);
            for (let i = 1; i < faceVertices.length - 1; i++) {
                const v0 = faceVertices[0];
                const v1 = faceVertices[i];
                const v2 = faceVertices[i + 1];
                for (const v of [v0, v1, v2]) {
                    const [vIdx, vtIdx , vnIdx] = v.split("/").map(Number);
                    const key = `${vIdx}/${vtIdx}/${vnIdx}`;

                    if (!vertexMap.has(key)) {
                        const pos = rawPositions[vIdx - 1];
                        const normal = rawNormals[vnIdx - 1] || [0, 0, 1];
                        const uv = rawUVs[vtIdx - 1] || [0 , 0];
                        finalPositions.push(...pos);
                        finalNormals.push(...normal);
                        finalUVs.push(...uv);

                        vertexMap.set(key, nextIndex++);
                    }

                    indices.push(vertexMap.get(key)!);
                }
            }
        }
    }

    return {
        positions: new Float32Array(finalPositions),
        normals: new Float32Array(finalNormals),
        uvs: new Float32Array(finalUVs),
        indices: new Uint32Array(indices),
    };
}

export async function loadOBJ(url: string) {
    const response = await fetch(url);
    const text = await response.text();
    return parseOBJ(text);
}