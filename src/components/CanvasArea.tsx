import { useRef, useEffect } from "react";
import { initWebGPU } from "../core/gpu";
import PropertiesPanel from "./PropertiesPanel";
import Sidebar from "./Sidebar";
import { Paintbrush } from "lucide-react";

export default function CanvasArea() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
      if (canvasRef.current) {
        initWebGPU(canvasRef.current);
      }
    }, []);
  
    return (
      <div className="flex-1 bg-zinc-800 relative overflow-hidden">
        <canvas ref={canvasRef} className="w-full h-full block" />
  
        {/* Floating Toolbar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-96 h-14 bg-zinc-800 border border-zinc-700 p-4 text-sm rounded-xl shadow-lg flex items-center justify-center z-10">
          <Paintbrush />
        </div>
  
        {/* Floating Sidebar */}
        
        <Sidebar />
  
        {/* Floating Properties Panel */}
        <div className="absolute top-4 right-4 w-72 ">
          <PropertiesPanel />
        </div>
      </div>
    );
}