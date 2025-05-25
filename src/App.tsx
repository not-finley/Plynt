import { useEffect, useRef, useState } from 'react'
import './App.css'
import Topbar from './components/Topbar'
import { initWebGPU } from './core/gpu'
import CanvasArea from './components/CanvasArea'


function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (canvasRef.current) initWebGPU(canvasRef.current);
  }, []);


  return (
    <main className="w-screen h-screen flex flex-col font-sans bg-zinc-900 text-white">
      <Topbar />
      <CanvasArea />
    </main>
  )
}

export default App
