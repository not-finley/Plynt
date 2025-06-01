import { mat4 } from "gl-matrix";
import { loadOBJ } from "./parseOBJ";
import MainShaderCode from "../Shaders/MainShader.wgsl?raw";
import UVShaderCode from "../Shaders/UVShader.wgsl?raw";
import CheckerShaderCode from "../Shaders/CheckerShader.wgsl?raw";

export async function initWebGPU(canvas: HTMLCanvasElement, objURL: string, shaderIndex = 0) {
  let theta = 0; // horizontal angle
  let phi = 0.5; // vertical angle
  let radius = 6.0; // distance from the object
  let panX = 0;
  let panY = 0;
  if (!navigator.gpu) throw new Error("WebGPU not supported.");

  const adapter = await navigator.gpu.requestAdapter();
  if (!adapter) throw new Error("No GPU adapter found.");
  const device = await adapter.requestDevice();

  const context = canvas.getContext("webgpu") as GPUCanvasContext;
  if (!context) throw new Error("Failed to get WebGPU context.");
  const format = navigator.gpu.getPreferredCanvasFormat();
  context.configure({
    device,
    format,
    alphaMode: "opaque",
    size: [canvas.width, canvas.height],
  });

  let depthTexture: GPUTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });;

  function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(canvas.clientWidth * dpr);
    const height = Math.floor(canvas.clientHeight * dpr);

    // DEBUG:
    // console.log(
    //   "[resizeCanvas] clientSize:", 
    //   canvas.clientWidth, "×", canvas.clientHeight, 
    //   "→ pixelSize:", width, "×", height
    // );


    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;

      context.configure({
        device,
        format,
        alphaMode: "opaque",
        size: [canvas.width, canvas.height],
      });

      depthTexture?.destroy();
      depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: "depth24plus",
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
      });

    }
  }

// resizeCanvas();
  let lastX = 0;
  let lastY = 0;
  let isOrbiting = false;
  let isPanning = false;

  canvas.addEventListener("mousedown", (e) => {
    if (e.altKey && e.button === 0) { // Alt + Left
      isOrbiting = true;
    } else if (e.shiftKey && e.button === 0 ) { // Alt + Middle or Right
      isPanning = true;
    }
    lastX = e.clientX;
    lastY = e.clientY;
  });

  canvas.addEventListener("mouseup", () => {
    isOrbiting = false;
    isPanning = false;
  });

  canvas.addEventListener("mousemove", (e) => {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if (isOrbiting) {
      theta -= dx * 0.005;
      phi -= dy * 0.005;
      phi = Math.max(0.01, Math.min(Math.PI - 0.01, phi));
    } else if (isPanning) {
      const panSpeed = 0.002 * radius;

      // Compute the forward direction vector
      const sinPhi = Math.sin(phi);
      const forward = [
        Math.sin(theta) * sinPhi,
        Math.cos(phi),
        Math.cos(theta) * sinPhi,
      ];

      // Compute the right vector as cross(forward, up)
      const up = [0, 1, 0];
      const right = [
        forward[2] * up[1] - forward[1] * up[2],
        forward[0] * up[2] - forward[2] * up[0],
        forward[1] * up[0] - forward[0] * up[1],
      ];

      // Normalize right vector
      const rightLength = Math.hypot(...right);
      right[0] /= rightLength;
      right[1] /= rightLength;
      right[2] /= rightLength;

      // Recompute up vector as cross(right, forward)
      const trueUp = [
        right[1] * forward[2] - right[2] * forward[1],
        right[2] * forward[0] - right[0] * forward[2],
        right[0] * forward[1] - right[1] * forward[0],
      ];

      // Normalize up vector
      const upLength = Math.hypot(...trueUp);
      trueUp[0] /= upLength;
      trueUp[1] /= upLength;
      trueUp[2] /= upLength;

      // Pan relative to camera orientation
      panX -= dx * panSpeed * right[0] + dy * panSpeed * trueUp[0];
      panY -= dx * panSpeed * right[1] + dy * panSpeed * trueUp[1];
      // Optional: you can track Z if needed for full panning
      // panZ -= dx * panSpeed * right[2] + dy * panSpeed * trueUp[2];
    }
  });

  canvas.addEventListener("wheel", (e) => {
    e.preventDefault();
    radius *= Math.pow(0.95, e.deltaY * 0.01); // zoom in/out
    radius = Math.max(1, Math.min(50, radius)); // clamp radius
  });

  // window.addEventListener("resize", resizeCanvas);

  const model = await loadOBJ(objURL);
  const position = model.positions;
  const normal = model.normals;
  const indexData = model.indices;
  const uvs = model.uvs;


  const vertexCount = position.length / 3;
  const vertexData = new Float32Array(vertexCount * 8);
  for (let i = 0; i < vertexCount; i++) {
    vertexData.set(position.slice(i * 3, i * 3 + 3), i * 8);
    vertexData.set(normal.slice(i * 3, i * 3 + 3), i * 8 + 3);
    vertexData.set(uvs.slice(i * 2, i * 2 + 2), i * 8 + 6);
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


  function getShaderCode(shaderIndex: number) {
    if(shaderIndex === 1) return UVShaderCode;
    if (shaderIndex === 2) return CheckerShaderCode;
    return MainShaderCode;

  }

  function createPipeline(shaderIndex: number) {
    const shaderModule = device.createShaderModule({ code: getShaderCode(shaderIndex)});
    return device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout]}),
      vertex: {
      module: shaderModule,
      entryPoint: "vs_main",
      buffers: [{
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0, format: "float32x3" }, // position
          { shaderLocation: 1, offset: 12, format: "float32x3" }, // normal
          { shaderLocation: 2, offset: 24, format: "float32x2" }, // uv
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
  }

  let currentShaderIndex = shaderIndex;
  let pipeline = createPipeline(currentShaderIndex);

  function updateShader(newShaderIndex: number) {
    if (newShaderIndex !== currentShaderIndex) {
      pipeline = createPipeline(newShaderIndex);
      currentShaderIndex = newShaderIndex;
    }
  }




  // const shaderModule = device.createShaderModule({
  //   code: shaderCode,
  // });


  // const pipeline = device.createRenderPipeline({
  //   layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
  //   vertex: {
  //     module: shaderModule,
  //     entryPoint: "vs_main",
  //     buffers: [{
  //       arrayStride: 32,
  //       attributes: [
  //         { shaderLocation: 0, offset: 0, format: "float32x3" }, // position
  //         { shaderLocation: 1, offset: 12, format: "float32x3" }, // normal
  //         { shaderLocation: 2, offset: 24, format: "float32x2" }, // uv
  //       ]
  //     }]
  //   },
  //   fragment: {
  //     module: shaderModule,
  //     entryPoint: "fs_main",
  //     targets: [{ format }],
  //   },
  //   primitive: { topology: "triangle-list", cullMode: "none" },
  //   depthStencil: {
  //     depthWriteEnabled: true,
  //     depthCompare: "less",
  //     format: "depth24plus"
  //   }
  // });

  let stopped = false;

  function renderLoop() {
    if (stopped) return;
    resizeCanvas();
    if (!depthTexture) {
      return;
    }
    // Matrices
    const aspect = canvas.width / canvas.height;
    const fov = Math.PI / 4;
    const near = 0.1, far = 100;
    const projection = mat4.perspective(mat4.create(), fov, aspect, near, far);
    const eyeX = radius * Math.sin(phi) * Math.sin(theta) + panX;
    const eyeY = radius * Math.cos(phi) + panY;
    const eyeZ = radius * Math.sin(phi) * Math.cos(theta);
    const centerX = panX;
    const centerY = panY;
    const centerZ = 0;
    const view = mat4.lookAt(mat4.create(), [eyeX, eyeY, eyeZ], [centerX, centerY, centerZ], [0, 1, 0]);
    const modelMat = mat4.rotateY(mat4.create(), mat4.create(), 0.0);
    const mvp = mat4.multiply(mat4.create(), projection, mat4.multiply(mat4.create(), view, modelMat));
    const normalMatrix = mat4.transpose(mat4.create(), mat4.invert(mat4.create(), modelMat));
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
    requestAnimationFrame(renderLoop);
  }

  function stop() {
    stopped = true;
    device.destroy?.();
  }
  return { device, context, updateShader, renderLoop, stop };
}
