'use client';

// Shared skeleton shimmer — used as Suspense fallbacks across dashboard panels

const shimmer = `
  @keyframes shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }
`;

function SkeletonBox({ w = '100%', h = '16px', radius = '6px' }: { w?: string; h?: string; radius?: string }) {
  return (
    <div
      style={{
        width: w, height: h, borderRadius: radius,
        background: 'linear-gradient(90deg, #1a1a22 25%, #22222e 50%, #1a1a22 75%)',
        backgroundSize: '800px 100%',
        animation: 'shimmer 1.4s ease-in-out infinite',
      }}
    />
  );
}

export function KPIStripSkeleton() {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            style={{
              background: '#111118', border: '1px solid #22222e',
              borderRadius: 12, padding: '18px 20px',
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <SkeletonBox w="60%" h="10px" />
            <SkeletonBox w="45%" h="28px" />
            <SkeletonBox w="70%" h="9px" />
          </div>
        ))}
      </div>
    </>
  );
}

export function GreetingBarSkeleton() {
  return (
    <>
      <style>{shimmer}</style>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBox w="220px" h="22px" />
          <SkeletonBox w="160px" h="10px" />
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <SkeletonBox w="100px" h="32px" radius="8px" />
          <SkeletonBox w="120px" h="32px" radius="8px" />
          <SkeletonBox w="110px" h="32px" radius="8px" />
        </div>
      </div>
    </>
  );
}
