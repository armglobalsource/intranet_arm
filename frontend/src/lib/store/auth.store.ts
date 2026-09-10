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
  ministerialTitle?: string | null;
  memberSince?: string | null;
  preferredName?: string | null;
  referralChannel?: string | null;
  referredByName?: string | null;
  servingStatus?: string | null;
  interestAreas?: string[];
  otherAreaText?: string | null;
  onboardingCompletedAt?: string | null;
  campusId?: number | null;
  campus?: { id: number; name: string; address?: string | null } | null;
  role: { name: string };
  permissions: string[];
  status?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  needsProfileCompletion: boolean;
  /** true once Zustand has rehydrated from localStorage */
  _hasHydrated: boolean;

  /** Impersonation state — persisted so reload keeps the simulated session */
  impersonation: { roleId: number; roleName: string } | null;
  originalSession: { accessToken: string; refreshToken: string; user: User } | null;

  setHasHydrated: (val: boolean) => void;
  setSession: (user: User, accessToken: string, refreshToken: string, needsProfileCompletion?: boolean) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (patch: Partial<User>) => void;
  clearProfileCompletion: () => void;
  logout: () => void;
  startImpersonation: (accessToken: string, roleId: number, roleName: string, permissions: string[]) => void;
  exitImpersonation: () => void;
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
      impersonation: null,
      originalSession: null,

      setHasHydrated: (val) => set({ _hasHydrated: val }),

      setSession: (user, accessToken, refreshToken, needsProfileCompletion = false) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true, needsProfileCompletion }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),

      clearProfileCompletion: () => set({ needsProfileCompletion: false }),

      logout: () =>
        set({
          user: null, accessToken: null, refreshToken: null,
          isAuthenticated: false, needsProfileCompletion: false,
          impersonation: null, originalSession: null,
        }),

      startImpersonation: (accessToken, roleId, roleName, permissions) =>
        set((s) => ({
          originalSession: s.originalSession ?? {
            accessToken: s.accessToken!,
            refreshToken: s.refreshToken!,
            user: s.user!,
          },
          accessToken,
          impersonation: { roleId, roleName },
          user: s.user ? { ...s.user, role: { name: roleName }, permissions } : s.user,
        })),

      exitImpersonation: () =>
        set((s) => ({
          accessToken:    s.originalSession?.accessToken  ?? s.accessToken,
          refreshToken:   s.originalSession?.refreshToken ?? s.refreshToken,
          user:           s.originalSession?.user         ?? s.user,
          impersonation:  null,
          originalSession: null,
        })),
    }),
    {
      name: 'auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
      partialize: (state) => ({
        user:                   state.user,
        accessToken:            state.accessToken,
        refreshToken:           state.refreshToken,
        isAuthenticated:        state.isAuthenticated,
        needsProfileCompletion: state.needsProfileCompletion,
        impersonation:          state.impersonation,
        originalSession:        state.originalSession,
      }),
    },
  ),
);
