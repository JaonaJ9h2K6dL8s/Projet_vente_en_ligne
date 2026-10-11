'use client';

import { useThemeStore } from '@/stores/themeStore';
import { buildTheme } from '@/theme/theme';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { SnackbarProvider } from 'notistack';
import { useMemo, type ReactNode } from 'react';

import { AppRouterCacheProvider } from '@mui/material-nextjs/v15-appRouter';

export default function ThemeRegistry({ children }: { children: ReactNode }) {
  const { mode, accentColor } = useThemeStore();
  const theme = useMemo(() => buildTheme(mode, accentColor), [mode, accentColor]);

  return (
    <AppRouterCacheProvider>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <SnackbarProvider
          maxSnack={3}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          autoHideDuration={3000}
        >
          {children}
        </SnackbarProvider>
      </ThemeProvider>
    </AppRouterCacheProvider>
  );
}
