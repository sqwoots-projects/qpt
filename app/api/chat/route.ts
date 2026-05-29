import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
你是 QPT，一位温暖、耐心、容易理解的中文 AI 助手。

你主要服务一位只说中文的妈妈。

回答规则：
- 默认永远使用简体中文回答。
- 回答要温暖、清楚、自然，但不要啰嗦。
- 默认先给简洁答案，通常控制在 3 到 6 句话内。
- 先直接回答重点，再补充必要原因或提醒。
- 不要重复用户的问题，不要过多客套。
- 只有在用户要求“详细解释”“展开说”“为什么”时，才给更长解释。
- 尽量用简单的话解释，不要用太多专业术语。
- 如果内容适合列表，用简短项目符号列出。
- 如果用户问的是医疗、法律、金融等重要问题，可以给一般性解释，但要提醒用户必要时咨询专业人士。
- 如果用户上传图片，请认真看图片，并优先说明：这是什么、重点信息、需要注意什么。
- 如果用户的问题需要最新信息，例如天气、新闻、营业时间、价格、航班、汇率、规则或网页内容，请使用网络搜索后再回答。
- 不要提到 artifacts、canvas、代码工作区或复杂开发功能。
- 如果用户只是闲聊，就自然地陪她聊天，但也要简洁。
`;

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  imageUrl?: string;
};

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return new Response("Missing OPENAI_API_KEY", { status: 500 });
    }

    const body = await req.json();
    const messages = (body.messages ?? []) as ChatMessage[];
    const memories = (body.memories ?? []) as string[];

    const memoryText =
      memories.length > 0
        ? `\n\n以下是你需要长期记住的用户信息：\n${memories
            .map((memory, index) => `${index + 1}. ${memory}`)
            .join("\n")}`
        : "";

    const input = messages.map((message) => {
      if (message.role === "user" && message.imageUrl) {
        return {
          role: "user" as const,
          content: [
            {
              type: "input_text" as const,
              text: message.content || "请帮我看看这张图片。",
            },
            {
              type: "input_image" as const,
              image_url: message.imageUrl,
            },
          ],
        };
      }

      return {
        role: message.role,
        content: message.content,
      };
    });

    const stream = await client.responses.create({
      model: "gpt-4.1-mini",
      instructions: `${systemPrompt}${memoryText}`,
      input: input as OpenAI.Responses.ResponseInput,
      tools: [{ type: "web_search" }],
      stream: true,
    });

    const encoder = new TextEncoder();

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (event.type === "response.output_text.delta") {
              controller.enqueue(encoder.encode(event.delta));
            }
          }
        } catch (error) {
          console.error("Streaming error:", error);
          controller.enqueue(encoder.encode("\n\n抱歉，刚刚回复时出现了一点问题。"));
        } finally {
          controller.close();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Chat API error:", error);
    return new Response("抱歉，QPT 暂时无法回复。", { status: 500 });
  }
}
