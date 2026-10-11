'use client';

import type { User, UserRole, Enterprise } from '@/types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthStore {
  user: User | null;
  enterprises: Enterprise[];
  isAuthenticated: boolean;
  hasHydrated: boolean;
  selectedUserId: string | null;
  dataLoadingCount: number;
  lastDataError: string | null;
  login: (user: User) => void;
  logout: () => void;
  setEnterprises: (enterprises: Enterprise[]) => void;
  setSelectedUserId: (userId: string) => void;
  hasRole: (role: UserRole) => boolean;
  startDataLoading: () => void;
  endDataLoading: () => void;
  setDataError: (message: string | null) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      enterprises: [],
      isAuthenticated: false,
      hasHydrated: false,
      selectedUserId: null,
      dataLoadingCount: 0,
      lastDataError: null,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, enterprises: [], isAuthenticated: false, selectedUserId: null }),
      setEnterprises: (enterprises) => set({ enterprises }),
      setSelectedUserId: (userId) => set({ selectedUserId: userId }),
      hasRole: (role) => get().user?.role === role,
      startDataLoading: () => set((state) => ({ dataLoadingCount: state.dataLoadingCount + 1 })),
      endDataLoading: () => set((state) => ({ dataLoadingCount: Math.max(0, state.dataLoadingCount - 1) })),
      setDataError: (message) => set({ lastDataError: message }),
    }),
    {
      name: 'vel-auth',
      partialize: (state) => ({
        user: state.user,
        enterprises: state.enterprises,
        isAuthenticated: state.isAuthenticated,
        selectedUserId: state.selectedUserId,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setDataError(null);
        let patch: Partial<AuthStore> = { hasHydrated: true, dataLoadingCount: 0, lastDataError: null };
        const s = useAuthStore.getState();
        if (s?.user?.id) {
          // If we have an enterprise selected, keep it. Otherwise default to the first enterprise or user id
          if (!s.selectedUserId || (s.enterprises && s.enterprises.length > 0 && !s.enterprises.find(e => e.id === s.selectedUserId))) {
            patch.selectedUserId = (s.enterprises && s.enterprises.length > 0) ? s.enterprises[0].id : s.user.id;
          }
        } else if (s.selectedUserId && !s.user) {
          patch.selectedUserId = null;
          patch.isAuthenticated = false;
        }
        useAuthStore.setState(patch);
      },
    }
  )
);
