import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const BASE_URL = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;

export interface User {
  id: number;
  email: string;
  name: string;
  phone?: string | null;
  role: "customer" | "vendor" | "admin";
  profileImage?: string | null;
  referralCode?: string | null;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  selectedRole: "customer" | "vendor" | "admin";
  setSelectedRole: (role: "customer" | "vendor" | "admin") => void;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => Promise<void>;
  hasOnboarded: boolean;
  markOnboarded: () => Promise<void>;
}

export interface RegisterData {
  name: string;
  email: string;
  password: string;
  phone?: string;
  role: "customer" | "vendor" | "admin";
  referralCode?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = "alloplan_token";
const REFRESH_KEY = "alloplan_refresh";
const ONBOARDED_KEY = "alloplan_onboarded";

async function apiPost(path: string, body: object, token?: string) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}/api${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

async function apiGet(path: string, token: string) {
  const res = await fetch(`${BASE_URL}/api${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRole, setSelectedRole] = useState<"customer" | "vendor" | "admin">("customer");
  const [hasOnboarded, setHasOnboarded] = useState(false);

  // Set up token getter for API client
  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  // Load stored auth state on mount
  useEffect(() => {
    async function loadAuth() {
      try {
        const [storedToken, onboarded] = await Promise.all([
          AsyncStorage.getItem(TOKEN_KEY),
          AsyncStorage.getItem(ONBOARDED_KEY),
        ]);
        setHasOnboarded(onboarded === "true");
        if (storedToken) {
          const me = await apiGet("/auth/me", storedToken);
          setToken(storedToken);
          setUser(me);
        }
      } catch {
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
      } finally {
        setIsLoading(false);
      }
    }
    loadAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await apiPost("/auth/login", { email, password });
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, data.token),
      AsyncStorage.setItem(REFRESH_KEY, data.refreshToken),
    ]);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const register = useCallback(async (registerData: RegisterData) => {
    const data = await apiPost("/auth/register", registerData);
    await Promise.all([
      AsyncStorage.setItem(TOKEN_KEY, data.token),
      AsyncStorage.setItem(REFRESH_KEY, data.refreshToken),
    ]);
    setToken(data.token);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_KEY]);
    setToken(null);
    setUser(null);
  }, []);

  const markOnboarded = useCallback(async () => {
    await AsyncStorage.setItem(ONBOARDED_KEY, "true");
    setHasOnboarded(true);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        selectedRole,
        setSelectedRole,
        login,
        register,
        logout,
        hasOnboarded,
        markOnboarded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
