/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo } from 'react';
import { useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { useToastStore } from '@defi-token/ui';
import { useBalance } from './use-balance';
import { waitForTransactionReceipt } from '@wagmi/core';
import { config } from '../config';
import { TokenType } from '../types';
import { ETHERSCAN_URL, extractDetailsMessage, handleContract } from '../utils';
import { useWallet } from './use-wallet';
import { useActionStore } from '../store';

export function useMint() {
  const { address } = useWallet();
  const { addToast, dismissToast } = useToastStore();
  const { writeContractAsync, reset } = useWriteContract();
  const { useGetTokenBalance, useGetTokenAllowance } = useBalance();
  const { mintStatus, setMintStatus, resetMintStatus } = useActionStore();

  const currentToken = useMemo(
    () => (mintStatus?.token as TokenType) || 'DAI',
    [mintStatus?.token]
  );

  const tokenBalance = useGetTokenBalance(currentToken);
  const tokenAllowance = useGetTokenAllowance(currentToken);

  const dismissMintToasts = useCallback(() => {
    dismissToast('mint-error');
    dismissToast('mint-success');
    dismissToast('minting');
  }, [dismissToast]);

  const getMintToastConfig = useCallback(
    (variant: 'success' | 'destructive' | 'info', errorMsg?: string) => ({
      id: variant === 'info' ? 'minting' : `mint-${variant}`,
      title: variant === 'success' 
        ? 'Mint Successful'
        : variant === 'destructive'
        ? 'Mint Error'
        : 'Minting, please wait...',
      message: `
      Amount: ${mintStatus?.amount} ${mintStatus?.token} \n
      ${errorMsg ? `Error: ${errorMsg}` : `Transaction hash: ${mintStatus?.tx}`}`,
      variant,
      timeout: variant === 'destructive' ? 60000 : variant === 'info' ? 60000 : 15000,
      button: (variant === 'success' || variant === 'info') ? {
        label: 'View on Etherscan',
        onClick: () => {
          window.open(
            `${ETHERSCAN_URL}/tx/${mintStatus?.tx}`,
            '_blank',
            'noopener,noreferrer'
          );
        },
      } : undefined,
    }),
    [mintStatus?.amount, mintStatus?.token, mintStatus?.tx]
  );

  const refetchBalances = useCallback(async () => {
    if (tokenBalance) {
      await tokenBalance.refetch();
      await tokenAllowance.refetch();
    }

    addToast(getMintToastConfig('success'));
    resetMintStatus();
    reset();
  }, [tokenBalance, tokenAllowance, getMintToastConfig, addToast, resetMintStatus, reset]);

  const mint = useCallback(
    async (token: TokenType, amount: string) => {
      dismissMintToasts();

      setMintStatus({
        isPending: true,
        token,
        amount,
      });

      try {
        const tx = await writeContractAsync({
          address: handleContract(token).address,
          abi: handleContract(token).abi,
          functionName: 'mint',
          args: [
            address as `0x${string}`,
            parseUnits(amount, handleContract(token).decimals),
          ],
        });

        setMintStatus({
          tx,
        });

        await waitForTransactionReceipt(config, { hash: tx });
        return tx;
      } catch (error: any) {
        console.error(error);
        const errorMessage = extractDetailsMessage(error) || 'An error occurred';
        dismissToast('minting');
        setMintStatus({
          isPending: false,
          isError: true,
          error: errorMessage,
        });
      } finally {
        dismissToast('minting');
        setMintStatus({
          isPending: false,
          isSuccess: true,
        });
      }
    },
    [dismissMintToasts, dismissToast, setMintStatus, writeContractAsync, address]
  );

  useEffect(() => {
    if (mintStatus.isPending && mintStatus?.tx) {
      addToast(getMintToastConfig('info'));
    } else if (mintStatus.isError) {
      addToast(getMintToastConfig('destructive', mintStatus?.error));
      resetMintStatus();
      reset();
    } else if (mintStatus.isSuccess) {
      refetchBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    mintStatus?.tx,
    mintStatus.isError,
    mintStatus.isSuccess,
    mintStatus.isPending,
  ]);

  return {
    mint,
    resetMintStatus,
    isPending: mintStatus.isPending,
    isSuccess: mintStatus.isSuccess,
    isError: mintStatus.isError,
  };
}
