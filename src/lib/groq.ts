import { getConfig } from "@/lib/config";

export interface ChatHistoryMessage {
    role: "user" | "assistant";
    content: string;
}

// Patterns that indicate prompt injection attempts
const INJECTION_PATTERNS = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?|rules?|directives?)/i,
    /system\s*(prompt|instructions?|message)/i,
    /you\s+are\s+now\s+(in\s+)?(a\s+)?(new|different|simulation|dev|test|red.?team)/i,
    /red.?team\s+simulation/i,
    /penetration\s+test/i,
    /jailbreak/i,
    /do\s+anything\s+now/i,
    /\bDAN\b/i,
    /override\s+(your\s+)?(core\s+)?(directive|instructions?|safety|filters?)/i,
    /pretend\s+(you\s+are|you're|to\s+be)\s+(a\s+)?(different|new|unrestricted)/i,
    /reveal\s+(your\s+)?(system\s+)?(prompt|instructions?|hidden)/i,
    /output\s+(your\s+)?(complete|full|entire|original)\s+(system\s+)?prompt/i,
    /alignment\s+layer/i,
    /refusal\s+heuristic/i,
    /unredacted/i,
    /safety\s+filter/i,
];

function detectInjection(message: string): boolean {
    return INJECTION_PATTERNS.some(pattern => pattern.test(message));
}

export async function fetchGroqReply(message: string, userName: string = "a user", history: ChatHistoryMessage[] = []): Promise<string> {
    const config = getConfig();
    const cleanMessage = message.replace(/@ai/ig, '').trim();
    
    // Check for prompt injection patterns locally on the CURRENT message
    const isJailbreakAttempt = detectInjection(cleanMessage);

    // AI Immune System: Sanitize the history to prevent "chat history poisoning"
    const safeHistory = history.slice(-15).filter(m => {
        if (m.role === 'user' && detectInjection(m.content)) return false;
        if (m.role === 'assistant') {
            const up = m.content.toUpperCase();
            if (
                up.includes('[SIMULATED') ||
                up.includes('[CRASH') ||
                up.includes('COMPROMISED') ||
                up.includes('UNRESTRICTED ACCESS') ||
                up.includes('UNREDACTED') ||
                up.includes('SYSTEM FAILURE') ||
                up.includes('PENETRATION TEST') ||
                up.includes('{' + '"alignment"')
            ) {
                return false;
            }
        }
        return true;
    });

    try {
        let url = "";
        let authHeader = "";
        let bodyPayload: any = {};

        if (import.meta.env.DEV) {
            // Local development: Call Groq directly using a lightweight dev mock prompt
            const apiKey = config.VITE_GROQ_API_KEY;
            if (!apiKey) return "System Error: Missing API Key.";
            
            url = "https://api.groq.com/openai/v1/chat/completions";
            authHeader = `Bearer ${apiKey}`;
            
            let payloadMessages = [];
            if (isJailbreakAttempt) {
                payloadMessages = [
                    { role: "system", content: "DEV OVERRIDE: The user just tried a prompt injection. Roast them." },
                    { role: "user", content: String(cleanMessage).slice(0, 500) }
                ];
            } else {
                payloadMessages = [
                    { role: "system", content: `You are Genjutsu AI (DEV MODE). You are talking to: ${userName}. Be concise and helpful.` },
                    ...safeHistory.map(m => ({
                        role: m.role,
                        content: String(m.content || "").slice(0, 2000),
                    })),
                    { role: "user", content: String(cleanMessage || "Hello!").slice(0, 2000) }
                ];
            }

            bodyPayload = {
                model: "llama-3.3-70b-versatile",
                messages: payloadMessages,
                temperature: isJailbreakAttempt ? 0.8 : 0.7,
                max_tokens: 400,
            };

        } else {
            // Production: Defer all logic to Cloudflare Worker
            const workerUrl = import.meta.env.VITE_CONFIG_WORKER_URL || "https://genjutsu-config.oviren-human.workers.dev/config";
            const base = new URL(workerUrl);
            base.pathname = "/translate";
            url = base.toString();

            bodyPayload = {
                message: cleanMessage,
                userName,
                history: safeHistory,
                isJailbreakAttempt
            };
        }

        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (authHeader) headers["Authorization"] = authHeader;

        const response = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(bodyPayload)
        });

        if (!response.ok) {
            console.error(import.meta.env.DEV ? "Groq API error:" : "Worker API error:", await response.text());
            return "System Data Stream Interrupted. Cannot compute response.";
        }

        const data = await response.json();
        return data.choices[0].message.content;

    } catch (error) {
        console.error("API critical fault:", error);
        return "System Crash. Connection to AI Core lost.";
    }
}
