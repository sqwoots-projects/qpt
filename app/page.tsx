"use client";

import { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Message = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
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
const MEMORY_KEY = "qpt_memories";

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

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSize = 1280;
        const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
        const width = Math.round(image.width * scale);
        const height = Math.round(image.height * scale);

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("Could not resize image"));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.78));
      };

      image.onerror = () => reject(new Error("Could not load image"));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("Could not read image"));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>("");
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMemory, setShowMemory] = useState(false);
  const [memories, setMemories] = useState<string[]>([]);
  const [newMemory, setNewMemory] = useState("");
  const [historySearch, setHistorySearch] = useState("");
  const [selectedImageUrl, setSelectedImageUrl] = useState<string | null>(null);

  const activeConversation = useMemo(() => {
    return conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
  }, [activeConversationId, conversations]);

  const messages = activeConversation?.messages ?? [welcomeMessage];

  const filteredConversations = useMemo(() => {
    const keyword = historySearch.trim().toLowerCase();
    if (!keyword) return conversations;

    return conversations.filter((conversation) => {
      const titleMatch = conversation.title.toLowerCase().includes(keyword);
      const messageMatch = conversation.messages.some((message) =>
        message.content.toLowerCase().includes(keyword),
      );

      return titleMatch || messageMatch;
    });
  }, [conversations, historySearch]);

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
    const savedMemories = localStorage.getItem(MEMORY_KEY);
    if (!savedMemories) return;

    try {
      const parsed = JSON.parse(savedMemories) as string[];
      setMemories(parsed);
    } catch (error) {
      console.error("Failed to load memories:", error);
    }
  }, []);

  useEffect(() => {
    if (conversations.length === 0) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
  }, [conversations]);

  useEffect(() => {
    if (!activeConversationId) return;
    localStorage.setItem(ACTIVE_CONVERSATION_KEY, activeConversationId);
  }, [activeConversationId]);

  useEffect(() => {
    localStorage.setItem(MEMORY_KEY, JSON.stringify(memories));
  }, [memories]);

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
    setHistorySearch("");
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

  function addMemory() {
    const text = newMemory.trim();
    if (!text) return;

    setMemories((previous) => [text, ...previous]);
    setNewMemory("");
  }

  function deleteMemory(indexToDelete: number) {
    setMemories((previous) =>
      previous.filter((_, index) => index !== indexToDelete),
    );
  }

  async function handleImageChange(file: File | undefined) {
    if (!file || isLoading) return;

    if (!file.type.startsWith("image/")) {
      alert("请选择图片文件。");
      return;
    }

    try {
      const imageUrl = await resizeImageToDataUrl(file);
      setSelectedImageUrl(imageUrl);
    } catch (error) {
      console.error(error);
      alert("图片处理失败，请换一张图片试试。");
    }
  }

  async function autoSaveMemories(finalMessages: Message[]) {
    try {
      const response = await fetch("/api/memory", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: finalMessages,
          existingMemories: memories,
        }),
      });

      if (!response.ok) return;

      const data = (await response.json()) as { memories?: string[] };
      const suggestedMemories = data.memories ?? [];
      if (suggestedMemories.length === 0) return;

      setMemories((previous) => {
        const existingSet = new Set(previous.map((memory) => memory.trim()));
        const newMemories = suggestedMemories
          .map((memory) => memory.trim())
          .filter((memory) => memory && !existingSet.has(memory));

        if (newMemories.length === 0) return previous;

        return [...newMemories, ...previous].slice(0, 50);
      });
    } catch (error) {
      console.error("Failed to auto-save memories:", error);
    }
  }

  async function sendMessage() {
    const text = input.trim();
    if ((!text && !selectedImageUrl) || isLoading || !activeConversation) return;

    const userMessage: Message = {
      role: "user",
      content: text || "请帮我看看这张图片。",
      imageUrl: selectedImageUrl ?? undefined,
    };

    const nextMessages: Message[] = [...activeConversation.messages, userMessage];

    updateActiveConversation([...nextMessages, { role: "assistant", content: "" }]);
    setInput("");
    setSelectedImageUrl(null);
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages: nextMessages, memories }),
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

      if (assistantText.trim()) {
        await autoSaveMemories([
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
    <main className="relative flex h-[100dvh] flex-col overflow-hidden bg-black pt-[env(safe-area-inset-top)] text-white">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-800 px-4">
        <button
          onClick={() => setShowHistory(true)}
          className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-800"
        >
          历史
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowMemory(true)}
            className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-800"
          >
            记忆
          </button>

          <div className="flex flex-col items-center">
            <h1 className="text-lg font-semibold">QPT</h1>
            <span className="text-[10px] text-zinc-500">v0.1.4</span>
          </div>
        </div>

        <button
          onClick={startNewChat}
          className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-800"
        >
          新对话
        </button>
      </header>

      <section className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {messages.map((message, index) => (
            <div
              key={index}
              className={
                message.role === "user"
                  ? "ml-auto max-w-[82%] whitespace-pre-wrap rounded-2xl bg-blue-600 px-4 py-3 text-base leading-6"
                  : "mr-auto max-w-[82%] rounded-2xl bg-zinc-900 px-4 py-3 text-base leading-6"
              }
            >
              {message.imageUrl ? (
                <img
                  src={message.imageUrl}
                  alt="上传的图片"
                  className="mb-3 max-h-64 w-full rounded-xl object-cover"
                />
              ) : null}
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => (
                    <h1 className="mb-2 text-xl font-bold leading-snug">{children}</h1>
                  ),
                  h2: ({ children }) => (
                    <h2 className="mb-2 text-lg font-bold leading-snug">{children}</h2>
                  ),
                  h3: ({ children }) => (
                    <h3 className="mb-1 text-base font-bold leading-snug">{children}</h3>
                  ),
                  p: ({ children }) => (
                    <p className="mb-1 leading-6 last:mb-0">{children}</p>
                  ),
                  ul: ({ children }) => (
                    <ul className="my-1 list-disc space-y-0 pl-4 leading-6">{children}</ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="my-1 list-decimal space-y-0 pl-4 leading-6">{children}</ol>
                  ),
                  li: ({ children }) => <li className="pl-0">{children}</li>,
                  strong: ({ children }) => (
                    <strong className="font-semibold">{children}</strong>
                  ),
                  em: ({ children }) => <em className="italic">{children}</em>,
                  a: ({ children, href }) => (
                    <a
                      href={href}
                      target="_blank"
                      rel="noreferrer"
                      className="underline underline-offset-2"
                    >
                      {children}
                    </a>
                  ),
                  code: ({ children }) => (
                    <code className="rounded bg-black/30 px-1 py-0.5 text-sm">
                      {children}
                    </code>
                  ),
                  pre: ({ children }) => (
                    <pre className="my-2 overflow-x-auto rounded-xl bg-black/40 p-3 text-sm leading-6">
                      {children}
                    </pre>
                  ),
                  table: ({ children }) => (
                    <div className="my-2 overflow-x-auto">
                      <table className="w-full border-collapse text-sm leading-6">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th className="border border-zinc-700 px-2 py-1 text-left font-semibold">
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td className="border border-zinc-700 px-2 py-1 align-top">{children}</td>
                  ),
                }}
              >
                {message.content
                  ? `${message.content}${isLoading && index === messages.length - 1 ? " ▌" : ""}`
                  : isLoading && index === messages.length - 1
                    ? "正在回复 ▌"
                    : ""}
              </ReactMarkdown>
            </div>
          ))}
        </div>
      </section>

      <footer className="shrink-0 border-t border-zinc-800 bg-black px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
        <div className="mx-auto max-w-xl rounded-2xl bg-zinc-900 p-2">
          {selectedImageUrl ? (
            <div className="mb-2 flex items-start gap-2 rounded-xl bg-zinc-800 p-2">
              <img
                src={selectedImageUrl}
                alt="准备发送的图片"
                className="h-16 w-16 rounded-lg object-cover"
              />
              <button
                onClick={() => setSelectedImageUrl(null)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-700"
              >
                移除图片
              </button>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <label className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-lg active:bg-zinc-700">
              📷
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => {
                  handleImageChange(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </label>

            <textarea
              placeholder={selectedImageUrl ? "想问这张图片什么？" : "输入你的问题…"}
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
              disabled={isLoading || (!input.trim() && !selectedImageUrl)}
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              发送
            </button>
          </div>
        </div>
      </footer>

      {showHistory ? (
        <div className="absolute inset-0 z-10 bg-black/60 pt-[env(safe-area-inset-top)]">
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

            <div className="space-y-3 border-b border-zinc-800 p-3">
              <button
                onClick={startNewChat}
                className="w-full rounded-xl bg-white px-4 py-3 text-sm font-semibold text-black active:bg-zinc-200"
              >
                + 新对话
              </button>

              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="搜索历史记录…"
                className="w-full rounded-xl bg-zinc-900 px-3 py-3 text-sm outline-none placeholder:text-zinc-500"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {filteredConversations.length === 0 ? (
                <p className="mt-6 text-center text-sm text-zinc-500">
                  没有找到相关对话。
                </p>
              ) : null}

              {filteredConversations.map((conversation) => (
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

      {showMemory ? (
        <div className="absolute inset-0 z-20 bg-black/60 pt-[env(safe-area-inset-top)]">
          <div className="ml-auto flex h-full w-[88%] max-w-sm flex-col border-l border-zinc-800 bg-zinc-950">
            <div className="flex h-14 items-center justify-between border-b border-zinc-800 px-4">
              <h2 className="font-semibold">记忆</h2>
              <button
                onClick={() => setShowMemory(false)}
                className="rounded-lg px-3 py-2 text-sm text-zinc-300 active:bg-zinc-800"
              >
                关闭
              </button>
            </div>

            <div className="border-b border-zinc-800 p-3">
              <p className="mb-3 text-sm leading-relaxed text-zinc-400">
                QPT 会自动保存长期有用的记忆。这里主要用于查看、补充或删除记忆。
              </p>
              <div className="flex gap-2">
                <input
                  value={newMemory}
                  onChange={(event) => setNewMemory(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      addMemory();
                    }
                  }}
                  placeholder="添加一条记忆…"
                  className="min-w-0 flex-1 rounded-xl bg-zinc-900 px-3 py-2 text-sm outline-none placeholder:text-zinc-500"
                />
                <button
                  onClick={addMemory}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-black active:bg-zinc-200"
                >
                  添加
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {memories.length === 0 ? (
                <p className="mt-6 text-center text-sm text-zinc-500">
                  暂时没有记忆。
                </p>
              ) : (
                <div className="space-y-2">
                  {memories.map((memory, index) => (
                    <div
                      key={`${memory}-${index}`}
                      className="rounded-xl bg-zinc-900 p-3"
                    >
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {memory}
                      </p>
                      <button
                        onClick={() => deleteMemory(index)}
                        className="mt-2 text-xs text-zinc-500 active:text-red-400"
                      >
                        删除
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}