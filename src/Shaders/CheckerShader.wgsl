struct Uniforms {
    modelViewProj : mat4x4<f32>,
    normalMatrix : mat4x4<f32>,
    lightDir : vec4<f32>,
};
@group(0) @binding(0) var<uniform> uniforms : Uniforms;

struct VertexInput {
    @location(0) position : vec3<f32>,
    @location(1) normal : vec3<f32>,
    @location(2) uv : vec2<f32>,
};

struct VertexOutput {
    @builtin(position) position : vec4<f32>,
    @location(0) fragUV : vec2<f32>,
    @location(1) worldNormal : vec3<f32>,
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = uniforms.modelViewProj * vec4<f32>(input.position, 1.0);
    let worldNormal = (uniforms.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz;
    output.worldNormal = normalize(worldNormal);
    output.fragUV = input.uv;
    return output;
}

@fragment
fn fs_main(@location(0) fragUV : vec2<f32>) -> @location(0) vec4<f32> {
    let scale = 20.0; // number of checker squares per UV space (0-1)
    let uvScaled = fragUV * scale;

    // Floor to get cell index, mod 2 to alternate
    let checker = i32(floor(uvScaled.x)) + i32(floor(uvScaled.y));
    let isWhite = (checker % 2) == 0;

    let color = select(vec3<f32>(0.3), vec3<f32>(0.9), isWhite);
    return vec4<f32>(color, 1.0);
}