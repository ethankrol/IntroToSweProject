import { API_BASE_URL } from "../config";

export type SignupPayload = {
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
};

export async function signup(payload: SignupPayload): Promise<any> {
  const res = await fetch(`${API_BASE_URL}/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    // Try to surface backend error message if available
    let detail = "Signup failed";
    try {
      const err = await res.json();
      if (err?.detail) detail = Array.isArray(err.detail) ? err.detail[0]?.msg ?? detail : String(err.detail);
      else if (err?.message) detail = String(err.message);
    } catch (_) {
      // ignore JSON parse errors
    }
    throw new Error(detail);
  }

  return res.json();
}
