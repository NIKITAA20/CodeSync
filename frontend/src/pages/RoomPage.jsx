import { useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import CollaborativeEditor from '../components/editor/CollaborativeEditor';
import OutputPanel from '../components/editor/OutputPanel';
import Chat from '../components/chat/Chat';
import GitHubPanel from '../components/github/GitHubPanel';
import UsersPanel from '../components/room/UsersPanel';
import FileExplorer from '../components/explorer/FileExplorer';
import { useRoom } from '../hooks/useRoom';
import { useRoomStore, useAuthStore } from '../store';
import { executeAPI } from '../services/api';

const LANGUAGES = ['JAVASCRIPT', 'TYPESCRIPT', 'PYTHON', 'CPP', 'JAVA', 'GO', 'RUST'];
const LANG_LABEL = { JAVASCRIPT: 'JS', TYPESCRIPT: 'TS', PYTHON: 'PY', CPP: 'C++', JAVA: 'JV', GO: 'GO', RUST: 'RS' };
const RIGHT_TABS = ['chat', 'users', 'github'];
const TAB_ICON = { chat: '💬', users: '👥', github: '🐙' };

const OUTPUT_HEIGHT = 200;
const TOPBAR_H = 48;
const TOGGLE_H = 32;
const EXPLORER_W = 220;
const SIDEBAR_W = 260;

export default function RoomPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { code, language, output, room, isRunning, setOutput, setRunning, setLanguage: storeLang } = useRoomStore();

  const [rightTab, setRightTab] = useState('chat');
  const [outputOpen, setOutputOpen] = useState(false);
  const [explorerOpen, setExplorerOpen] = useState(true);
  const [activeFile, setActiveFile] = useState(null);
  // openTabs: array of file nodes
  const [openTabs, setOpenTabs] = useState([]);

  const { emitCodeChange, emitCursorMove, emitLanguageChange, emitExecutionStart, emitExecutionResult, emitGithubPushComplete } = useRoom(slug);

  const handleCodeChange = useCallback((v) => { emitCodeChange(v); }, [emitCodeChange]);
  const handleCursorMove = useCallback((l, c) => { emitCursorMove(l, c); }, [emitCursorMove]);

  const handleLangChange = (lang) => { storeLang(lang); emitLanguageChange(lang); };

  // When user clicks a file in explorer
  const handleFileSelect = (file) => {
    setActiveFile(file);
    storeLang(file.language || language);
    // Add to open tabs if not already there
    setOpenTabs(prev => prev.find(t => t.id === file.id) ? prev : [...prev, file]);
  };

  const closeTab = (fileId, e) => {
    e.stopPropagation();
    setOpenTabs(prev => {
      const next = prev.filter(t => t.id !== fileId);
      if (activeFile?.id === fileId) setActiveFile(next[next.length - 1] || null);
      return next;
    });
  };

  const handleRun = async () => {
    if (isRunning) return;
    setRunning(true); setOutputOpen(true); emitExecutionStart();
    try {
      const { data } = await executeAPI.run({ code, language, roomSlug: slug });
      setOutput(data); emitExecutionResult(data);
    } catch (err) {
      const e = { stdout: '', stderr: err.response?.data?.error || 'Failed', status: 'FAILED', executionMs: 0 };
      setOutput(e); emitExecutionResult(e);
    } finally { setRunning(false); }
  };

  const handlePushComplete = (data) => {
    emitGithubPushComplete({ commitUrl: data.commitUrl, commitSha: data.commitSha, message: data.dbCommit?.message });
    toast.success(<span>Pushed! <a href={data.commitUrl} target="_blank" rel="noopener noreferrer" className="underline">View commit</a></span>, { duration: 6000 });
  };

  const copyLink = () => { navigator.clipboard.writeText(window.location.href); toast.success('Invite link copied!'); };

  const editorH = outputOpen
    ? `calc(100vh - ${TOPBAR_H}px - ${TOGGLE_H}px - ${OUTPUT_HEIGHT}px)`
    : `calc(100vh - ${TOPBAR_H}px - ${TOGGLE_H}px)`;

  const S = {
    root: { display:'flex', flexDirection:'column', height:'100vh', background:'#0A0E1A', fontFamily:'"JetBrains Mono",monospace', overflow:'hidden' },
    topbar: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 12px', height:TOPBAR_H, background:'#0D1117', borderBottom:'1px solid #1E2A3A', flexShrink:0, gap:8 },
    body: { display:'flex', flex:1, overflow:'hidden' },
    explorer: { width: EXPLORER_W, borderRight:'1px solid #1E2A3A', flexShrink:0, overflow:'hidden', display:'flex', flexDirection:'column' },
    editorCol: { display:'flex', flexDirection:'column', flex:1, overflow:'hidden', minWidth:0 },
    tabBar: { display:'flex', background:'#0D1117', borderBottom:'1px solid #1E2A3A', flexShrink:0, overflowX:'auto' },
    sidebar: { width:SIDEBAR_W, display:'flex', flexDirection:'column', borderLeft:'1px solid #1E2A3A', flexShrink:0 },
  };

  return (
    <div style={S.root}>
      {/* ── Topbar ── */}
      <div style={S.topbar}>
        {/* Left */}
        <div style={{ display:'flex', alignItems:'center', gap:10, flexShrink:0 }}>
          <button onClick={() => navigate('/')} style={{ display:'flex', alignItems:'center', gap:7, background:'none', border:'none', cursor:'pointer', padding:0 }}>
            <div style={{ width:26, height:26, borderRadius:7, background:'linear-gradient(135deg,#00FF88,#00C8FF)', display:'flex', alignItems:'center', justifyContent:'center', fontWeight:900, color:'#0A0E1A', fontSize:13 }}>⚡</div>
            <span style={{ fontWeight:900, fontSize:13, color:'#E2E8F0' }}>Code<span style={{ color:'#00FF88' }}>Sync</span></span>
          </button>
          <div style={{ width:1, height:14, background:'#1E2A3A' }} />
          {/* Explorer toggle */}
          <button onClick={() => setExplorerOpen(o => !o)} title="Toggle Explorer" style={{
            background: explorerOpen ? '#00FF8815' : 'transparent', border:'1px solid', fontSize:14,
            borderColor: explorerOpen ? '#00FF8840' : '#2A3A4A', borderRadius:6, padding:'3px 7px', cursor:'pointer',
          }}>📁</button>
          <span style={{ fontSize:11, color:'#64748B' }}>{room?.name || slug}</span>
          <div style={{ display:'flex', alignItems:'center', gap:3, background:'#00FF8815', border:'1px solid #00FF8830', borderRadius:20, padding:'1px 7px' }}>
            <div style={{ width:5, height:5, borderRadius:'50%', background:'#00FF88' }} />
            <span style={{ fontSize:9, fontWeight:700, color:'#00FF88' }}>LIVE</span>
          </div>
        </div>

        {/* Center: lang */}
        <div style={{ display:'flex', gap:3 }}>
          {LANGUAGES.map(l => (
            <button key={l} onClick={() => handleLangChange(l)} style={{
              padding:'2px 9px', borderRadius:5, fontSize:10, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
              background: language===l ? '#00FF8820' : 'transparent',
              border: language===l ? '1px solid #00FF8860' : '1px solid transparent',
              color: language===l ? '#00FF88' : '#64748B',
            }}>{LANG_LABEL[l]}</button>
          ))}
        </div>

        {/* Right */}
        <div style={{ display:'flex', alignItems:'center', gap:7, flexShrink:0 }}>
          <button onClick={copyLink} style={{ fontSize:11, color:'#64748B', background:'#161B27', border:'1px solid #2A3A4A', borderRadius:7, padding:'4px 10px', cursor:'pointer', fontFamily:'inherit' }}>
            🔗 {slug}
          </button>
          <button onClick={handleRun} disabled={isRunning} style={{
            display:'flex', alignItems:'center', gap:5, padding:'4px 14px', borderRadius:7,
            fontSize:12, fontWeight:800, border:'none', cursor: isRunning ? 'not-allowed' : 'pointer', fontFamily:'inherit',
            background: isRunning ? '#1A2332' : 'linear-gradient(135deg,#00FF88,#00C8FF)',
            color: isRunning ? '#64748B' : '#0A0E1A',
          }}>
            {isRunning ? '⏳' : '▶'} {isRunning ? 'Running' : 'Run'}
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <div style={S.body}>

        {/* File Explorer */}
        {explorerOpen && (
          <div style={S.explorer}>
            <FileExplorer onFileSelect={handleFileSelect} activeFile={activeFile} />
          </div>
        )}

        {/* Editor column */}
        <div style={S.editorCol}>

          {/* Open file tabs */}
          {openTabs.length > 0 && (
            <div style={S.tabBar}>
              {openTabs.map(tab => (
                <div key={tab.id} onClick={() => handleFileSelect(tab)} style={{
                  display:'flex', alignItems:'center', gap:5, padding:'6px 12px',
                  cursor:'pointer', flexShrink:0, fontSize:11, whiteSpace:'nowrap',
                  borderRight:'1px solid #1E2A3A',
                  background: activeFile?.id===tab.id ? '#0A0E1A' : '#0D1117',
                  borderBottom: activeFile?.id===tab.id ? '2px solid #00FF88' : '2px solid transparent',
                  color: activeFile?.id===tab.id ? '#E2E8F0' : '#64748B',
                }}>
                  <span style={{ fontSize:11 }}>{tab.name.split('.').pop() === 'js' ? '🟨' : '📄'}</span>
                  {tab.name}
                  <span onClick={(e) => closeTab(tab.id, e)} style={{
                    marginLeft:2, fontSize:10, color:'#64748B', lineHeight:1,
                    padding:'0 2px', borderRadius:2,
                  }}>✕</span>
                </div>
              ))}
            </div>
          )}

          {/* Monaco */}
          <div style={{ height: editorH }}>
            <CollaborativeEditor onCodeChange={handleCodeChange} onCursorMove={handleCursorMove} />
          </div>

          {/* Output toggle */}
          <div onClick={() => setOutputOpen(o => !o)} style={{
            height:TOGGLE_H, display:'flex', alignItems:'center', gap:8,
            padding:'0 16px', background:'#0D1117', borderTop:'1px solid #1E2A3A',
            cursor:'pointer', flexShrink:0, userSelect:'none',
          }}>
            <span style={{ fontSize:10, fontWeight:700, color:'#64748B', letterSpacing:'0.1em' }}>
              {outputOpen ? '▼' : '▶'} OUTPUT
            </span>
            {output && (
              <span style={{ fontSize:10, fontWeight:700, color: output.status==='SUCCESS' ? '#00FF88' : '#FF6B6B' }}>
                {output.status} · {output.executionMs}ms
              </span>
            )}
          </div>

          {outputOpen && (
            <div style={{ height:OUTPUT_HEIGHT, borderTop:'1px solid #1E2A3A', flexShrink:0, overflow:'hidden' }}>
              <OutputPanel />
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={S.sidebar}>
          <div style={{ display:'flex', background:'#0D1117', borderBottom:'1px solid #1E2A3A', flexShrink:0 }}>
            {RIGHT_TABS.map(t => (
              <button key={t} onClick={() => setRightTab(t)} style={{
                flex:1, padding:'10px 0', fontSize:16,
                background: rightTab===t ? '#00FF8808' : 'transparent',
                border:'none', borderBottom: rightTab===t ? '2px solid #00FF88' : '2px solid transparent',
                cursor:'pointer',
              }}>{TAB_ICON[t]}</button>
            ))}
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            {rightTab==='chat'   && <Chat slug={slug} />}
            {rightTab==='users'  && <UsersPanel />}
            {rightTab==='github' && <GitHubPanel slug={slug} onPushComplete={handlePushComplete} />}
          </div>
        </div>
      </div>
    </div>
  );
}