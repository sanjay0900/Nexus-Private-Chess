import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = { title: 'Nexus Chess', description: 'Private realtime multiplayer chess' };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
