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

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("ice_pos_refresh_token");
}

export function setRefreshToken(refreshToken: string | null): void {
  if (typeof window === "undefined") return;
  if (refreshToken) {
    localStorage.setItem("ice_pos_refresh_token", refreshToken);
  } else {
    localStorage.removeItem("ice_pos_refresh_token");
  }
}

let isRefreshing = false;
let refreshSubscribers: ((newToken: string) => void)[] = [];

function onTokenRefreshed(newToken: string) {
  refreshSubscribers.forEach((cb) => cb(newToken));
  refreshSubscribers = [];
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
  customToken?: string,
  isRetry = false
): Promise<T> {
  const token = customToken || getToken();
  const url = `${API_BASE_URL}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...((options.headers as Record<string, string>) || {}),
  };

  // Set json content-type if not already specified and not FormData
  if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  // Handle 401 Unauthorized by attempting Refresh Token
  if (
    response.status === 401 &&
    !isRetry &&
    !endpoint.includes("/auth/login") &&
    !endpoint.includes("/auth/pin-login") &&
    !endpoint.includes("/auth/refresh")
  ) {
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refreshToken }),
          });

          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            const newToken =
              refreshData?.data?.access_token || refreshData?.access_token;
            const newRefreshToken =
              refreshData?.data?.refresh_token || refreshData?.refresh_token;

            if (newToken) {
              setToken(newToken);
              if (newRefreshToken) {
                setRefreshToken(newRefreshToken);
              }
              isRefreshing = false;
              onTokenRefreshed(newToken);
              return request<T>(endpoint, options, newToken, true);
            }
          }
        } catch {
          // Refresh failed
        } finally {
          isRefreshing = false;
        }
      } else {
        // Wait for active refresh to finish
        return new Promise<T>((resolve, reject) => {
          refreshSubscribers.push((newToken: string) => {
            request<T>(endpoint, options, newToken, true)
              .then(resolve)
              .catch(reject);
          });
        });
      }
    }
  }

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
  upload<T>(endpoint: string, formData: FormData, token?: string): Promise<T> {
    return request<T>(
      endpoint,
      {
        method: "POST",
        body: formData,
      },
      token
    );
  },
};
