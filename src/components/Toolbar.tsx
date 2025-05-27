import { Paintbrush } from 'lucide-react';

const Toolbar = () => {
  return (
    <aside className="w-96 h-14 bg-zinc-800 border-l border-zinc-700 p-4 text-sm overflow-auto rounded-xl shadow-lg m-3">
      <Paintbrush />
    </aside>
  )
}

export default Toolbar