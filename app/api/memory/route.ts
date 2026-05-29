import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const messages = (body.messages ?? []) as ChatMessage[];
    const existingMemories = (body.existingMemories ?? []) as string[];

    const recentMessages = messages
      .slice(-10)
      .map((message) => `${message.role}: ${message.content}`)
      .join("\n");

    const response = await client.responses.create({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: `
你是 QPT 的记忆整理助手。

请从对话中提取长期有用的信息。

只保存：
- 用户偏好
- 长期习惯
- 重复出现的需求
- 稳定背景信息

不要保存：
- 临时问题
- 敏感信息
- 密码
- API Key
- 银行资料
- 身份证件
- 医疗诊断
- 政治观点

只返回 JSON：

{"memories":["记忆1","记忆2"]}

如果没有值得保存的内容：

{"memories":[]}
          `,
        },
        {
          role: "user",
          content: `
现有记忆:
${existingMemories.join("\n")}

最近对话:
${recentMessages}
          `,
        },
      ],
    });

    const text = response.output_text.trim();

    try {
      const parsed = JSON.parse(text);

      return Response.json({
        memories: Array.isArray(parsed.memories)
          ? parsed.memories
          : [],
      });
    } catch {
      return Response.json({
        memories: [],
      });
    }
  } catch (error) {
    console.error("Memory API Error:", error);

    return Response.json({
      memories: [],
    });
  }
}