import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let serverDrift = 0;

export async function syncTime() {
  try {
    const start = Date.now();
    const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/auth/v1/health', {
      method: 'GET',
      headers: { 'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY }
    });
    const serverDate = response.headers.get('date');
    if (!serverDate) return;

    const serverTime = new Date(serverDate).getTime();
    const end = Date.now();
    const rtt = end - start;

    // Calculate the drift between local and server time, accounting for RTT
    serverDrift = serverTime - (end - rtt / 2);
  } catch (e) {
    console.error("Failed to sync with server time:", e);
  }
}

export function getNow() {
  return new Date(Date.now() + serverDrift);
}

export function isTextEnglish(text: string): boolean {
  const trimmedText = text.trim();
  if (!trimmedText) return true;
  
  // If it contains characters from non-Latin scripts (Cyrillic, Arabic, CJK, Bengali, Hindi, Thai, Hebrew, Greek, etc), it's definitely not English
  const hasOtherScripts = /[\u0400-\u04FF\u0600-\u06FF\u4E00-\u9FFF\u3040-\u30FF\uAC00-\uD7AF\u0980-\u09FF\u0900-\u097F\u0E00-\u0E7F\u0370-\u03FF\u0590-\u05FF\u0B80-\u0BFF\u0A80-\u0AFF\u0C00-\u0C7F]/.test(trimmedText);
  if (hasOtherScripts) return false;
  
  // Check for common English words (most effective heuristic for Latin-script text)
  const commonEnglishWords = /\b(the|and|is|it|you|that|in|was|for|on|are|with|as|I|be|at|have|from|this|but|his|by|they|we|say|her|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me)\b/i;
  
  // It's English if it has English words or it's very short and only ASCII
  return commonEnglishWords.test(trimmedText) || (trimmedText.length < 30 && !/[^\x00-\x7F]/.test(trimmedText));
}
