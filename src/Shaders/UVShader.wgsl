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
    @location(0) fragNormal : vec3<f32>,
    @location(1) worldNormal : vec3<f32>,
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = uniforms.modelViewProj * vec4<f32>(input.position, 1.0);
    let worldNormal = (uniforms.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz;
    output.fragNormal = normalize(worldNormal);
    output.worldNormal = normalize(worldNormal);
    return output;
}

@fragment
fn fs_main(@location(1) worldNormal : vec3<f32>) -> @location(0) vec4<f32> {
    // Transform normal from [-1, 1] to [0, 1] for color display
    let normalColor = worldNormal * 0.5 + vec3<f32>(0.5);
    return vec4<f32>(normalColor, 1.0);
}
