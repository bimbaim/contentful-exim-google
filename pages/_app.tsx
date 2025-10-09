// pages/_app.tsx

import type { AppProps } from 'next/app';
import React from 'react';

// Anda dapat menambahkan style global di sini
// import '../styles/globals.css'; 

export default function App({ Component, pageProps }: AppProps) {
  return (
    // Anda bisa membungkus komponen dengan provider Context atau Layout di sini
    <Component {...pageProps} />
  );
}