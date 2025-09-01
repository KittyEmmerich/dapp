import type { Metadata } from 'next'
import "./globals.css";
import { MetaMaskProvider } from '@/hooks/metamask/useMetaMaskProvider';
import { MetaMaskEthersSignerProvider } from '@/hooks/metamask/useMetaMaskEthersSigner';

export const metadata: Metadata = {
  title: 'FHEVM DApp9 - Privacy-Preserving Application',
  description: 'A privacy-preserving decentralized application using Zama FHE',
}

// Sepolia mock chain configuration
const initialMockChains = {
  11155111: "https://sepolia.infura.io/v3/YOUR_INFURA_KEY" // Will be overridden by MetaMask
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <MetaMaskProvider>
          <MetaMaskEthersSignerProvider initialMockChains={initialMockChains}>
            {children}
          </MetaMaskEthersSignerProvider>
        </MetaMaskProvider>
      </body>
    </html>
  )
}