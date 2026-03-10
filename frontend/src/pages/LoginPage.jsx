export default function LoginPage() {
  const handleGitHubLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/auth/github`;
  };

  return (
    <div className="min-h-screen bg-[#0A0E1A] flex items-center justify-center font-mono">
      <div className="max-w-sm w-full mx-4">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-[#00FF88] to-[#00C8FF] mb-4">
            <span className="text-3xl text-[#0A0E1A] font-black">⚡</span>
          </div>
          <h1 className="text-3xl font-black">
            Code<span className="text-[#00FF88]">Sync</span>
          </h1>
          <p className="text-[#64748B] text-sm mt-2">Real-time collaborative coding</p>
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {['Live cursors', 'Real-time sync', 'Code execution', 'GitHub push'].map((f) => (
            <span key={f} className="text-[10px] font-bold text-[#00FF88] bg-[#00FF8815] border border-[#00FF8830] rounded-full px-3 py-1">
              {f}
            </span>
          ))}
        </div>

        {/* Card */}
        <div className="bg-[#0D1117] border border-[#1E2A3A] rounded-2xl p-8">
          <h2 className="text-lg font-black mb-1 text-white">Get started</h2>
          <p className="text-[12px] text-[#64748B] mb-6">Sign in with GitHub to create or join coding rooms</p>

          <button
            onClick={handleGitHubLogin}
            className="w-full flex items-center justify-center gap-3 bg-white hover:bg-gray-100 text-[#0A0E1A] font-bold py-3 rounded-xl transition-all text-sm"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
              <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
            </svg>
            Continue with GitHub
          </button>

          <p className="text-[10px] text-[#334155] text-center mt-4">
            We request repo access to enable GitHub push feature
          </p>
        </div>
      </div>
    </div>
  );
}
