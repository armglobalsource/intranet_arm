import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  phone?: string | null;
  country?: string | null;
  bio?: string | null;
  birthDate?: string | null;
  gender?: string | null;
  campusId?: number | null;
  campus?: { id: number; name: string; address?: string | null } | null;
  role: { name: string };
  permissions: string[];
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  /** true once Zustand has rehydrated from localStorage */
  _hasHydrated: boolean;
  setHasHydrated: (val: boolean) => void;
  setSession: (user: User, accessToken: string, refreshToken: string, needsProfileCompletion?: boolean) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (patch: Partial<User>) => void;
  clearProfileCompletion: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      needsProfileCompletion: false,
      _hasHydrated: false,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      setSession: (user, accessToken, refreshToken, needsProfileCompletion = false) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true, needsProfileCompletion }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),

      clearProfileCompletion: () => set({ needsProfileCompletion: false }),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, needsProfileCompletion: false }),
    }),
    {
      name: 'auth-storage',
      // Called when Zustand finishes reading localStorage
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      // _hasHydrated is runtime-only — never persist it
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        needsProfileCompletion: state.needsProfileCompletion,
      }),
    },
  ),
);
