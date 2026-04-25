import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'SkillSasa Admin — Connecting Professionals with Expert Trainers.',
  description: 'SkillSasa admin console — Professional Trainers Association of Kenya.',
  icons: {
    icon: '/favicon.svg',
    shortcut: '/favicon.svg',
  },
  manifest: '/manifest.json',
  themeColor: '#192C67',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
