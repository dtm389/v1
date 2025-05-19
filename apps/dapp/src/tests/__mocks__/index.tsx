/* eslint-disable @typescript-eslint/ban-ts-comment */
import { QueryClient } from '@tanstack/react-query';
import { createConfig, http } from '@wagmi/core';
import { Provider } from '@defi-token/blockchain';
import { fn } from 'jest-mock';
import { mainnet, sepolia } from 'wagmi/chains';
import { mock } from 'wagmi/connectors';

export const canvasElementMocked = () => {
  // @ts-ignore
  return (HTMLCanvasElement.prototype.getContext = fn(
    () => null as CanvasRenderingContext2D | null
  ));
};

export const WagmiProviderMocked = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const queryClient = new QueryClient();
  const config = createConfig({
    chains: [sepolia, mainnet],
    connectors: [
      mock({
        accounts: [
          '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
          '0x70997970c51812dc3a010c7d01b50e0d17dc79c8',
          '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        ],
      }),
    ],
    transports: {
      [mainnet.id]: http(),
      [sepolia.id]: http(),
    },
  });

  return (
    <Provider
      queryClient={queryClient}
      configProvider="rainbow"
      customConfig={config}
    >
      {children}
    </Provider>
  );
};
