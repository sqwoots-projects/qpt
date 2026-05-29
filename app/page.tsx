"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "你好，我是 QPT。有什么我可以帮你的吗？" },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading) return;

    const nextMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];

    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!response.ok || !response.body) {
        throw new Error("QPT did not return a response");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        assistantText += decoder.decode(value, { stream: true });

        setMessages([
          ...nextMessages,
          { role: "assistant", content: assistantText },
        ]);
      }
    } catch (error) {
      console.error(error);
      setMessages([
        ...nextMessages,
        { role: "assistant", content: "抱歉，QPT 刚刚出了点问题。请再试一次。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex h-dvh flex-col bg-black text-white">
      <header className="flex h-14 shrink-0 items-center justify-center border-b border-zinc-800 px-4">
        <h1 className="text-lg font-semibold">QPT</h1>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] rounded-2xl bg-blue-600 px-4 py-3 text-base leading-relaxed"
                  : "mr-auto max-w-[85%] rounded-2xl bg-zinc-900 px-4 py-3 text-base leading-relaxed"
              }
            >
              {message.content || (isLoading ? "正在回复…" : "")}
              {isLoading && index === messages.length - 1 ? (
                <span className="ml-1 animate-pulse">▌</span>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <footer className="shrink-0 border-t border-zinc-800 bg-black px-3 pb-5 pt-3">
        <div className="mx-auto flex max-w-xl items-end gap-2 rounded-2xl bg-zinc-900 p-2">
          <textarea
            placeholder="输入你的问题…"
            className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-3 py-2 text-base outline-none placeholder:text-zinc-500"
            rows={1}
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
            disabled={isLoading || !input.trim()}
            className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            发送
          </button>
        </div>
      </footer>
    </main>
  );
}