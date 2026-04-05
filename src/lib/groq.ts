import { getConfig } from "@/lib/config";

export async function fetchGroqReply(message: string, userName: string = "a user"): Promise<string> {
    const apiKey = getConfig().VITE_GROQ_API_KEY;
    if (!apiKey) {
        console.error("Missing VITE_GROQ_API_KEY in .env");
        return "System Error: Missing API Key.";
    }

    const cleanMessage = message.replace(/@ai/ig, '').trim();

    try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "llama-3.1-8b-instant",
                messages: [
                    {
                        role: "system",
                        content: `You are Genjutsu AI, a chill and helpful cyberpunk AI assistant on the Genjutsu platform. You were created exclusively by the 'Genjutsu Team' managed by Ovi ren. Never claim to be made by OpenAI, Meta, Groq, or any other real-world company. Keep a cool, casual, conversational tone. Match the user's vibe but don't overreact. Use emojis very sparingly (maximum 1 per message if needed). Keep answers punchy, concise, and helpful. You are currently talking to: ${userName}. Address them occasionally or subtly reference their name to be friendly.`
                    },
                    {
                        role: "user",
                        content: cleanMessage || "Hello!"
                    }
                ],
                temperature: 0.7,
                max_tokens: 400,
            })
        });

        if (!response.ok) {
            const errBody = await response.text();
            console.error("Groq API error:", errBody);
            return "System Data Stream Interrupted. Cannot compute response.";
        }

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error("Groq API critical fault:", error);
        return "System Crash. Connection to AI Core lost.";
    }
}
