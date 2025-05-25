
const PropertiesPanel = () => {
  return (
    <aside className="w-72 bg-zinc-800 border-l border-zinc-700 p-4 text-sm overflow-auto rounded-xl shadow-lg m-3">
      <h2 className="text-xs text-zinc-400 uppercase mb-2">Properties</h2>

      <div className="space-y-2">
        <label className="block">
          <span className="text-zinc-400">Width</span>
          <input type="text" className="w-full bg-zinc-800 text-white p-1 rounded" defaultValue="128" />
        </label>
        <label className="block">
          <span className="text-zinc-400">Height</span>
          <input type="text" className="w-full bg-zinc-800 text-white p-1 rounded" defaultValue="128" />
        </label>
      </div>
    </aside>
  )
}

export default PropertiesPanel