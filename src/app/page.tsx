export default function Home() {
  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '40px', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #0d9488, #14b8a6, #f59e0b)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ color: 'white', fontWeight: 'bold', fontSize: '18px' }}>T5</span>
        </div>
        <h1 style={{ fontSize: '24px', fontWeight: 600 }}>TrustFive</h1>
      </div>
      <p style={{ color: '#666', marginBottom: '20px' }}>
        Trades Marketplace with Five-Slot Network & Community Social Layer.
      </p>
      <div style={{
        padding: '20px', borderRadius: '12px',
        background: 'linear-gradient(135deg, #fffbeb, #fef3c7)',
        border: '1px solid #fde68a', marginBottom: '20px',
      }}>
        <h2 style={{ fontSize: '18px', marginBottom: '8px' }}>⚡ The Five-Slot Network</h2>
        <p style={{ fontSize: '14px', color: '#92400e', lineHeight: 1.6 }}>
          Only 5 approved providers per trade per district. Quality over quantity —
          every approved pro gets enough work, customers get a vetted shortlist.
        </p>
      </div>
      <p style={{ fontSize: '14px', color: '#999' }}>
        Full app with 20 sections, 60+ API routes, B2B platform, and community social layer.
        Source code at <a href="https://github.com/AIhomesecurity/trustfive" style={{ color: '#0d9488' }}>GitHub</a>.
      </p>
    </main>
  )
}