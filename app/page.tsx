import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold">QPT</h1>

      <p className="mt-4 text-zinc-400">
        Your personal AI assistant
      </p>
    </main>
  );
}