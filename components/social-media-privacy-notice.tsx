'use client';

import {useId,useRef,useState,type ChangeEvent} from 'react';
import {
  MEDIA_STORAGE_COORDINATION_NOTE,
  validateSocialMediaFile,
  type SocialMediaCheckResult,
} from '../lib/social-safety';

/**
 * Honest media privacy pre-check for TrustFive Social. Validates allowed image
 * formats and size locally and explains EXIF/GPS stripping without pretending
 * that remote photo storage is already active.
 */
export default function SocialMediaPrivacyNotice() {
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<SocialMediaCheckResult | null>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) {
      setResult(null);
      return;
    }
    setResult(validateSocialMediaFile({name: file.name, type: file.type, size: file.size}));
  }

  return (
    <div style={{marginTop: 12}}>
      <button
        type="button"
        className="btn secondary"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(prev => !prev)}
      >
        {open ? 'Hide photo privacy check' : 'Photo & media privacy'}
      </button>
      <div id={panelId} hidden={!open} className="social-scope-bar" style={{marginTop: 10, marginBottom: 0}}>
        {open ? (
          <>
            <p className="muted-note" style={{margin: 0}}>
              <strong>Media upload privacy:</strong> Only JPEG, PNG and WebP photos up to 5 MB will be accepted, with GPS location and EXIF camera metadata stripped before storage. {MEDIA_STORAGE_COORDINATION_NOTE}
            </p>
            <label style={{display: 'grid', gap: 6, fontSize: 13.5, fontWeight: 700}}>
              Check a photo locally (not uploaded)
              <input
                ref={inputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange}
              />
            </label>
            {result ? (
              <p
                role={result.ok ? 'status' : 'alert'}
                className={result.ok ? 'notice' : 'notice error'}
                style={{margin: 0}}
              >
                {result.ok ? result.summary : result.reason}
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
