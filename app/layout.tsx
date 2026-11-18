import type { Metadata } from 'next';
import type { ReactNode } from 'react';
export const metadata: Metadata = { title: 'TrustFive | Trusted local professionals', description: 'Find trusted local professionals and connect with your community.' };
export default function RootLayout({children}:{children:ReactNode}) {return <html lang="en"><body style={{margin:0,fontFamily:'Arial,sans-serif',background:'#f7fbf8',color:'#17372b'}}>{children}</body></html>}
