import Link from 'next/link';
import {
  TRUSTFIVE_CHARTER_COMMITMENTS,
  TRUSTFIVE_VETTING_STAGES,
} from '../lib/marketplace-comparison';

type Props = {
  compact?: boolean;
};

export default function VettingCharter({compact = false}: Props) {
  return (
    <div className="tf-vetting-wrap" data-testid="vetting-charter">
      <div className="tf-vetting-grid">
        {TRUSTFIVE_VETTING_STAGES.map((stage) => (
          <article className="card tf-vetting-card" key={stage.step}>
            <span className="how-number">{stage.step}</span>
            <h3>{stage.title}</h3>
            <p>{stage.detail}</p>
          </article>
        ))}
      </div>

      {!compact && (
        <div className="tf-charter-box card">
          <div className="eyebrow">Homeowner &amp; trade code of conduct</div>
          <h3>The TrustFive transparent standards charter</h3>
          <div className="tf-charter-grid">
            {TRUSTFIVE_CHARTER_COMMITMENTS.map((item) => (
              <div key={item.title} className="tf-charter-item">
                <h4>✓ {item.title}</h4>
                <p>{item.body}</p>
              </div>
            ))}
          </div>
          <div className="guide-actions">
            <Link className="btn" href="/services">
              Browse approved professionals
            </Link>
            <Link className="btn secondary" href="/support/complaints">
              Complaint &amp; appeal process
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
