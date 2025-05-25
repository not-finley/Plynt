
const Sidebar = () => {
  return (
    <aside className="absolute top-2 left-2 w-64 h-full bg-zinc-800 border-r border-zinc-700 p-4 space-y-6 overflow-auto rounded-xl shadow-lg m-3">
      <div>
        <h2 className="text-xs text-zinc-400 uppercase mb-2">Pages</h2>
        <ul className="space-y-1">
          <li className="text-sm text-white">OnBoarding</li>
          <li className="text-sm text-white">Settings</li>
        </ul>
      </div>
      <div>
        <h2 className="text-xs text-zinc-400 uppercase mb-2">Layers</h2>
        <ul className="space-y-1">
          <li className="text-sm text-white">Frame 1587</li>
          <li className="text-sm text-white">Frame 1586</li>
        </ul>
      </div>
    </aside>
  )
}

export default Sidebar