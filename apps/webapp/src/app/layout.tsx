import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from '@/contexts/auth-context';
import { AppContextProvider } from '@/contexts/firebase-context';
import { WebDeletionConfigProvider } from '@/components/deletion-config-provider';
import { SidebarProvider } from '@/components/ui/sidebar';
import { ThemeProvider } from '@/components/theme-provider';
import { GoogleAnalytics } from '@/components/analytics/google-analytics';
import { AnalyticsClient } from '@/components/analytics/analytics-client';
import { buildPageMetadata } from '@/lib/metadata-shared';

export const metadata: Metadata = buildPageMetadata();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter&display=swap" rel="stylesheet"></link>
      </head>
      <body className="font-body antialiased">
        <GoogleAnalytics />
        <AnalyticsClient />
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem={false}
          disableTransitionOnChange
        >
          <AuthProvider>
            <AppContextProvider>
              <WebDeletionConfigProvider>
                {/* flex-col: SidebarProvider defaults to flex-row; without a Sidebar sibling,
                    standalone routes (share, legal, login) collapsed to content width on the left. */}
                <SidebarProvider className="flex-col">
                  {children}
                </SidebarProvider>
              </WebDeletionConfigProvider>
            </AppContextProvider>
          </AuthProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
