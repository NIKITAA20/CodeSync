import { useState, useRef } from 'react';

const FILE_ICONS = {
  js: '🟨', jsx: '🟨', ts: '🔷', tsx: '🔷',
  py: '🐍', cpp: '⚙️', c: '⚙️', java: '☕',
  go: '🐹', rs: '🦀', html: '🌐', css: '🎨',
  json: '📋', md: '📝', txt: '📄', default: '📄',
};

const getIcon = (name) => {
  const ext = name.split('.').pop()?.toLowerCase();
  return FILE_ICONS[ext] || FILE_ICONS.default;
};

const getLang = (name) => {
  const ext = name.split('.').pop()?.toLowerCase();
  const map = { js:'JAVASCRIPT', jsx:'JAVASCRIPT', ts:'TYPESCRIPT', tsx:'TYPESCRIPT', py:'PYTHON', cpp:'CPP', c:'CPP', java:'JAVA', go:'GO', rs:'RUST' };
  return map[ext] || 'JAVASCRIPT';
};

// Recursive tree node
function TreeNode({ node, depth = 0, activeFile, onFileClick, onRename, onDelete, onNewFile, onNewFolder }) {
  const [open, setOpen] = useState(true);
  const [showMenu, setShowMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameVal, setRenameVal] = useState(node.name);
  const menuRef = useRef(null);

  const isFolder = node.type === 'folder';
  const isActive = !isFolder && activeFile?.id === node.id;

  const handleRightClick = (e) => {
    e.preventDefault();
    setShowMenu(true);
    setTimeout(() => {
      const close = (ev) => { if (!menuRef.current?.contains(ev.target)) { setShowMenu(false); document.removeEventListener('mousedown', close); }};
      document.addEventListener('mousedown', close);
    }, 0);
  };

  const handleRenameSubmit = (e) => {
    e.preventDefault();
    if (renameVal.trim()) { onRename(node.id, renameVal.trim()); }
    setRenaming(false);
  };

  return (
    <div>
      <div
        onContextMenu={handleRightClick}
        onClick={() => { if (isFolder) setOpen(o => !o); else onFileClick(node); }}
        style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: `3px 8px 3px ${12 + depth * 12}px`,
          cursor: 'pointer', borderRadius: 4, position: 'relative',
          background: isActive ? '#00FF8820' : 'transparent',
          borderLeft: isActive ? '2px solid #00FF88' : '2px solid transparent',
        }}
        className="hover-row"
      >
        {/* Expand arrow for folders */}
        {isFolder && (
          <span style={{ fontSize: 8, color: '#64748B', width: 10, flexShrink: 0 }}>
            {open ? '▼' : '▶'}
          </span>
        )}
        {!isFolder && <span style={{ width: 10, flexShrink: 0 }} />}

        <span style={{ fontSize: 12 }}>{isFolder ? (open ? '📂' : '📁') : getIcon(node.name)}</span>

        {renaming ? (
          <form onSubmit={handleRenameSubmit} style={{ flex: 1 }}>
            <input
              autoFocus
              value={renameVal}
              onChange={e => setRenameVal(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={e => e.key === 'Escape' && setRenaming(false)}
              style={{
                background: '#1E2A3A', border: '1px solid #00FF88', borderRadius: 3,
                color: '#E2E8F0', fontSize: 11, padding: '1px 4px', width: '100%', fontFamily: 'inherit',
              }}
            />
          </form>
        ) : (
          <span style={{ fontSize: 11, color: isActive ? '#00FF88' : '#94A3B8', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {node.name}
          </span>
        )}

        {/* Context menu */}
        {showMenu && (
          <div ref={menuRef} style={{
            position: 'absolute', top: 20, left: `${12 + depth * 12}px`, zIndex: 100,
            background: '#161B27', border: '1px solid #2A3A4A', borderRadius: 8,
            padding: 4, minWidth: 150, boxShadow: '0 8px 24px #00000080',
          }}>
            {isFolder && (
              <>
                <MenuItem icon="📄" label="New File" onClick={() => { onNewFile(node.id); setShowMenu(false); }} />
                <MenuItem icon="📁" label="New Folder" onClick={() => { onNewFolder(node.id); setShowMenu(false); }} />
                <div style={{ height: 1, background: '#1E2A3A', margin: '4px 0' }} />
              </>
            )}
            <MenuItem icon="✏️" label="Rename" onClick={() => { setRenaming(true); setRenameVal(node.name); setShowMenu(false); }} />
            <MenuItem icon="🗑️" label="Delete" onClick={() => { onDelete(node.id); setShowMenu(false); }} color="#FF6B6B" />
          </div>
        )}
      </div>

      {/* Children */}
      {isFolder && open && node.children?.map(child => (
        <TreeNode key={child.id} node={child} depth={depth + 1}
          activeFile={activeFile} onFileClick={onFileClick}
          onRename={onRename} onDelete={onDelete}
          onNewFile={onNewFile} onNewFolder={onNewFolder}
        />
      ))}
    </div>
  );
}

function MenuItem({ icon, label, onClick, color }) {
  return (
    <div onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px',
      fontSize: 11, color: color || '#94A3B8', cursor: 'pointer', borderRadius: 4,
    }} className="menu-item">
      <span>{icon}</span>{label}
    </div>
  );
}

let _id = 100;
const newId = () => String(++_id);

const DEFAULT_TREE = [
  {
    id: '1', name: 'src', type: 'folder', children: [
      { id: '2', name: 'index.js', type: 'file', language: 'JAVASCRIPT', content: '// Start coding here\nconsole.log("Hello from CodeSync!");\n' },
      { id: '3', name: 'utils.js', type: 'file', language: 'JAVASCRIPT', content: '// Utility functions\nexport const add = (a, b) => a + b;\n' },
    ],
  },
  { id: '4', name: 'README.md', type: 'file', language: 'JAVASCRIPT', content: '# My Project\n\nBuilt with CodeSync 🚀\n' },
];

export default function FileExplorer({ onFileSelect, activeFile }) {
  const [tree, setTree] = useState(DEFAULT_TREE);
  const [creatingIn, setCreatingIn] = useState(null); // { parentId, type }
  const [newName, setNewName] = useState('');

  // Find node by id (recursive)
  const findNode = (nodes, id) => {
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) { const found = findNode(n.children, id); if (found) return found; }
    }
    return null;
  };

  // Add node to parent
  const addNode = (nodes, parentId, newNode) =>
    nodes.map(n => {
      if (n.id === parentId) return { ...n, children: [...(n.children || []), newNode] };
      if (n.children) return { ...n, children: addNode(n.children, parentId, newNode) };
      return n;
    });

  // Delete node
  const deleteNode = (nodes, id) =>
    nodes.filter(n => n.id !== id).map(n =>
      n.children ? { ...n, children: deleteNode(n.children, id) } : n
    );

  // Rename node
  const renameNode = (nodes, id, name) =>
    nodes.map(n => {
      if (n.id === id) return { ...n, name, ...(n.type === 'file' ? { language: getLang(name) } : {}) };
      if (n.children) return { ...n, children: renameNode(n.children, id, name) };
      return n;
    });

  const handleNewFile = (parentId) => { setCreatingIn({ parentId, type: 'file' }); setNewName(''); };
  const handleNewFolder = (parentId) => { setCreatingIn({ parentId, type: 'folder' }); setNewName(''); };

  const handleCreateSubmit = (e) => {
    e?.preventDefault();
    if (!newName.trim()) { setCreatingIn(null); return; }
    const node = creatingIn.type === 'file'
      ? { id: newId(), name: newName.trim(), type: 'file', language: getLang(newName.trim()), content: '' }
      : { id: newId(), name: newName.trim(), type: 'folder', children: [] };

    if (creatingIn.parentId === 'root') {
      setTree(t => [...t, node]);
    } else {
      setTree(t => addNode(t, creatingIn.parentId, node));
    }
    setCreatingIn(null);
    if (node.type === 'file') onFileSelect(node);
  };

  return (
    <div style={{ height: '100%', background: '#0D1117', display: 'flex', flexDirection: 'column', userSelect: 'none' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 10px', borderBottom: '1px solid #1E2A3A', flexShrink: 0 }}>
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: '#64748B' }}>EXPLORER</span>
        <div style={{ display: 'flex', gap: 4 }}>
          <IconBtn title="New File" onClick={() => handleNewFile('root')}>📄+</IconBtn>
          <IconBtn title="New Folder" onClick={() => handleNewFolder('root')}>📁+</IconBtn>
        </div>
      </div>

      {/* Tree */}
      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {tree.map(node => (
          <TreeNode key={node.id} node={node}
            activeFile={activeFile}
            onFileClick={onFileSelect}
            onRename={(id, name) => setTree(t => renameNode(t, id, name))}
            onDelete={(id) => setTree(t => deleteNode(t, id))}
            onNewFile={handleNewFile}
            onNewFolder={handleNewFolder}
          />
        ))}

        {/* Inline create input */}
        {creatingIn && (
          <form onSubmit={handleCreateSubmit} style={{ padding: '4px 12px' }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onBlur={handleCreateSubmit}
              onKeyDown={e => e.key === 'Escape' && setCreatingIn(null)}
              placeholder={creatingIn.type === 'file' ? 'filename.js' : 'folder-name'}
              style={{
                width: '100%', background: '#1E2A3A', border: '1px solid #00FF88',
                borderRadius: 4, color: '#E2E8F0', fontSize: 11, padding: '3px 6px',
                fontFamily: 'inherit', boxSizing: 'border-box',
              }}
            />
          </form>
        )}
      </div>

      <style>{`
        .hover-row:hover { background: #0A0E1A !important; }
        .menu-item:hover { background: #1E2A3A; }
      `}</style>
    </div>
  );
}

function IconBtn({ children, onClick, title }) {
  return (
    <button onClick={onClick} title={title} style={{
      background: 'none', border: 'none', color: '#64748B', cursor: 'pointer',
      fontSize: 12, padding: '2px 4px', borderRadius: 3,
    }} className="menu-item">
      {children}
    </button>
  );
}