'use client';

import {useState} from 'react';

type Props = {
  businessName: string;
};

export default function ShareBusinessLink({businessName}: Props) {
  const [status, setStatus] = useState('');

  async function copyProfileUrl() {
    try {
      const href = window.location.href;
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(href);
        setStatus(`Link to ${businessName} copied to clipboard.`);
      } else {
        setStatus(`Share this profile link: ${href}`);
      }
    } catch {
      setStatus('Copy the address from your browser bar to share this TrustFive profile.');
    }
  }

  return (
    <div style={{marginTop: 12}}>
      <button type="button" className="btn secondary" onClick={copyProfileUrl}>
        Share this business profile
      </button>
      {status && (
        <p className="muted-note" role="status" aria-live="polite" style={{marginTop: 8}}>
          {status}
        </p>
      )}
    </div>
  );
}
