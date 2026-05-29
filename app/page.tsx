"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hello! I'm QPT. How can I help?" },
  ]);
  const [input, setInput] = useState("");

  function sendMessage() {
    const text = input.trim();
    if (!text) return;

    setMessages((prev) => [
      ...prev,
      { role: "user", content: text },
      {
        role: "assistant",
        content: `I received your message: "${text}". GPT connection comes next.`,
      },
    ]);

    setInput("");
  }

  return (
    <div className="flex h-screen bg-black text-white">
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

      <main className="flex flex-1 flex-col">
        <div className="border-b border-zinc-800 p-4">
          <h1 className="text-lg font-semibold">QPT</h1>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {messages.map((message, index) => (
              <div
                key={index}
                className={
                  message.role === "user"
                    ? "ml-auto max-w-md rounded-2xl bg-blue-600 p-4"
                    : "rounded-2xl bg-zinc-900 p-4"
                }
              >
                {message.content}
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-zinc-800 p-4">
          <div className="max-w-3xl mx-auto flex gap-2">
            <textarea
              placeholder="Message QPT..."
              className="flex-1 rounded-xl bg-zinc-900 p-4 outline-none resize-none"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
            />

            <button
              onClick={sendMessage}
              className="rounded-xl bg-white px-5 font-semibold text-black hover:bg-zinc-200"
            >
              Send
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}