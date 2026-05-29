"use client";

import { useEffect, useMemo, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "qpt_conversations";
const ACTIVE_CONVERSATION_KEY = "qpt_active_conversation_id";

const welcomeMessage: Message = {
  role: "assistant",
  content: "你好，我是 QPT。有什么我可以帮你的吗？",
};

function createNewConversation(): Conversation {
  const now = new Date().toISOString();

  return {
    id: crypto.randomUUID(),
    title: "新对话",
    messages: [welcomeMessage],
    createdAt: now,
    updatedAt: now,
  };
}

function getConversationTitle(messages: Message[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage) return "新对话";

  const title = firstUserMessage.content.trim().replace(/\s+/g, " ");
  return title.length > 18 ? `${title.slice(0, 18)}…` : title;
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const activeConversation = useMemo(() => {
    return conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
  }, [activeConversationId, conversations]);

  const messages = activeConversation?.messages ?? [welcomeMessage];

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Conversation[];
        if (parsed.length > 0) {
          const savedActiveConversationId = localStorage.getItem(
            ACTIVE_CONVERSATION_KEY,
          );
          const savedConversationStillExists = parsed.some(
            (conversation) => conversation.id === savedActiveConversationId,
          );

          setConversations(parsed);
          setActiveConversationId(
            savedConversationStillExists && savedActiveConversationId
              ? savedActiveConversationId
              : parsed[0].id,
          );
          return;
        }
      } catch (error) {
        console.error("Failed to load conversations:", error);
      }
    }

    const firstConversation = createNewConversation();
    setConversations([firstConversation]);
    setActiveConversationId(firstConversation.id);
  }, []);

  useEffect(() => {
    if (conversations.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
  }, [activeConversationId]);

  function updateActiveConversation(nextMessages: Message[]) {
    setConversations((previous) =>
      previous.map((conversation) => {
        if (conversation.id !== activeConversationId) return conversation;

        return {
          ...conversation,
          title: getConversationTitle(nextMessages),
          messages: nextMessages,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
  }

  function startNewChat() {
    if (isLoading) return;

    const newConversation = createNewConversation();
    setConversations((previous) => [newConversation, ...previous]);
    setActiveConversationId(newConversation.id);
    setInput("");
    setShowHistory(false);
  }

  function openConversation(id: string) {
    if (isLoading) return;

    setActiveConversationId(id);
    setShowHistory(false);
  }

  function deleteConversation(id: string) {
    if (isLoading) return;

    setConversations((previous) => {
      const remaining = previous.filter((conversation) => conversation.id !== id);

      if (remaining.length === 0) {
        const newConversation = createNewConversation();
        setActiveConversationId(newConversation.id);
        return [newConversation];
      }

      if (id === activeConversationId) {
        setActiveConversationId(remaining[0].id);
      }

      return remaining;
    });
  }

  async function sendMessage() {
    const text = input.trim();
    if (!text || isLoading || !activeConversation) return;

    const nextMessages: Message[] = [
      ...activeConversation.messages,
      { role: "user", content: text },
    ];

    updateActiveConversation([...nextMessages, { role: "assistant", content: "" }]);
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
        updateActiveConversation([
          ...nextMessages,
          { role: "assistant", content: assistantText },
        ]);
      }
    } catch (error) {
      console.error(error);
      updateActiveConversation([
        ...nextMessages,
        { role: "assistant", content: "抱歉，QPT 刚刚出了点问题。请再试一次。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex h-dvh flex-col bg-black text-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <button
          onClick={() => setShowHistory(true)}
          className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-800"
        >
          历史
        </button>

        <h1 className="text-lg font-semibold">QPT</h1>

        <button
          onClick={startNewChat}
          className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-800"
        >
          新对话
        </button>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-5">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-3 text-base leading-relaxed"
                  : "mr-auto max-w-[85%] whitespace-pre-wrap rounded-2xl bg-zinc-900 px-4 py-3 text-base leading-relaxed"
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
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
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

      {showHistory ? (
        <div className="absolute inset-0 z-10 bg-black/60">
          <div className="flex h-full w-[82%] max-w-sm flex-col border-r border-zinc-800 bg-zinc-950">
            <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
              <h2 className="font-semibold">历史记录</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-800"
              >
                关闭
              </button>
            </div>

            <div className="border-b border-zinc-800 p-3">
              <button
                onClick={startNewChat}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black active:bg-zinc-200"
              >
                + 新对话
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {conversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={
                    conversation.id === activeConversationId
                      ? "mb-1 rounded-xl bg-zinc-800 p-3"
                      : "mb-1 rounded-xl p-3 active:bg-zinc-900"
                  }
                >
                  <button
                    onClick={() => openConversation(conversation.id)}
                    className="w-full text-left"
                  >
                    <div className="line-clamp-1 text-sm font-medium">
                      {conversation.title}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {new Date(conversation.updatedAt).toLocaleDateString("zh-CN")}
                    </div>
                  </button>

                  <button
                    onClick={() => deleteConversation(conversation.id)}
                    className="mt-2 text-xs text-zinc-500 active:text-red-400"
                  >
                    删除
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}