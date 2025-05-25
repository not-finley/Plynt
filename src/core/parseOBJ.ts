export function parseOBJ(objText: string) {
    const positions: number[] = [];
    const indices: number[] = [];

    const lines = objText.split("\n");
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts[0] === 'v') {
        // Vertex position
        positions.push(parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3]));
        } else if (parts[0] === 'f') {
        // Face (1-based indexing in .obj)
        for (let i = 1; i < parts.length - 2; i++) {
            const a = parts[1].split("/")[0];
            const b = parts[i + 1].split("/")[0];
            const c = parts[i + 2].split("/")[0];
            indices.push(
            parseInt(a) - 1,
            parseInt(b) - 1,
            parseInt(c) - 1
            );
        }
        }
    }

    return {
        positions: new Float32Array(positions),
        indices: new Uint32Array(indices),
    };
}

export async function loadOBJ(url: string) {
    const response = await fetch(url);
    const text = await response.text();
    return parseOBJ(text);
}