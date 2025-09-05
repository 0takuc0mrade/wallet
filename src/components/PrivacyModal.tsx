// components/PrivacyModal.tsx

"use client";

import React from 'react';

// Define the props for the component
interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Privacy Policy & Terms of Service</h2>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="modal-body">
          <p>
            Welcome to our service. By using our platform, you agree to the following terms and conditions.
          </p>
          <h4>1. Data Collection</h4>
          <p>
            We collect information you provide directly to us, such as when you create an account, and information we get from your use of our services, like your wallet address and transaction history.
            {/* Add more placeholder text as needed */}
          </p>
          <h4>2. Use of Information</h4>
          <p>
            We use the information we collect to provide, maintain, and improve our services, to develop new ones, and to protect our users. We will not share your personal information with third parties without your consent, except as required by law.
          </p>
          <h4>3. Your Responsibilities</h4>
          <p>
            You are responsible for the security of your wallet and private keys. You agree not to engage in any activity that interferes with or disrupts the services.
          </p>
          <p>
            <em>This is a placeholder policy. Please replace this with your actual legal text.</em>
          </p>
        </div>
        <div className="modal-footer">
          <button className="cta-button" onClick={onClose}>
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};