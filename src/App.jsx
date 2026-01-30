import React, { useState, useEffect, useRef } from 'react';
import { 
  Folder, 
  File, 
  ChevronRight, 
  ShieldCheck, 
  Search, 
  HardDrive,
  AlertCircle,
  Lock,
  Unlock,
  X,
  FileKey,
  RefreshCw,
  Server,
  ChevronDown
} from 'lucide-react';

/**
 * SECURE FILE EXPLORER (DIEX v4.2)
 * Integration: Java Backend (localhost:8080)
 * Features: Local AES-256-GCM, Filename Obfuscation, Metadata recovery.
 */

// Change this to your deployed backend URL if applicable, 
// though typically Java backends run locally for private vaults.
const API_BASE = "http://localhost:8080/api";

export default function App() {
  const [currentPath, setCurrentPath] = useState(""); 
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Encryption State
  const [selectedFile, setSelectedFile] = useState(null);
  const [password, setPassword] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // Load files from Java Backend
  const fetchFiles = async (path) => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`${API_BASE}/list?path=${encodeURIComponent(path)}`);
      if (!resp.ok) throw new Error("Could not connect to Java Server. Ensure it is running on port 8080.");
      const data = await resp.json();
      
      const formatted = data.map(item => ({
        name: item.name,
        kind: item.isDirectory ? 'directory' : 'file',
        size: item.size,
        path: path ? `${path}/${item.name}` : item.name
      }));

      formatted.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'directory' ? -1 : 1));
      setFiles(formatted);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFiles(currentPath);
  }, [currentPath]);

  // --- CRYPTOGRAPHY ENGINE ---

  const deriveKey = async (password, salt) => {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      baseKey,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  };

  const encryptFile = async () => {
    if (!password || !selectedFile) return;
    setIsProcessing(true);
    try {
      const resp = await fetch(`${API_BASE}/download?path=${encodeURIComponent(selectedFile.path)}`);
      const originalData = await resp.arrayBuffer();

      const fileNameBytes = new TextEncoder().encode(selectedFile.name);
      const fileNameLen = new Uint32Array([fileNameBytes.length]);
      
      const payload = new Uint8Array(4 + fileNameBytes.length + originalData.byteLength);
      payload.set(new Uint8Array(fileNameLen.buffer), 0);
      payload.set(fileNameBytes, 4);
      payload.set(new Uint8Array(originalData), 4 + fileNameBytes.length);

      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await deriveKey(password, salt);
      const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, payload);

      const finalBlob = new Blob([salt, iv, new Uint8Array(ciphertext)], { type: "application/octet-stream" });
      const randomID = Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('');
      
      downloadBlob(finalBlob, `${randomID}.diex`);
      setSelectedFile(null);
      setPassword("");
    } catch (err) {
      setError("Encryption failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const decryptFile = async () => {
    if (!password || !selectedFile) return;
    setIsProcessing(true);
    try {
      const resp = await fetch(`${API_BASE}/download?path=${encodeURIComponent(selectedFile.path)}`);
      const buffer = await resp.arrayBuffer();
      
      const salt = buffer.slice(0, 16);
      const iv = buffer.slice(16, 28);
      const encryptedData = buffer.slice(28);
      
      const key = await deriveKey(password, new Uint8Array(salt));
      const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(iv) }, key, encryptedData);

      const view = new DataView(decrypted);
      const nameLen = view.getUint32(0, true);
      const name = new TextDecoder().decode(decrypted.slice(4, 4 + nameLen));
      const data = decrypted.slice(4 + nameLen);

      downloadBlob(new Blob([data]), name);
      setSelectedFile(null);
      setPassword("");
    } catch (err) {
      setError("Decryption failed. Check your password.");
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadBlob = (blob, fileName) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isDiex = selectedFile?.name.toLowerCase().endsWith('.diex');
  const filteredFiles = files.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans p-4 md:p-12 selection:bg-indigo-500/30">
      <div className="max-w-5xl mx-auto">
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 mb-12">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="text-white" size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">DIEX VAULT</h1>
              <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-widest">End-to-End Encryption</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                type="text" 
                placeholder="Search server..." 
                className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2.5 pl-11 pr-4 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button onClick={() => fetchFiles(currentPath)} className="p-3 bg-slate-800 rounded-xl hover:bg-slate-700 transition-colors">
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </header>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3 text-red-400 text-sm">
            <AlertCircle size={18} />
            <span className="flex-1">{error}</span>
            <X size={18} className="cursor-pointer" onClick={() => setError(null)} />
          </div>
        )}

        <div className="mb-4 flex items-center gap-2 text-xs font-mono text-slate-500 overflow-x-auto whitespace-nowrap">
          <Server size={14} className="text-indigo-500" />
          <span className="cursor-pointer hover:text-white" onClick={() => setCurrentPath("")}>root</span>
          {currentPath.split('/').filter(Boolean).map((p, i, a) => (
            <React.Fragment key={i}>
              <ChevronRight size={12} />
              <span className="cursor-pointer hover:text-white" onClick={() => setCurrentPath(a.slice(0, i+1).join('/'))}>{p}</span>
            </React.Fragment>
          ))}
        </div>

        <main className="bg-slate-900/50 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl min-h-[500px]">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-800/30 border-b border-slate-800">
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500">Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-right">Size</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {currentPath && (
                  <tr onClick={() => setCurrentPath(currentPath.split('/').slice(0,-1).join('/'))} className="hover:bg-indigo-500/5 cursor-pointer">
                    <td className="px-6 py-4 text-sm text-slate-500 flex items-center gap-2">
                      <ChevronRight className="rotate-180" size={14} /> Back
                    </td>
                    <td></td>
                  </tr>
                )}
                {filteredFiles.map((f, i) => (
                  <tr key={i} onClick={() => f.kind === 'directory' ? setCurrentPath(f.path) : setSelectedFile(f)} className="hover:bg-indigo-500/5 cursor-pointer transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className={`p-2 rounded-lg ${f.kind === 'directory' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-slate-800 text-slate-400'}`}>
                          {f.kind === 'directory' ? <Folder size={18} /> : <File size={18} />}
                        </div>
                        <span className={`text-sm ${f.name.endsWith('.diex') ? 'text-indigo-400 font-semibold' : 'text-slate-300'}`}>{f.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right font-mono text-[10px] text-slate-500">
                      {f.kind === 'directory' ? '--' : `${(f.size/1024).toFixed(1)} KB`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </main>

        {selectedFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-800 w-full max-w-sm rounded-3xl p-8 shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold flex items-center gap-2">
                  {isDiex ? <Unlock className="text-indigo-400" size={20} /> : <Lock className="text-indigo-400" size={20} />}
                  {isDiex ? 'Decrypting' : 'Encrypting'}
                </h3>
                <X className="cursor-pointer text-slate-500" onClick={() => setSelectedFile(null)} />
              </div>
              <div className="mb-6 p-3 bg-slate-950 rounded-xl text-[11px] font-mono text-indigo-300 truncate border border-slate-800">
                {selectedFile.name}
              </div>
              <input 
                type="password" 
                placeholder="Vault Password" 
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 mb-4 outline-none focus:ring-1 focus:ring-indigo-500"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <button 
                onClick={isDiex ? decryptFile : encryptFile}
                disabled={isProcessing || !password}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20"
              >
                {isProcessing ? <RefreshCw className="animate-spin mx-auto" /> : (isDiex ? 'Unlock & Download' : 'Protect & Obfuscate')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}