import { mat4 } from "gl-matrix";
import { loadOBJ } from "./parseOBJ";

export async function initWebGPU(canvas: HTMLCanvasElement, objURL: string) {
  let theta = 0; // horizontal angle
  let phi = 0.5; // vertical angle
  let radius = 6.0; // distance from the object
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
  let isDragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener("mousedown", (e) => {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("mouseup", () => {
    isDragging = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    theta -= dx * 0.005; // rotate left/right
    phi -= dy * 0.005;    // rotate up/down
    phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi)); // clamp phi
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    radius *= Math.pow(0.95, e.deltaY * 0.01); // zoom in/out
    radius = Math.max(1, Math.min(50, radius)); // clamp radius
  });

  window.addEventListener("resize", resizeCanvas);

  const model = await loadOBJ(objURL)
  console.log("Model loaded:", model);
  const position = model.positions;
  const normal = model.normals;
  const indexData = model.indices;


  const vertexCount = position.length / 3;
  const vertexData = new Float32Array(vertexCount * 6);
  for (let i = 0; i < vertexCount; i++) {
    vertexData.set(position.slice(i * 3, i * 3 + 3), i * 6);
    vertexData.set(normal.slice(i * 3, i * 3 + 3), i * 6 + 3);
  }

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
        let N = normalize(fragNormal);
        let L = normalize(uniforms.lightDir.xyz);

        // Hemispheric light: sky = bluish, ground = warm
        let skyColor = vec3<f32>(0.6, 0.7, 1.0);
        let groundColor = vec3<f32>(0.3, 0.25, 0.2);
        let hemiFactor = N.y * 0.5 + 0.5;
        let hemiLight = mix(groundColor, skyColor, hemiFactor);

        // Directional light (like the sun)
        let diff = max(dot(N, L), 0.0);
        let directionalLight = vec3<f32>(1.0, 0.95, 0.9) * diff;

        // Combine hemispheric + directional + ambient bounce
        let ambient = vec3<f32>(0.1, 0.1, 0.1);
        let color = hemiLight * 0.6 + directionalLight * 0.5 + ambient;

        return vec4<f32>(color, 1.0);
      }
    `,
  });

  // Matrices + lighting uniform
  const uniformBuffer = device.createBuffer({
    size: 64 * 2 + 16,
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
    primitive: { topology: "triangle-list", cullMode: "none" },
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
    const eyeX = radius * Math.sin(phi) * Math.sin(theta);
    const eyeY = radius * Math.cos(phi);
    const eyeZ = radius * Math.sin(phi) * Math.cos(theta);
    const view = mat4.lookAt(mat4.create(), [eyeX, eyeY, eyeZ], [0, 0, 0], [0, 1, 0]);
    const model = mat4.rotateY(mat4.create(), mat4.create(), 0.0 * time);
    const mvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, model));
    const normalMatrix = mat4.transpose(mat4.create(), mat4.invert(mat4.create(), model));
    const lightDir = new Float32Array([19, 1, 1, 0]);

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
    pass.setIndexBuffer(indexBuffer, "uint32");
    pass.drawIndexed(indexData.length);
    pass.end();

    device.queue.submit([encoder.finish()]);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}
