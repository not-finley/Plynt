import { mat4 } from "gl-matrix";

export async function initWebGPU(canvas: HTMLCanvasElement) {
  if (!navigator.gpu) throw new Error("WebGPU not supported.");

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No GPU adapter found.");
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu") as GPUCanvasContext;
  const format = navigator.gpu.getPreferredCanvasFormat();

  function resizeCanvas() {
    const devicePixelRatio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth * devicePixelRatio;
    const height = canvas.clientHeight * devicePixelRatio;
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    context.configure({
      device,
      format,
      alphaMode: "opaque",
    });
  }

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  // Cube vertices with normals (24 vertices = 6 faces * 4 vertices)
  const vertexData = new Float32Array([
    // Position         // Normal
    -1, -1,  1,        0,  0,  1,
     1, -1,  1,        0,  0,  1,
     1,  1,  1,        0,  0,  1,
    -1,  1,  1,        0,  0,  1,

    -1, -1, -1,        0,  0, -1,
    -1,  1, -1,        0,  0, -1,
     1,  1, -1,        0,  0, -1,
     1, -1, -1,        0,  0, -1,

    -1,  1, -1,       -1,  0,  0,
    -1,  1,  1,       -1,  0,  0,
    -1, -1,  1,       -1,  0,  0,
    -1, -1, -1,       -1,  0,  0,

     1,  1,  1,        1,  0,  0,
     1,  1, -1,        1,  0,  0,
     1, -1, -1,        1,  0,  0,
     1, -1,  1,        1,  0,  0,

    -1,  1, -1,        0,  1,  0,
     1,  1, -1,        0,  1,  0,
     1,  1,  1,        0,  1,  0,
    -1,  1,  1,        0,  1,  0,

    -1, -1, -1,        0, -1,  0,
    -1, -1,  1,        0, -1,  0,
     1, -1,  1,        0, -1,  0,
     1, -1, -1,        0, -1,  0,
  ]);

  const indexData = new Uint16Array([
    0, 1, 2, 0, 2, 3,
    4, 5, 6, 4, 6, 7,
    8, 9,10, 8,10,11,
   12,13,14,12,14,15,
   16,17,18,16,18,19,
   20,21,22,20,22,23
  ]);

  const vertexBuffer = device.createBuffer({
    size: vertexData.byteLength,
    usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(vertexBuffer, 0, vertexData);

  const indexBuffer = device.createBuffer({
    size: indexData.byteLength,
    usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
  });
  device.queue.writeBuffer(indexBuffer, 0, indexData);

  // Matrices + lighting uniform
  const uniformBuffer = device.createBuffer({
    size: 64 * 2 + 16, // modelViewProj (64) + normalMatrix (64) + light direction (16)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [{
      binding: 0,
      visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
      buffer: {}
    }]
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [{
      binding: 0,
      resource: { buffer: uniformBuffer }
    }]
  });

  const shaderModule = device.createShaderModule({
    code: /* wgsl */`
      struct Uniforms {
        modelViewProj : mat4x4<f32>,
        normalMatrix : mat4x4<f32>,
        lightDir : vec4<f32>,
      };
      @group(0) @binding(0) var<uniform> uniforms : Uniforms;

      struct VertexInput {
        @location(0) position : vec3<f32>,
        @location(1) normal : vec3<f32>,
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
        let light = normalize(uniforms.lightDir.xyz);
        let diff = max(dot(fragNormal, light), 0.0);
        let color = vec3<f32>(0.2, 0.6, 1.0) * diff + vec3<f32>(0.1); // diffuse + ambient
        return vec4<f32>(color, 1.0);
      }
    `,
  });

  const pipeline = device.createRenderPipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 6 * 4,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" },
          { shaderLocation: 1, offset: 12, format: "float32x3" },
        ]
      }]
    },
    fragment: {
      module: shaderModule,
      entryPoint: "fs_main",
      targets: [{ format }],
    },
    primitive: { topology: "triangle-list", cullMode: "back" },
    depthStencil: {
      depthWriteEnabled: true,
      depthCompare: "less",
      format: "depth24plus"
    }
  });

  const depthTexture = device.createTexture({
    size: [canvas.width, canvas.height],
    format: "depth24plus",
    usage: GPUTextureUsage.RENDER_ATTACHMENT
  });

  function frame(time: number) {
    resizeCanvas();

    // Matrices
    const aspect = canvas.width / canvas.height;
    const fov = Math.PI / 4;
    const near = 0.1, far = 100;
    const projection = mat4.perspective(mat4.create(), fov, aspect, near, far);
    const view = mat4.lookAt(mat4.create(), [2, 2, 3], [0, 0, 0], [0, 1, 0]);
    const model = mat4.rotateY(mat4.create(), mat4.create(), time * 0.001);
    const mvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, model));
    const normalMatrix = mat4.transpose(mat4.create(), mat4.invert(mat4.create(), model));
    const lightDir = new Float32Array([0.5, 1, 1, 0]);

    device.queue.writeBuffer(uniformBuffer, 0, mvp as Float32Array);
    device.queue.writeBuffer(uniformBuffer, 64, normalMatrix as Float32Array);
    device.queue.writeBuffer(uniformBuffer, 128, lightDir);

    const encoder = device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
        loadOp: "clear",
        storeOp: "store"
      }],
      depthStencilAttachment: {
        view: depthTexture.createView(),
        depthClearValue: 1.0,
        depthLoadOp: "clear",
        depthStoreOp: "store"
      }
    });

    pass.setPipeline(pipeline);
    pass.setBindGroup(0, bindGroup);
    pass.setVertexBuffer(0, vertexBuffer);
    pass.setIndexBuffer(indexBuffer, "uint16");
    pass.drawIndexed(indexData.length);
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
