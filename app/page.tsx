"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
const APP_VERSION = "v0.3.1";

const welcomeMessage: Message = {
  role: "assistant",
  content: "你好，我是 绮PT。有什么我可以帮你的吗？",
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

function MarkdownMessage({ content }: { content: string }) {
  return (
    <div className="text-[16px] leading-[1.6] text-[#223127]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="mb-2 mt-1 text-xl font-semibold leading-snug text-[#18231c]">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="mb-2 mt-1 text-lg font-semibold leading-snug text-[#18231c]">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="mb-1 mt-1 text-base font-semibold leading-snug text-[#18231c]">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="my-1 first:mt-0 last:mb-0">{children}</p>
          ),
          ul: ({ children }) => (
            <ul className="my-1 list-disc space-y-0.5 pl-5">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-1 list-decimal space-y-0.5 pl-5">{children}</ol>
          ),
          li: ({ children }) => <li>{children}</li>,
          strong: ({ children }) => (
            <strong className="font-semibold text-[#18231c]">{children}</strong>
          ),
          em: ({ children }) => <em className="italic">{children}</em>,
          a: ({ children, href }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className="text-[#426a50] underline underline-offset-2"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="rounded-md bg-[#edf2ec] px-1.5 py-0.5 font-mono text-[14px] text-[#26372b]">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 overflow-x-auto rounded-2xl bg-[#edf2ec] p-3 text-sm leading-6 text-[#26372b]">
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <div className="my-2 overflow-x-auto rounded-xl border border-[#dfe8dd]">
              <table className="w-full border-collapse text-sm leading-6">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border-b border-[#dfe8dd] bg-[#f1f6f0] px-3 py-2 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border-b border-[#e8eee6] px-3 py-2 align-top">
              {children}
            </td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
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

  const scrollRef = useRef<HTMLDivElement>(null);

  const activeConversation = useMemo(() => {
    return conversations.find(
      (conversation) => conversation.id === activeConversationId,
    );
  }, [activeConversationId, conversations]);

  const messages = activeConversation?.messages ?? [welcomeMessage];
  const latestMessageContent = messages[messages.length - 1]?.content ?? "";

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

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages.length, latestMessageContent]);

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
    setShowMemory(false);
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
        { role: "assistant", content: "抱歉，绮PT 刚刚出了点问题。请再试一次。" },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="fixed inset-0 flex flex-col overflow-hidden bg-[#fbfaf3] text-[#223127]">      <header className="z-20 shrink-0 bg-[#fbfaf3]/85 px-2 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="relative flex h-14 items-center">
          <button
            onClick={() => setShowHistory(true)}
            aria-label="菜单"
            className="flex h-11 w-11 items-center justify-center rounded-full text-2xl active:bg-[#edf2ec]"
          >
            ☰
          </button>

          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <div className="text-[18px] font-bold leading-none tracking-tight text-[#466a55]">
              绮PT
            </div>
            <div className="mt-1 text-[10px] font-medium leading-none text-[#7f8d80]">
              {APP_VERSION}
            </div>
          </div>

          <button
            onClick={startNewChat}
            aria-label="新对话"
            className="ml-auto flex h-11 w-11 items-center justify-center rounded-full text-2xl active:bg-[#edf2ec]"
          >
            ✎
          </button>
        </div>
      </header>

      <section ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3">
        {messages.length <= 1 ? (
          <div className="flex h-full flex-col items-center justify-center px-5 text-center">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[28px] bg-white shadow-[0_16px_40px_-24px_rgba(70,106,85,0.65)] ring-1 ring-[#e4ebe2]">
              <img
                src="/icon-512.png"
                alt="绮PT"
                className="h-full w-full object-contain"
              />
            </div>

            <h1 className="mt-7 text-[28px] font-bold tracking-tight text-[#223127]">
              你好，我是 绮PT
            </h1>

            <p className="mt-2 text-[16px] text-[#6f7f73]">
              有什么我可以帮您的吗？
            </p>

            <div className="mt-7 grid w-full max-w-sm grid-cols-2 gap-2 text-left">
              {[
                "帮我看这张照片",
                "今天的天气",
                "帮我翻译一下",
                "帮我写一段话",
              ].map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setInput(prompt)}
                  className="rounded-2xl bg-white px-4 py-3 text-[14px] font-medium text-[#405145] shadow-sm ring-1 ring-[#e8eee6] active:bg-[#f1f6f0]"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto flex max-w-xl flex-col gap-3 pb-3">
            {messages.map((message, index) => (
              <div
                key={index}
                className={message.role === "user" ? "flex justify-end" : "flex justify-start"}
              >
                <div
                  className={
                    message.role === "user"
                      ? "max-w-[75%] whitespace-pre-wrap break-words rounded-[26px] bg-[#466a55] px-4 py-2.5 text-[16px] leading-[1.55] text-white shadow-[0_8px_20px_-12px_rgba(70,106,85,0.7)]"
                      : "max-w-[85%] rounded-[26px] border border-[#e1eadf] bg-white px-5 py-4 shadow-[0_10px_28px_-24px_rgba(70,106,85,0.5)]"
                  }
                  style={
                    message.role === "user"
                      ? { borderBottomRightRadius: 10 }
                      : { borderBottomLeftRadius: 10 }
                  }
                >
                  {message.imageUrl ? (
                    <img
                      src={message.imageUrl}
                      alt="上传的图片"
                      className="mb-3 max-h-72 w-full rounded-2xl object-cover"
                    />
                  ) : null}

                  {message.role === "assistant" ? (
                    <MarkdownMessage
                      content={
                        message.content
                          ? `${message.content}${isLoading && index === messages.length - 1 ? " ▌" : ""}`
                          : isLoading && index === messages.length - 1
                            ? "正在回复 ▌"
                            : ""
                      }
                    />
                  ) : (
                    message.content
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <footer className="pointer-events-none shrink-0 bg-gradient-to-t from-[#fbfaf3] via-[#fbfaf3]/95 to-transparent px-3 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] pt-2">
        <div className="pointer-events-auto mx-auto max-w-xl rounded-[28px] border border-[#dfe8dd] bg-white px-2 py-1.5 shadow-[0_12px_36px_-22px_rgba(70,106,85,0.6)]">
          {selectedImageUrl ? (
            <div className="mb-2 flex items-center gap-2 rounded-3xl bg-[#f1f6f0] p-2">
              <img
                src={selectedImageUrl}
                alt="准备发送的图片"
                className="h-16 w-16 rounded-2xl object-cover"
              />

              <button
                onClick={() => setSelectedImageUrl(null)}
                className="rounded-full px-3 py-2 text-sm text-[#6f7f73] active:bg-white"
              >
                移除图片
              </button>
            </div>
          ) : null}

          <div className="flex items-end gap-2">
            <label className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e9f1e7] text-xl active:scale-95">
              ＋
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
              placeholder={selectedImageUrl ? "想问这张图片什么？" : "发消息…"}
              className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[16px] leading-[1.4] text-[#223127] outline-none placeholder:text-[#9aa69b]"
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
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#466a55] text-xl font-bold text-white shadow-[0_8px_18px_-10px_rgba(70,106,85,0.9)] disabled:bg-[#e0e8df] disabled:text-[#9aa69b]"
            >
              ↑
            </button>
          </div>
        </div>
      </footer>

      {showHistory ? (
        <div className="absolute inset-0 z-30 bg-black/20 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
          <div className="flex h-full w-[86%] max-w-sm flex-col rounded-r-[32px] bg-[#fbfaf3] shadow-2xl">
            <div className="flex h-14 items-center justify-between px-5">
              <h2 className="text-[20px] font-semibold text-[#223127]">历史</h2>
              <button
                onClick={() => setShowHistory(false)}
                className="rounded-full px-3 py-2 text-sm text-[#6f7f73] active:bg-[#edf2ec]"
              >
                关闭
              </button>
            </div>

            <div className="space-y-3 px-4">
              <button
                onClick={startNewChat}
                className="w-full rounded-2xl bg-[#e9f1e7] px-4 py-3 text-left text-[15px] font-medium text-[#466a55] active:bg-[#dfe8dd]"
              >
                ＋ 新对话
              </button>

              <input
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                placeholder="搜索对话"
                className="w-full rounded-2xl bg-[#f0f5ef] px-4 py-3 text-[15px] outline-none placeholder:text-[#9aa69b]"
              />

              <button
                onClick={() => {
                  setShowHistory(false);
                  setTimeout(() => setShowMemory(true), 150);
                }}
                className="w-full rounded-2xl px-4 py-3 text-left text-[15px] text-[#405145] active:bg-[#edf2ec]"
              >
                记忆
              </button>
            </div>

            <div className="mt-4 flex-1 overflow-y-auto px-2 pb-8">
              {filteredConversations.length === 0 ? (
                <p className="mt-8 text-center text-sm text-[#8a968b]">
                  没有找到相关对话。
                </p>
              ) : null}

              {filteredConversations.map((conversation) => (
                <div
                  key={conversation.id}
                  className={
                    conversation.id === activeConversationId
                      ? "mb-1 rounded-2xl bg-[#edf2ec] p-3"
                      : "mb-1 rounded-2xl p-3 active:bg-[#f0f5ef]"
                  }
                >
                  <button
                    onClick={() => openConversation(conversation.id)}
                    className="w-full text-left"
                  >
                    <div className="line-clamp-1 text-[15px] font-medium text-[#223127]">
                      {conversation.title}
                    </div>
                    <div className="mt-1 text-[12px] text-[#8a968b]">
                      {new Date(conversation.updatedAt).toLocaleDateString("zh-CN")}
                    </div>
                  </button>

                  <button
                    onClick={() => deleteConversation(conversation.id)}
                    className="mt-2 text-xs text-[#8a968b] active:text-red-500"
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
        <div className="absolute inset-0 z-40 bg-black/20 pt-[env(safe-area-inset-top)] backdrop-blur-sm">
          <div className="ml-auto flex h-full w-[88%] max-w-sm flex-col rounded-l-[32px] bg-[#fbfaf3] shadow-2xl">
            <div className="flex h-14 items-center justify-between px-5">
              <div>
                <h2 className="text-[20px] font-semibold text-[#223127]">记忆</h2>
                <p className="text-[12px] text-[#7f8d80]">绮PT 会参考这些记忆</p>
              </div>

              <button
                onClick={() => setShowMemory(false)}
                className="rounded-full px-3 py-2 text-sm text-[#6f7f73] active:bg-[#edf2ec]"
              >
                关闭
              </button>
            </div>

            <div className="space-y-2 px-4 py-3">
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
                className="w-full rounded-2xl bg-[#f0f5ef] px-4 py-3 text-[15px] outline-none placeholder:text-[#9aa69b]"
              />

              <button
                onClick={addMemory}
                className="w-full rounded-2xl bg-[#466a55] px-4 py-3 text-[15px] font-medium text-white active:bg-[#395845]"
              >
                添加记忆
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8">
              {memories.length === 0 ? (
                <p className="mt-8 text-center text-sm text-[#8a968b]">
                  还没有记忆。
                </p>
              ) : (
                <div className="space-y-2.5">
                  {memories.map((memory, index) => (
                    <div key={`${memory}-${index}`} className="rounded-2xl bg-[#f0f5ef] p-4">
                      <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-[#405145]">
                        {memory}
                      </p>

                      <button
                        onClick={() => deleteMemory(index)}
                        className="mt-2 text-xs text-[#8a968b] active:text-red-500"
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