import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Golf Pool App',
  description: 'Season-long majors golf pool',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}