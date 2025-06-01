import { useRef, useEffect, useState } from "react";
import { initWebGPU } from "../core/gpu";
import { Paintbrush } from "lucide-react";
import Controls from "./Controls";

const modelUrls = [
  "/dragon.obj",
  "/cube.obj",
  "/Suzanne_HighRes.obj",
  "/Suzanne.obj",
  "/teapot.obj"
];


export default function CanvasArea() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gpuRef = useRef<any>(null);
  const [shaderValue, setShaderValue] = useState(0);
  const [modelValue, setModelValue] = useState(0);

  useEffect(() => {
    console.log("Initializing WebGPU with model:", modelUrls[modelValue], "and shader index:", shaderValue);

    let active = true;

    async function setup() {
      if (canvasRef.current) {
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;

        canvas.width = canvas.clientWidth * dpr;
        canvas.height = canvas.clientHeight * dpr;

        if (gpuRef.current) {
          gpuRef.current.stop();
          gpuRef.current = null;
        }

        const gpu = await initWebGPU(canvas, modelUrls[modelValue], shaderValue);
        if (!active) return;

        gpuRef.current = gpu;
        gpu.renderLoop();
        console.log("WebGPU initialized successfully with model:", modelUrls[modelValue], "and shader index:", shaderValue);
      }
    }

    setup();

    return () => {
      active = false;
      if (gpuRef.current) {
        gpuRef.current.stop();
        gpuRef.current = null;
      }
    };
  }, [shaderValue, modelValue]);

  // useEffect(() => {
  //   if (gpuRef.current) {
  //     gpuRef.current.updateShader(shaderValue);
  //   }
  // }, [shaderValue]);

  return (
    <div className="flex-1 bg-zinc-800 relative overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-full block" />

      {/* Floating Toolbar */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-96 h-14 bg-zinc-800 border border-zinc-700 p-4 text-sm rounded-xl shadow-lg flex items-center justify-center z-10">
        <Paintbrush />
      </div>

      <div className="absolute top-4 right-4" >
        <Controls 
          value={shaderValue}
          setValue={setShaderValue}
          modelValue={modelValue}
          setModelValue={setModelValue}
        />
      </div>
    </div>
  );
}