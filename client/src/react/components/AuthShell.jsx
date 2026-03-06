import { useState } from 'react';

/**
 * Persistent backdrop for all auth pages.
 * Mounted once via AuthLayout — never re-renders on auth route transitions.
 * The card content slot (children) fades in independently on each navigation.
 */
export default function AuthShell({ children }) {
  const [videoReady, setVideoReady] = useState(false);

  return (
    <div className="min-h-screen relative overflow-hidden flex items-center justify-center">

      {/* Fallback gradient — always the base layer */}
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 40%, #F0654D 0%, #C94522 45%, #8B2500 100%)',
        }}
      />

      {/* Video — fades in once ready, over the gradient */}
      <video
        autoPlay loop muted playsInline
        onCanPlay={() => setVideoReady(true)}
        className="absolute inset-0 w-full h-full object-cover"
        style={{
          filter:     'brightness(0.9) saturate(1.1)',
          opacity:    videoReady ? 1 : 0,
          transition: 'opacity 0.8s ease',
        }}
      >
        <source src="nectar-bg.mp4" type="video/mp4" />
      </video>

      {/* Orange color-grade overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:   'linear-gradient(135deg, rgba(240,101,77,0.78) 0%, rgba(175,55,25,0.72) 100%)',
          mixBlendMode: 'multiply',
        }}
      />

      {/* Vignette */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.35) 100%)' }}
      />

      {/* Card slot — content injected by AuthLayout */}
      <div className="relative z-10 w-full max-w-sm px-4">
        <div
          className="bg-white rounded-3xl px-8 py-10"
          style={{ boxShadow: '0 32px 80px rgba(0,0,0,0.28), 0 8px 24px rgba(0,0,0,0.12)' }}
        >
          {children}
        </div>
        <p className="text-center text-white/50 text-xs mt-6">
          © {new Date().getFullYear()} Nectar — Internal use only
        </p>
      </div>

    </div>
  );
}
