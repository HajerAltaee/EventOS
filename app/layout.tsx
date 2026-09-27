import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'EventOS — Autonomous Event Operations',
  description: 'Live operational control for AI Hackathon 2026.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
