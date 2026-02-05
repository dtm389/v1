import { useCallback, useEffect } from 'react';
import { useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { waitForTransactionReceipt } from '@wagmi/core';

import { useToastStore } from '@defi-token/ui';
import { TokenType } from '../types';
import { ETHERSCAN_URL, extractDetailsMessage, handleContract } from '../utils';
import { useBalance } from './use-balance';
import { config } from '../config';
import { useWallet } from './use-wallet';
import { useActionStore } from '../store/useActionStore';

type HexAddress = `0x${string}`;

export function useApprove() {
  const { address } = useWallet();
  const { addToast, dismissToast } = useToastStore();
  const { writeContractAsync, reset } = useWriteContract();
  const { useGetTokenBalance, useGetTokenAllowance } = useBalance();
  const { approveStatus, setApproveStatus, resetApproveStatus } = useActionStore();

  const token: TokenType = (approveStatus?.token as TokenType) || 'DAI';
  const tokenBalance = useGetTokenBalance(token);
  const tokenAllowance = useGetTokenAllowance(token);

  const openEtherscanTx = useCallback((tx?: string) => {
    if (!tx) return;
    window.open(`${ETHERSCAN_URL}/tx/${tx}`, '_blank', 'noopener,noreferrer');
  }, []);

  const clearToasts = useCallback(() => {
    dismissToast('approve-error');
    dismissToast('approve-success');
    dismissToast('approve-pending');
  }, [dismissToast]);

  const refetchBalancesAndToastSuccess = useCallback(async () => {
    await Promise.all([tokenBalance?.refetch?.(), tokenAllowance?.refetch?.()]);

    addToast({
      id: 'approve-success',
      title: 'Successful Approval',
      message: `Amount: ${approveStatus?.amount} ${approveStatus?.token}\nSpender: ${approveStatus?.targetAddress}\nTransaction hash: ${approveStatus?.tx}`,
      variant: 'success',
      timeout: 600000,
      button: {
        label: 'View on Etherscan',
        onClick: () => openEtherscanTx(approveStatus?.tx),
      },
    });

    resetApproveStatus();
    reset();
  }, [
    addToast,
    approveStatus?.amount,
    approveStatus?.token,
    approveStatus?.targetAddress,
    approveStatus?.tx,
    openEtherscanTx,
    reset,
    resetApproveStatus,
    tokenAllowance,
    tokenBalance,
  ]);

  const showErrorAlert = useCallback(() => {
    addToast({
      id: 'approve-error',
      title: 'Approval Error',
      message: `Amount: ${approveStatus?.amount} ${approveStatus?.token}\nError: ${approveStatus?.error}`,
      variant: 'destructive',
      timeout: 60000,
    });

    resetApproveStatus();
    reset();
  }, [
    addToast,
    approveStatus?.amount,
    approveStatus?.token,
    approveStatus?.error,
    reset,
    resetApproveStatus,
  ]);

  const showPendingAlert = useCallback(() => {
    addToast({
      id: 'approve-pending',
      title: 'Approving, please wait...',
      message: `Amount: ${approveStatus?.amount} ${approveStatus?.token}\nSpender: ${approveStatus?.targetAddress}\nTransaction hash: ${approveStatus?.tx}`,
      variant: 'info',
      timeout: 60000,
      button: {
        label: 'View on Etherscan',
        onClick: () => openEtherscanTx(approveStatus?.tx),
      },
    });
  }, [
    addToast,
    approveStatus?.amount,
    approveStatus?.token,
    approveStatus?.targetAddress,
    approveStatus?.tx,
    openEtherscanTx,
  ]);

  const approve = useCallback(
    async (token: TokenType, amount: string, spender?: HexAddress) => {
      const spenderAddress = (spender || address) as HexAddress;
      if (!spenderAddress) {
        setApproveStatus({
          isPending: false,
          isError: true,
          error: 'Wallet address not available',
        });
        return;
      }

      clearToasts();

      setApproveStatus({
        isPending: true,
        isError: false,
        isSuccess: false,
        token,
        amount,
        targetAddress: spenderAddress,
        error: undefined,
        tx: undefined,
      });

      const contract = handleContract(token);

      try {
        const tx = await writeContractAsync({
          address: contract.address,
          abi: contract.abi,
          functionName: 'approve',
          args: [spenderAddress, parseUnits(amount, contract.decimals)],
        });

        setApproveStatus({ tx });

        // pending toast becomes meaningful once tx exists
        setApproveStatus({ isPending: true });

        await waitForTransactionReceipt(config, { hash: tx });

        setApproveStatus({
          isPending: false,
          isSuccess: true,
          isError: false,
        });

        return tx;
      } catch (err: unknown) {
        const details = extractDetailsMessage(err);
        setApproveStatus({
          isPending: false,
          isSuccess: false,
          isError: true,
          error: details || 'An error occurred',
        });
      }
    },
    [address, clearToasts, setApproveStatus, writeContractAsync]
  );

  useEffect(() => {
    if (approveStatus?.tx && approveStatus.isPending) {
      showPendingAlert();
      return;
    }

    if (approveStatus.isError) {
      dismissToast('approve-pending');
      showErrorAlert();
      return;
    }

    if (approveStatus.isSuccess) {
      dismissToast('approve-pending');
      void refetchBalancesAndToastSuccess();
    }
  }, [
    approveStatus?.tx,
    approveStatus.isPending,
    approveStatus.isError,
    approveStatus.isSuccess,
    dismissToast,
    showPendingAlert,
    showErrorAlert,
    refetchBalancesAndToastSuccess,
  ]);

  return {
    approve,
    resetApproveStatus,
    isPending: approveStatus.isPending,
    isSuccess: approveStatus.isSuccess,
    isError: approveStatus.isError,
  };
}
