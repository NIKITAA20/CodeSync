import { useRoomStore } from '../../store';

export default function OutputPanel() {
  const { output, isRunning } = useRoomStore();

  return (
    <div className="h-full flex flex-col bg-[#0A0E1A] font-mono">
      <div className="px-4 py-2 border-b border-[#1E2A3A] flex items-center gap-3">
        <span className="text-[10px] font-bold tracking-widest text-[#64748B]">OUTPUT</span>
        {isRunning && (
          <span className="text-[10px] text-[#FFE66D] animate-pulse">● Running...</span>
        )}
        {output && !isRunning && (
          <span className={`text-[10px] ${output.status === 'SUCCESS' ? 'text-[#00FF88]' : 'text-[#FF6B6B]'}`}>
            ● {output.status} · {output.executionMs}ms
          </span>
        )}
      </div>

      <div className="flex-1 overflow-auto p-4">
        {isRunning && (
          <div className="text-[#FFE66D] text-sm animate-pulse">⚡ Executing...</div>
        )}

        {!isRunning && !output && (
          <div className="text-[#334155] text-sm">Press ▶ Run to execute code</div>
        )}

        {!isRunning && output && (
          <div className="space-y-3">
            {output.stdout && (
              <div>
                <div className="text-[10px] text-[#64748B] mb-1">STDOUT</div>
                <pre className="text-[12px] text-[#E2E8F0] whitespace-pre-wrap leading-relaxed">
                  {output.stdout}
                </pre>
              </div>
            )}
            {output.stderr && (
              <div>
                <div className="text-[10px] text-[#FF6B6B] mb-1">STDERR / COMPILE</div>
                <pre className="text-[12px] text-[#FF6B6B] whitespace-pre-wrap leading-relaxed">
                  {output.stderr}
                </pre>
              </div>
            )}
            {!output.stdout && !output.stderr && (
              <div className="text-[12px] text-[#64748B]">(no output)</div>
            )}
            {output.note && (
              <div className="text-[10px] text-[#64748B] italic border-t border-[#1E2A3A] pt-2 mt-2">
                ℹ️ {output.note}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
