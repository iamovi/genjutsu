import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

let serverDrift = 0;

export async function syncTime() {
  try {
    const start = Date.now();
    const response = await fetch(import.meta.env.VITE_SUPABASE_URL + '/rest/v1/', {
      method: 'HEAD',
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
