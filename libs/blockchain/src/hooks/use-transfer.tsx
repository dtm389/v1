/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useEffect, useMemo } from 'react';
import { useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { useToastStore } from '@defi-token/ui';
import { TokenType } from '../types';
import { ETHERSCAN_URL, extractDetailsMessage, handleContract } from '../utils';
import { useBalance } from './use-balance';
import { waitForTransactionReceipt } from '@wagmi/core';
import { config } from '../config';
import { useWallet } from './use-wallet';
import { useActionStore } from '../store';

export function useTransfer() {
  const { address } = useWallet();
  const { addToast, dismissToast } = useToastStore();
  const { writeContractAsync, reset } = useWriteContract();
  const { useGetTokenBalance, useGetTokenAllowance } = useBalance();
  const { transferStatus, setTransferStatus, resetTransferStatus } =
    useActionStore();

  const currentToken = useMemo(
    () => (transferStatus?.token as TokenType) || 'DAI',
    [transferStatus?.token]
  );

  const tokenBalance = useGetTokenBalance(currentToken);
  const tokenAllowance = useGetTokenAllowance(currentToken);

  const dismissTransferToasts = useCallback(() => {
    dismissToast('transfer-error');
    dismissToast('transfer-success');
    dismissToast('transfer-pending');
  }, [dismissToast]);

  const getTransactionToastConfig = useCallback(
    (variant: 'success' | 'destructive' | 'info', errorMsg?: string) => ({
      id: `transfer-${variant}`,
      title: variant === 'success' 
        ? 'Transfer Successful'
        : variant === 'destructive'
        ? 'Transfer Error'
        : 'Transferring, please wait...',
      message: `
      Amount: ${transferStatus?.amount} ${transferStatus?.token} \n
      To: ${transferStatus?.targetAddress} \n
      ${errorMsg ? `Error: ${errorMsg}` : `Transaction hash: ${transferStatus?.tx}`}
      `,
      variant,
      timeout: variant === 'destructive' ? 60000 : variant === 'info' ? 60000 : 15000,
      button: (variant === 'success' || variant === 'info') ? {
        label: 'View on Etherscan',
        onClick: () => {
          window.open(
            `${ETHERSCAN_URL}/tx/${transferStatus?.tx}`,
            '_blank',
            'noopener,noreferrer'
          );
        },
      } : undefined,
    }),
    [transferStatus?.amount, transferStatus?.token, transferStatus?.targetAddress, transferStatus?.tx]
  );

  const refetchBalances = useCallback(async () => {
    if (tokenBalance) {
      await tokenBalance.refetch();
      await tokenAllowance.refetch();
    }

    addToast(getTransactionToastConfig('success'));
    resetTransferStatus();
    reset();
  }, [tokenBalance, tokenAllowance, getTransactionToastConfig, addToast, resetTransferStatus, reset]);

  const executeTransfer = useCallback(
    async (token: TokenType, to: `0x${string}`, amount: string, isFromTransfer = false) => {
      dismissTransferToasts();

      setTransferStatus({
        isPending: true,
        token,
        amount,
        targetAddress: to,
      });

      try {
        const args = isFromTransfer
          ? [address as `0x${string}`, to, parseUnits(amount, handleContract(token).decimals)]
          : [to, parseUnits(amount, handleContract(token).decimals)];

        const tx = await writeContractAsync({
          address: handleContract(token).address,
          abi: handleContract(token).abi,
          functionName: isFromTransfer ? 'transferFrom' : 'transfer',
          args,
        });

        setTransferStatus({ tx });
        await waitForTransactionReceipt(config, { hash: tx });
        return tx;
      } catch (error: any) {
        console.error(error);
        dismissToast('transfer-pending');
        const errorMessage = isFromTransfer 
          ? extractDetailsMessage(error) || 'An error occurred'
          : error?.message;
        setTransferStatus({
          isPending: false,
          isError: true,
          error: errorMessage,
        });
      } finally {
        dismissToast('transfer-pending');
        setTransferStatus({
          isPending: false,
          isSuccess: true,
        });
      }
    },
    [dismissTransferToasts, dismissToast, setTransferStatus, writeContractAsync, address]
  );

  const transfer = useCallback(
    async (token: TokenType, to: `0x${string}`, amount: string) => 
      executeTransfer(token, to, amount, false),
    [executeTransfer]
  );

  const transferFrom = useCallback(
    async (token: TokenType, to: `0x${string}`, amount: string) => 
      executeTransfer(token, to, amount, true),
    [executeTransfer]
  );

  useEffect(() => {
    if (transferStatus.isPending && transferStatus?.tx) {
      addToast(getTransactionToastConfig('info'));
    } else if (transferStatus.isError) {
      addToast(getTransactionToastConfig('destructive', transferStatus?.error));
      resetTransferStatus();
      reset();
    } else if (transferStatus.isSuccess && !transferStatus.isError) {
      refetchBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    transferStatus?.tx,
    transferStatus.isError,
    transferStatus.isSuccess,
    transferStatus.isPending,
  ]);

  return {
    transfer,
    transferFrom,
    resetTransferStatus,
    isPending: transferStatus.isPending,
    isSuccess: transferStatus.isSuccess,
    isError: transferStatus.isError,
  };
}
