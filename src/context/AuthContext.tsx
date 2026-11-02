"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { User, AuthDataResponse, MeData } from "../types/api.ts";
import { apiClient, getToken, setToken } from "../services/apiClient.ts";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isOffline: boolean;
  loginWithPin: (pin: string) => Promise<{ success: boolean; error?: string }>;
  loginWithCredentials: (
    username: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const CACHED_USER_KEY = "ice_pos_cached_user";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<User | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem(CACHED_USER_KEY);
        if (cached) return JSON.parse(cached);
      } catch {
        // ignore
      }
    }
    return null;
  });

  const [token, setTokenState] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      return getToken();
    }
    return null;
  });

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const [isOffline, setIsOffline] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return !window.navigator.onLine;
    }
    return false;
  });

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Validate token with backend if online
  useEffect(() => {
    let active = true;
    if (token && typeof window !== "undefined" && window.navigator.onLine) {
      apiClient
        .get<{ data: MeData; success: boolean }>("/auth/me", token)
        .then((meRes) => {
          if (active && meRes?.data?.user) {
            setUser(meRes.data.user);
            localStorage.setItem(
              CACHED_USER_KEY,
              JSON.stringify(meRes.data.user)
            );
          }
        })
        .catch((err) => {
          console.warn(
            "Could not verify session with /auth/me, keeping cached session:",
            err
          );
        });
    }
    return () => {
      active = false;
    };
  }, [token]);

  const loginWithPin = useCallback(
    async (pin: string): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const res = await apiClient.post<AuthDataResponse>("/auth/pin-login", {
          pin,
        });
        if (res && res.success && res.data) {
          const { access_token, user: userData } = res.data;
          setToken(access_token);
          setTokenState(access_token);
          setUser(userData);
          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
          setIsLoading(false);
          return { success: true };
        }
        setIsLoading(false);
        return { success: false, error: res.message || "รหัส PIN ไม่ถูกต้อง" };
      } catch (err: unknown) {
        setIsLoading(false);
        const msg =
          err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
        return { success: false, error: msg };
      }
    },
    []
  );

  const loginWithCredentials = useCallback(
    async (
      username: string,
      password: string
    ): Promise<{ success: boolean; error?: string }> => {
      setIsLoading(true);
      try {
        const res = await apiClient.post<AuthDataResponse>("/auth/login", {
          username,
          password,
        });
        if (res && res.success && res.data) {
          const { access_token, user: userData } = res.data;
          setToken(access_token);
          setTokenState(access_token);
          setUser(userData);
          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));
          setIsLoading(false);
          return { success: true };
        }
        setIsLoading(false);
        return {
          success: false,
          error: res.message || "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
        };
      } catch (err: unknown) {
        setIsLoading(false);
        const msg =
          err instanceof Error ? err.message : "เกิดข้อผิดพลาดในการเข้าสู่ระบบ";
        return { success: false, error: msg };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      if (typeof window !== "undefined" && window.navigator.onLine && token) {
        await apiClient.post("/auth/logout", {}, token).catch(() => {});
      }
    } finally {
      setToken(null);
      setTokenState(null);
      setUser(null);
      localStorage.removeItem(CACHED_USER_KEY);
      if (typeof window !== "undefined") {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login";
      }
    }
  }, [token]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isOffline,
        loginWithPin,
        loginWithCredentials,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
