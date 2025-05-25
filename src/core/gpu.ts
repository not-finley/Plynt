export async function initWebGPU(canvas: HTMLCanvasElement) {
    if (!navigator.gpu) {
      throw new Error("WebGPU not supported.");
    }
  
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
    
          context.configure({
            device,
            format,
            alphaMode: "opaque",
          });
        }
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    
    const shaderModule = device.createShaderModule({
      code: `
        @vertex
        fn vs_main(@builtin(vertex_index) index : u32) -> @builtin(position) vec4<f32> {
          var pos = array<vec2<f32>, 3>(
            vec2<f32>(0.0,  0.5),
            vec2<f32>(-0.5, -0.5),
            vec2<f32>(0.5, -0.5)
          );
          return vec4<f32>(pos[index], 0.0, 1.0);
        }
  
        @fragment
        fn fs_main() -> @location(0) vec4<f32> {
          return vec4<f32>(0.8, 0.2, 0.4, 1.0);
        }
      `,
    });
  
    const pipeline = device.createRenderPipeline({
      layout: "auto",
      vertex: { module: shaderModule, entryPoint: "vs_main" },
      fragment: {
        module: shaderModule,
        entryPoint: "fs_main",
        targets: [{ format }],
      },
      primitive: { topology: "triangle-list" },
    });
  
    function frame() {
        resizeCanvas();
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        const renderPass = commandEncoder.beginRenderPass({
        colorAttachments: [{
          view: textureView,
          clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
          loadOp: "clear",
          storeOp: "store",
        }],
      });
        renderPass.setPipeline(pipeline);
        renderPass.draw(3);
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
        requestAnimationFrame(frame);
    }
  
    requestAnimationFrame(frame);
}