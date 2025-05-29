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
};

@vertex
fn vs_main(input : VertexInput) -> VertexOutput {
    var output : VertexOutput;
    output.position = uniforms.modelViewProj * vec4<f32>(input.position, 1.0);
    output.fragNormal = normalize((uniforms.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz);
    return output;
}

@fragment
fn fs_main(@location(0) fragNormal : vec3<f32>) -> @location(0) vec4<f32> {
    let N = normalize(fragNormal);
    let L = normalize(uniforms.lightDir.xyz);

    // Hemispheric lighting: blend sky and ground based on normal.y
    let skyColor = vec3<f32>(0.6, 0.7, 1.0);
    let groundColor = vec3<f32>(0.3, 0.25, 0.2);
    let hemiFactor = N.y * 0.5 + 0.5;
    let hemiLight = mix(groundColor, skyColor, hemiFactor);

    // Directional light
    let diff = max(dot(N, L), 0.0);
    let diffuse = vec3<f32>(1.0, 0.95, 0.9) * diff;

    // Simple specular
    let viewDir = vec3<f32>(0.0, 0.0, 1.0);
    let halfDir = normalize(L + viewDir);
    let spec = pow(max(dot(N, halfDir), 0.0), 32.0);
    let specular = vec3<f32>(1.0) * spec * 0.2;

    // Combine lighting
    let ambient = vec3<f32>(0.15, 0.15, 0.15);
    let color = hemiLight * 0.5 + diffuse * 0.5 + ambient + specular;

    // Gamma correction
    let gamma = 2.2;
    let finalColor = pow(color, vec3<f32>(1.0 / gamma));

    return vec4<f32>(finalColor, 1.0);
}
