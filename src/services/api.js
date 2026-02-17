const API_BASE = import.meta.env.VITE_API_BASE;
const API_KEY = import.meta.env.VITE_WP_API_KEY;

export async function fetchLeads() {
  const res = await fetch(`${API_BASE}/leads`, {
    headers: {
      "X-API-KEY": API_KEY
    }
  });

  if (!res.ok) {
    throw new Error("API error: " + res.status);
  }

  return res.json();
}
