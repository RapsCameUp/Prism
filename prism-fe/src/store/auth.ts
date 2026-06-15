import { useEffect, useState } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/api/client";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface AuthState {
  isAuthenticated: boolean;
  user: AuthUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  setAuth: (token: string, user: AuthUser) => void;
}

export const useAuth = create<AuthState>()(
  persist(
    (set) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      login: async (email, password) => {
        try {
          const response = await api.login(email, password);
          set({
            isAuthenticated: true,
            user: response.user,
            token: response.token,
          });
          return true;
        } catch {
          return false;
        }
      },
      logout: () => set({ isAuthenticated: false, user: null, token: null }),
      setAuth: (token, user) => set({ isAuthenticated: true, token, user }),
    }),
    { name: "prism-auth" }
  )
);

/**
 * Returns true once zustand's persist middleware has rehydrated from
 * localStorage on the client. Prevents a race where a freshly logged-in
 * user is overwritten by the (false) persisted state arriving late.
 */
export function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(
    () => useAuth.persist.hasHydrated()
  );

  useEffect(() => {
    const unsubFinish = useAuth.persist.onFinishHydration(() => setHydrated(true));
    // In case it already hydrated between initial render and effect.
    if (useAuth.persist.hasHydrated()) setHydrated(true);
    return () => {
      unsubFinish();
    };
  }, []);

  return hydrated;
}
