/**
 * API Client for ICE POS v2
 * Connects to http://127.0.0.1:8080/api/v1
 */

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8080/api/v1";

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ice_pos_token");
}

export function setToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) {
    localStorage.setItem("ice_pos_token", token);
  } else {
    localStorage.removeItem("ice_pos_token");
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  customToken?: string
): Promise<T> {
  const token = customToken || getToken();
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `HTTP Error ${response.status}: ${response.statusText}`;
    let errorData: unknown = null;
    try {
      errorData = await response.json();
      if (
        typeof errorData === "object" &&
        errorData !== null &&
        "message" in errorData
      ) {
        errorMsg = (errorData as { message: string }).message;
      }
    } catch {
      // Ignore json parse error
    }
    throw new ApiError(response.status, errorMsg, errorData);
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

export const apiClient = {
  get<T>(endpoint: string, token?: string): Promise<T> {
    return request<T>(endpoint, { method: "GET" }, token);
  },
  post<T>(endpoint: string, body?: unknown, token?: string): Promise<T> {
    return request<T>(
      endpoint,
      {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      },
      token
    );
  },
  put<T>(endpoint: string, body?: unknown, token?: string): Promise<T> {
    return request<T>(
      endpoint,
      {
        method: "PUT",
        body: body ? JSON.stringify(body) : undefined,
      },
      token
    );
  },
  delete<T>(endpoint: string, token?: string): Promise<T> {
    return request<T>(endpoint, { method: "DELETE" }, token);
  },
};
