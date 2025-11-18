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

  console.log(JSON.stringify(payload))

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

export type LoginResult = {
  access_token: string;
  token_type: string;
};

export async function login(email: string, password: string): Promise<LoginResult> {
  // OAuth2 password grant expects form-encoded body
  const body = new URLSearchParams();
  body.append('grant_type', 'password');
  body.append('username', email);
  body.append('password', password);

  const res = await fetch(`${API_BASE_URL}/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });

  if (!res.ok) {
    let detail = 'Login failed';
    try {
      const err = await res.json();
      if (err?.detail) detail = String(err.detail);
      else if (err?.message) detail = String(err.message);
    } catch (_) {}
    throw new Error(detail);
  }

  const json = await res.json();
  return json as LoginResult;
}
