"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { User, AuthDataResponse, MeData } from "../types/api.ts";
import {
  apiClient,
  getToken,
  setToken,
  setRefreshToken,
} from "../services/apiClient.ts";
import { offlineStorage, hashPin } from "../services/offlineStorage.ts";

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
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isOffline, setIsOffline] = useState<boolean>(false);

  // Restore authentication state on client mount to avoid SSR hydration mismatch
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHED_USER_KEY);
      if (cached) {
        setUser(JSON.parse(cached));
      }
      const savedToken = getToken();
      if (savedToken) {
        setTokenState(savedToken);
      }
      if (typeof window !== "undefined") {
        setIsOffline(!window.navigator.onLine);
      }
    } catch (e) {
      console.warn("Failed to restore auth session from storage:", e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Monitor network status passively with window online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
    };
    const handleOffline = () => {
      setIsOffline(true);
    };

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

      // Attempt online login first if online
      if (typeof window !== "undefined" && window.navigator.onLine) {
        try {
          const res = await apiClient.post<AuthDataResponse>(
            "/auth/pin-login",
            {
              pin,
            }
          );
          if (res && res.success && res.data) {
            const { access_token, refresh_token, user: userData } = res.data;
            setToken(access_token);
            setTokenState(access_token);
            if (refresh_token) {
              setRefreshToken(refresh_token);
            }
            setUser(userData);
            localStorage.setItem(CACHED_USER_KEY, JSON.stringify(userData));

            // Cache cashier profile & hashed PIN for future offline authentications
            try {
              const pinHash = await hashPin(pin);
              await offlineStorage.saveCashier({
                id: userData.id,
                username: userData.username,
                display_name:
                  userData.display_name ||
                  userData.full_name ||
                  userData.username,
                full_name: userData.full_name,
                role: userData.role,
                is_active: userData.is_active,
                pin_hash: pinHash,
                updated_at: new Date().toISOString(),
              });
            } catch (cacheErr) {
              console.warn("Failed to cache cashier PIN hash:", cacheErr);
            }

            setIsLoading(false);
            return { success: true };
          }
          if (res && !res.success) {
            setIsLoading(false);
            return {
              success: false,
              error: res.message || "รหัส PIN ไม่ถูกต้อง",
            };
          }
        } catch (err: unknown) {
          // If network error occurred, proceed to offline check below
          console.warn(
            "Online PIN login network error, falling back to offline check:",
            err
          );
        }
      }

      // Offline fallback: verify PIN hash against cached cashiers in IndexedDB
      try {
        const pinHash = await hashPin(pin);
        const cachedCashier =
          await offlineStorage.findCashierByPinHash(pinHash);

        if (cachedCashier) {
          setUser(cachedCashier);
          const fallbackToken = getToken() || "offline-session-token";
          setToken(fallbackToken);
          setTokenState(fallbackToken);
          localStorage.setItem(CACHED_USER_KEY, JSON.stringify(cachedCashier));
          setIsLoading(false);
          return { success: true };
        }
      } catch (offlineErr) {
        console.error("Offline PIN authentication failed:", offlineErr);
      }

      setIsLoading(false);
      return {
        success: false,
        error:
          typeof window !== "undefined" && !window.navigator.onLine
            ? "รหัส PIN ไม่ถูกต้อง หรือยังไม่เคยเข้าสู่ระบบด้วยรหัสนี้บนเครื่องนี้"
            : "รหัส PIN ไม่ถูกต้อง",
      };
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
          const { access_token, refresh_token, user: userData } = res.data;
          setToken(access_token);
          setTokenState(access_token);
          if (refresh_token) {
            setRefreshToken(refresh_token);
          }
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
      setRefreshToken(null);
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
