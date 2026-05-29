export default function Home() {
  return (
    <div className="flex h-screen bg-black text-white">
      {/* Sidebar */}
      <aside className="w-64 border-r border-zinc-800 flex flex-col">
        <div className="p-4">
          <button className="w-full rounded-lg bg-zinc-800 p-3 hover:bg-zinc-700">
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <div className="rounded-lg p-3 hover:bg-zinc-900 cursor-pointer">
            Welcome Chat
          </div>
        </div>
      </aside>

      {/* Main Area */}
      <main className="flex flex-1 flex-col">
        {/* Header */}
        <div className="border-b border-zinc-800 p-4">
          <h1 className="text-lg font-semibold">QPT</h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="rounded-2xl bg-zinc-900 p-4">
              Hello! I'm QPT.
            </div>

            <div className="rounded-2xl bg-blue-600 p-4 ml-auto max-w-md">
              Hi QPT!
            </div>
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-zinc-800 p-4">
          <div className="max-w-3xl mx-auto">
            <textarea
              placeholder="Message QPT..."
              className="w-full rounded-xl bg-zinc-900 p-4 outline-none resize-none"
              rows={3}
            />
          </div>
        </div>
      </main>
    </div>
  );
}