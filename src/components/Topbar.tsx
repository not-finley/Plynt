
const Topbar = () => {
  return (
    <header className="h-12 bg-zinc-950 border-b border-zinc-800 px-4 flex items-center justify-between">
      <div className="flex items-center gap-3 text-sm text-zinc-200">
        <span className="font-bold text-white">Plynt</span>
        <span className="text-zinc-500">Draft</span>
      </div>
      <div className="flex gap-2">
        <button className="text-sm px-3 py-1 bg-zinc-800 hover:bg-zinc-700 rounded">Share</button>
      </div>
    </header>
  )
}

export default Topbar