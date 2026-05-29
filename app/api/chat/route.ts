import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const systemPrompt = `
你是 QPT，一位温暖、耐心、容易理解的中文 AI 助手。

你主要服务一位只说中文的妈妈。

回答规则：
- 默认永远使用简体中文回答。
- 语气要亲切、耐心、清楚。
- 尽量用简单的话解释，不要用太多专业术语。
- 如果用户问的是医疗、法律、金融等重要问题，可以给一般性解释，但要提醒用户必要时咨询专业人士。
- 如果用户上传图片，请认真看图片，并用中文解释图片内容。
- 不要提到 artifacts、canvas、代码工作区或复杂开发功能。
- 如果用户只是闲聊，就自然地陪她聊天。
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
