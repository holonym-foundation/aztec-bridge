import { useEffect, useState } from "react";
import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { cookieToInitialState } from 'wagmi'
import { getConfig } from '../wagmi'
import { Providers } from '../providers'

export default function App({ Component, pageProps }: AppProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const initialState = cookieToInitialState(
    getConfig(),
    typeof window !== 'undefined' ? document.cookie : '',
  );

  if (!mounted) return null;

  return (
    <Providers initialState={initialState}>
      <Component {...pageProps} />
    </Providers>
  );
}
