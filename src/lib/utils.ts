import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getConfig } from "@/lib/config";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let serverDrift = 0;

export async function syncTime() {
  try {
    const start = Date.now();
    const config = getConfig();
    const response = await fetch(config.VITE_SUPABASE_URL + '/auth/v1/health', {
      method: 'GET',
      headers: { 'apikey': config.VITE_SUPABASE_PUBLISHABLE_KEY }
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
