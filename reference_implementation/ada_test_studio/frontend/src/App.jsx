// import { useState, useEffect, useCallback } from "react";

// const API = "http://localhost:5050/api";

// // ── helpers ────────────────────────────────────────────────────────────────

// function typeDefault(type) {
//   const tl = (type || "").toLowerCase();
//   if (tl.includes("bool"))      return "False";
//   if (tl.includes("float"))     return "0.0";
//   if (tl.includes("character")) return "'A'";
//   if (tl.includes("string"))    return '"Hello"';
//   return "0";
// }

// function typeLabel(type) {
//   const tl = (type || "").toLowerCase();
//   if (tl.includes("uint16"))   return "0 .. 65535";
//   if (tl.includes("uint32"))   return "0 .. 4294967295";
//   if (tl.includes("natural"))  return "0 .. 2147483647";
//   if (tl.includes("integer"))  return "-2147483648 .. 2147483647";
//   if (tl.includes("float"))    return "float";
//   if (tl.includes("bool"))     return "True | False";
//   return "";
// }

// function caseBadge(type) {
//   const t = type || "";
//   const tl = t.toLowerCase();
//   if (t === t.toUpperCase() && t !== tl)
//     return <span className="badge badge-caps">CAPS</span>;
//   if (t === tl)
//     return <span className="badge badge-lower">lower</span>;
//   return <span className="badge badge-orig">orig</span>;
// }

// function StatusDot({ status }) {
//   const color = { pass: "#1D9E75", fail: "#E24B4A", error: "#BA7517", none: "#B4B2A9" };
//   return (
//     <span style={{
//       display: "inline-block", width: 8, height: 8, borderRadius: "50%",
//       background: color[status] || color.none, flexShrink: 0,
//     }} />
//   );
// }

// // ── API calls ──────────────────────────────────────────────────────────────

// async function apiGet(path) {
//   const r = await fetch(API + path);
//   return r.json();
// }

// async function apiPost(path, body) {
//   const r = await fetch(API + path, {
//     method: "POST",
//     headers: { "Content-Type": "application/json" },
//     body: JSON.stringify(body),
//   });
//   return r.json();
// }

// // ── FileExplorer panel ─────────────────────────────────────────────────────

// function FileExplorer({ files, activeFile, onSelect }) {
//   return (
//     <div className="panel">
//       <div className="panel-head">
//         <i className="ti ti-folder" /> files
//       </div>
//       {files.map(f => (
//         <div
//           key={f.path}
//           className={`sidebar-item ${activeFile === f.path ? "active" : ""}`}
//           onClick={() => onSelect(f)}
//         >
//           <i className={`ti ${f.ext === ".ads" ? "ti-file-description" : "ti-file-code"}`} />
//           <span className="item-name">{f.name}</span>
//           <span className="item-ext">{f.ext}</span>
//         </div>
//       ))}
//     </div>
//   );
// }

// // ── SubprogramList panel ───────────────────────────────────────────────────

// function SubprogramList({ subprograms, activeSubp, testResults, onSelect }) {
//   const statusOf = (name) => {
//     const rs = testResults.filter(r => r.subprogram === name);
//     if (!rs.length) return "none";
//     if (rs.some(r => r.status === "fail" || r.status === "error")) return "fail";
//     if (rs.every(r => r.status === "pass")) return "pass";
//     return "none";
//   };

//   return (
//     <div className="panel">
//       <div className="panel-head">
//         <i className="ti ti-function" /> subprograms
//       </div>
//       {subprograms.map(s => (
//         <div
//           key={s.name}
//           className={`sidebar-item ${activeSubp?.name === s.name ? "active" : ""}`}
//           onClick={() => onSelect(s)}
//         >
//           <StatusDot status={statusOf(s.name)} />
//           <span className="item-name">{s.name}</span>
//           {s.is_dead && <span className="badge badge-dead">dead</span>}
//         </div>
//       ))}
//     </div>
//   );
// }

// // ── Source viewer ──────────────────────────────────────────────────────────

// function SourceViewer({ file }) {
//   const [source, setSource] = useState("");
//   useEffect(() => {
//     if (!file) return;
//     apiGet("/file?path=" + encodeURIComponent(file.path)).then(d => setSource(d.source || ""));
//   }, [file]);

//   if (!file) return <div className="empty-state"><i className="ti ti-file" /> select a file</div>;

//   return (
//     <div className="source-viewer">
//       <div className="viewer-head">{file.name}</div>
//       <pre className="source-code">{source}</pre>
//     </div>
//   );
// }

// // ── Variable dropdown row ──────────────────────────────────────────────────

// function VarRow({ variable }) {
//   const c = variable.constraint || {};
//   return (
//     <div className="var-row">
//       <span className="var-name">{variable.name}</span>
//       <span className="var-type mono">
//         {variable.type} {caseBadge(variable.type)}
//       </span>
//       <span className="var-norm mono">{variable.type_normalized}</span>
//       <span className={`scope-pill scope-${variable.scope}`}>{variable.scope}</span>
//       {c.kind === "boolean" ? (
//         <select className="var-input" defaultValue="False">
//           <option>True</option><option>False</option>
//         </select>
//       ) : c.kind === "integer" ? (
//         <input type="number" className="var-input" defaultValue={0}
//           min={c.min} max={c.max} />
//       ) : c.kind === "float" ? (
//         <input type="text" className="var-input" defaultValue="0.0" />
//       ) : (
//         <input type="text" className="var-input" defaultValue="" />
//       )}
//       <span className="var-range">{typeLabel(variable.type)}</span>
//     </div>
//   );
// }

// // ── Test panel ─────────────────────────────────────────────────────────────

// function TestPanel({ subp, testResults, onRunTest }) {
//   const [inputs, setInputs]   = useState({});
//   const [expected, setExpected] = useState({});
//   const [running, setRunning] = useState(false);
//   const [lastResult, setLastResult] = useState(null);

//   useEffect(() => {
//     if (!subp) return;
//     const init = {};
//     subp.params.filter(p => p.dir.includes("in")).forEach(p => {
//       init[p.name] = typeDefault(p.type);
//     });
//     setInputs(init);
//     const exp = {};
//     subp.params.filter(p => p.dir.includes("out")).forEach(p => {
//       exp[p.name] = typeDefault(p.type);
//     });
//     setExpected(exp);
//     setLastResult(null);
//   }, [subp?.name]);

//   const setInput   = (k, v) => setInputs(i   => ({ ...i, [k]: v }));
//   const setExpect  = (k, v) => setExpected(e => ({ ...e, [k]: v }));

//   const autoGen = () => {
//     const next = {};
//     subp.params.filter(p => p.dir.includes("in")).forEach(p => {
//       const c = p.constraint || {};
//       if (c.kind === "integer") next[p.name] = String(Math.floor(Math.random() * Math.min(c.max, 255)));
//       else if (c.kind === "float") next[p.name] = (Math.random() * 10).toFixed(2);
//       else if (c.kind === "boolean") next[p.name] = Math.random() > 0.5 ? "True" : "False";
//       else next[p.name] = typeDefault(p.type);
//     });
//     setInputs(next);
//   };

//   const runTest = async () => {
//     setRunning(true);
//     const result = await onRunTest(subp.name, inputs, expected);
//     setLastResult(result);
//     setRunning(false);
//   };

//   if (!subp) return <div className="empty-state"><i className="ti ti-function" /> select a subprogram</div>;

//   const inParams  = subp.params.filter(p => p.dir.includes("in") && !p.dir.includes("out"));
//   const outParams = subp.params.filter(p => p.dir.includes("out"));
//   const prevResults = testResults.filter(r => r.subprogram === subp.name);

//   return (
//     <div className="test-panel">
//       <div className="test-head">
//         <span className="test-title">{subp.name}</span>
//         <span className="test-meta">
//           {subp.file_name} · lines {subp.start_line}–{subp.end_line}
//           · complexity {subp.complexity}
//           {subp.is_dead && <span className="badge badge-dead">dead code</span>}
//         </span>
//       </div>

//       <div className="section-tabs">
//         <span className="stab active">inputs</span>
//         <span className="stab">variables</span>
//         <span className="stab">history</span>
//       </div>

//       <div className="input-section">
//         <div className="input-grid">
//           {inParams.map(p => (
//             <div key={p.name} className="input-card">
//               <div className="input-header">
//                 <span className="input-dir">{p.dir}</span>
//                 <span className="input-name">{p.name}</span>
//               </div>
//               <div className="input-type mono">
//                 {p.type} {caseBadge(p.type)}
//               </div>
//               {typeLabel(p.type) && (
//                 <div className="input-range">{typeLabel(p.type)}</div>
//               )}
//               {p.constraint?.kind === "boolean" ? (
//                 <select
//                   className="input-field"
//                   value={inputs[p.name] || "False"}
//                   onChange={e => setInput(p.name, e.target.value)}
//                 >
//                   <option>True</option><option>False</option>
//                 </select>
//               ) : (
//                 <input
//                   className="input-field"
//                   type={p.constraint?.kind === "integer" ? "number" : "text"}
//                   value={inputs[p.name] ?? typeDefault(p.type)}
//                   onChange={e => setInput(p.name, e.target.value)}
//                   min={p.constraint?.min}
//                   max={p.constraint?.max}
//                 />
//               )}
//             </div>
//           ))}
//         </div>

//         {outParams.length > 0 && (
//           <>
//             <div className="section-label">expected output</div>
//             <div className="input-grid">
//               {outParams.map(p => (
//                 <div key={p.name} className="input-card input-card-out">
//                   <div className="input-header">
//                     <span className="input-dir out">out</span>
//                     <span className="input-name">{p.name}</span>
//                   </div>
//                   <div className="input-type mono">{p.type} {caseBadge(p.type)}</div>
//                   <input
//                     className="input-field"
//                     type="text"
//                     value={expected[p.name] ?? typeDefault(p.type)}
//                     onChange={e => setExpect(p.name, e.target.value)}
//                     placeholder="expected value"
//                   />
//                 </div>
//               ))}
//             </div>
//           </>
//         )}
//       </div>

//       <div className="btn-row">
//         <button className="btn btn-primary" onClick={runTest} disabled={running}>
//           <i className="ti ti-player-play" />
//           {running ? "running..." : "run test"}
//         </button>
//         <button className="btn" onClick={autoGen}>
//           <i className="ti ti-wand" /> auto-fill
//         </button>
//         <button className="btn" onClick={() => {
//           const inp = JSON.stringify(inputs, null, 2);
//           const blob = new Blob([inp], { type: "application/json" });
//           const a = document.createElement("a");
//           a.href = URL.createObjectURL(blob);
//           a.download = `${subp.name}_inputs.json`;
//           a.click();
//         }}>
//           <i className="ti ti-download" /> export inputs
//         </button>
//       </div>

//       {lastResult && (
//         <div className={`result-box result-${lastResult.status}`}>
//           <div className="result-header">
//             <i className={`ti ${lastResult.status === "pass" ? "ti-circle-check" : "ti-circle-x"}`} />
//             <span>{lastResult.message}</span>
//             <span className="result-time">{lastResult.elapsed_ms}ms</span>
//           </div>
//           {lastResult.violations?.length > 0 && (
//             <ul className="violation-list">
//               {lastResult.violations.map((v, i) => (
//                 <li key={i} className="mono">
//                   {v.variable} ({v.type}): {v.error}
//                 </li>
//               ))}
//             </ul>
//           )}
//           {Object.keys(lastResult.actual || {}).length > 0 && (
//             <div className="result-table mono">
//               {Object.entries(lastResult.actual).map(([k, v]) => (
//                 <div key={k} className="result-row">
//                   <span>{k}</span>
//                   <span className="result-expected">expected: {expected[k]}</span>
//                   <span className={`result-actual ${v === expected[k] ? "ok" : "bad"}`}>
//                     actual: {v}
//                   </span>
//                 </div>
//               ))}
//             </div>
//           )}
//           <div className="result-types mono">
//             normalized types: {JSON.stringify(lastResult.normalized_types || {})}
//           </div>
//         </div>
//       )}

//       {prevResults.length > 0 && (
//         <div className="history">
//           <div className="section-label">test history</div>
//           {prevResults.slice().reverse().map(r => (
//             <div key={r.id} className={`history-row result-${r.status}`}>
//               <StatusDot status={r.status} />
//               <span className="mono">{r.id}</span>
//               <span>{r.timestamp}</span>
//               <span>{r.status}</span>
//               <span className="mono" style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
//                 {JSON.stringify(r.inputs)}
//               </span>
//             </div>
//           ))}
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Top summary bar ────────────────────────────────────────────────────────

// function SummaryBar({ subprograms, testResults, projectPath, onAnalyze }) {
//   const [path, setPath] = useState(projectPath);
//   const passed  = testResults.filter(r => r.status === "pass").length;
//   const failed  = testResults.filter(r => r.status === "fail" || r.status === "error").length;
//   const pending = subprograms.length - new Set(testResults.map(r => r.subprogram)).size;

//   return (
//     <div className="topbar">
//       <div className="topbar-left">
//         <i className="ti ti-test-pipe" style={{ fontSize: 18 }} />
//         <span className="app-title">Ada test studio</span>
//         <div className="path-input-group">
//           <input
//             className="path-input"
//             value={path}
//             onChange={e => setPath(e.target.value)}
//             placeholder="/path/to/ada/project"
//           />
//           <button className="btn btn-primary" onClick={() => onAnalyze(path)}>
//             <i className="ti ti-refresh" /> analyze
//           </button>
//         </div>
//       </div>
//       <div className="topbar-right">
//         <span className="stat-pill pass">{passed} passed</span>
//         <span className="stat-pill fail">{failed} failed</span>
//         <span className="stat-pill pend">{pending} pending</span>
//       </div>
//     </div>
//   );
// }

// // ── Root App ───────────────────────────────────────────────────────────────

// export default function App() {
//   const [files,       setFiles]       = useState([]);
//   const [subprograms, setSubprograms] = useState([]);
//   const [testResults, setTestResults] = useState([]);
//   const [activeFile,  setActiveFile]  = useState(null);
//   const [activeSubp,  setActiveSubp]  = useState(null);
//   const [projectPath, setProjectPath] = useState("");
//   const [view,        setView]        = useState("test");  // "test" | "source"

//   const refresh = useCallback(async () => {
//     const [f, s, r] = await Promise.all([
//       apiGet("/files"),
//       apiGet("/subprograms"),
//       apiGet("/test/results"),
//     ]);
//     setFiles(f);
//     setSubprograms(s);
//     setTestResults(r);
//   }, []);

//   useEffect(() => { refresh(); }, [refresh]);

//   const analyze = async (path) => {
//     await apiPost("/analyze", { path });
//     setProjectPath(path);
//     await refresh();
//   };

//   const runTest = async (subpName, inputs, expected) => {
//     const result = await apiPost("/test/run", { subprogram: subpName, inputs, expected });
//     setTestResults(prev => [...prev, { ...result, subprogram: subpName,
//       timestamp: new Date().toLocaleTimeString(), inputs, expected }]);
//     return result;
//   };

//   const selectFile = (file) => {
//     setActiveFile(file);
//     // auto-select first subprogram in this file
//     const first = subprograms.find(s => s.file === file.path);
//     if (first) setActiveSubp(first);
//     setView("source");
//   };

//   const selectSubp = (s) => {
//     setActiveSubp(s);
//     // auto-select its file
//     const f = files.find(f => f.path === s.file);
//     if (f) setActiveFile(f);
//     setView("test");
//   };

//   return (
//     <div className="app">
//       <SummaryBar
//         subprograms={subprograms}
//         testResults={testResults}
//         projectPath={projectPath}
//         onAnalyze={analyze}
//       />
//       <div className="workspace">
//         <div className="left-col">
//           <FileExplorer
//             files={files}
//             activeFile={activeFile?.path}
//             onSelect={selectFile}
//           />
//           <SubprogramList
//             subprograms={subprograms}
//             activeSubp={activeSubp}
//             testResults={testResults}
//             onSelect={selectSubp}
//           />
//         </div>
//         <div className="center-col">
//           {view === "source"
//             ? <SourceViewer file={activeFile} />
//             : <TestPanel
//                 subp={activeSubp}
//                 testResults={testResults}
//                 onRunTest={runTest}
//               />
//           }
//         </div>
//         <div className="right-col">
//           <div className="panel-head"><i className="ti ti-list" /> all results</div>
//           {testResults.length === 0
//             ? <div className="empty-state" style={{padding:"1rem"}}>no tests run yet</div>
//             : testResults.slice().reverse().map(r => (
//               <div key={r.id} className="result-item">
//                 <StatusDot status={r.status} />
//                 <div>
//                   <div style={{fontSize:12,fontWeight:500}}>{r.subprogram}</div>
//                   <div style={{fontSize:11,color:"var(--color-text-secondary)"}}>{r.timestamp} · {r.status}</div>
//                 </div>
//               </div>
//             ))
//           }
//         </div>
//       </div>
//     </div>
//   );
// }



// import { useState, useEffect, useCallback, useRef } from "react";

// const API = "http://localhost:5050/api";

// // ── helpers ────────────────────────────────────────────────────────────────

// function typeDefault(type) {
//   const tl = (type || "").toLowerCase();
//   if (tl.includes("bool"))      return "False";
//   if (tl.includes("float"))     return "0.0";
//   if (tl.includes("character")) return "'A'";
//   if (tl.includes("string"))    return '"Hello"';
//   return "0";
// }

// function typeLabel(type) {
//   const tl = (type || "").toLowerCase();
//   if (tl.includes("uint16"))  return "0 .. 65535";
//   if (tl.includes("uint32"))  return "0 .. 4294967295";
//   if (tl.includes("natural")) return "0 .. 2147483647";
//   if (tl.includes("integer")) return "-2147483648 .. 2147483647";
//   if (tl.includes("float"))   return "float";
//   if (tl.includes("bool"))    return "True | False";
//   return "";
// }

// function caseBadge(type) {
//   const t  = type || "";
//   const tl = t.toLowerCase();
//   if (t === t.toUpperCase() && t !== tl)
//     return <span className="badge badge-caps">CAPS</span>;
//   if (t === tl)
//     return <span className="badge badge-lower">lower</span>;
//   return <span className="badge badge-orig">orig</span>;
// }

// function StatusDot({ status }) {
//   const color = { pass: "#1D9E75", fail: "#E24B4A", error: "#BA7517", none: "#B4B2A9" };
//   return (
//     <span style={{
//       display: "inline-block", width: 8, height: 8, borderRadius: "50%",
//       background: color[status] || color.none, flexShrink: 0,
//     }} />
//   );
// }

// // ── API calls ──────────────────────────────────────────────────────────────

// // BUG FIX 1: apiGet and apiPost had no error handling — any network error
// // or non-2xx response silently returned undefined, causing downstream
// // "Cannot read properties of undefined" errors that swallowed the real issue.

// async function apiGet(path) {
//   try {
//     const r = await fetch(API + path);
//     if (!r.ok) {
//       console.error(`[API] GET ${path} → ${r.status}`);
//       return Array.isArray([]) ? [] : {};
//     }
//     return await r.json();
//   } catch (e) {
//     console.error(`[API] GET ${path} failed:`, e.message);
//     return [];
//   }
// }

// async function apiPost(path, body) {
//   try {
//     const r = await fetch(API + path, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify(body),
//     });
//     const data = await r.json();
//     if (!r.ok) console.error(`[API] POST ${path} → ${r.status}`, data);
//     return data;
//   } catch (e) {
//     console.error(`[API] POST ${path} failed:`, e.message);
//     return { error: e.message };
//   }
// }

// // ── FileExplorer ───────────────────────────────────────────────────────────

// function FileExplorer({ files, activeFile, onSelect }) {
//   return (
//     <div className="panel">
//       <div className="panel-head">
//         <i className="ti ti-folder" aria-hidden="true" /> files
//         {files.length === 0 && (
//           <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: 4 }}>
//             — run analyze
//           </span>
//         )}
//       </div>
//       {files.map(f => (
//         <div
//           key={f.path}
//           className={`sidebar-item ${activeFile === f.path ? "active" : ""}`}
//           onClick={() => onSelect(f)}
//         >
//           <i className={`ti ${f.ext === ".ads" ? "ti-file-description" : "ti-file-code"}`}
//              aria-hidden="true" />
//           <span className="item-name">{f.name}</span>
//           <span className="item-ext">{f.ext}</span>
//         </div>
//       ))}
//     </div>
//   );
// }

// // ── SubprogramList ─────────────────────────────────────────────────────────

// function SubprogramList({ subprograms, activeSubp, testResults, onSelect }) {
//   const statusOf = (name) => {
//     const rs = testResults.filter(r => r.subprogram === name);
//     if (!rs.length) return "none";
//     if (rs.some(r => r.status === "fail" || r.status === "error")) return "fail";
//     if (rs.every(r => r.status === "pass")) return "pass";
//     return "none";
//   };

//   return (
//     <div className="panel">
//       <div className="panel-head">
//         <i className="ti ti-function" aria-hidden="true" /> subprograms
//         {subprograms.length === 0 && (
//           <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: 4 }}>
//             — run analyze
//           </span>
//         )}
//       </div>
//       {subprograms.map(s => (
//         <div
//           key={`${s.file}-${s.name}`}
//           className={`sidebar-item ${activeSubp?.name === s.name && activeSubp?.file === s.file ? "active" : ""}`}
//           onClick={() => onSelect(s)}
//         >
//           <StatusDot status={statusOf(s.name)} />
//           <span className="item-name">{s.name}</span>
//           {s.is_dead && <span className="badge badge-dead">dead</span>}
//         </div>
//       ))}
//     </div>
//   );
// }

// // ── Source viewer ──────────────────────────────────────────────────────────

// function SourceViewer({ file }) {
//   const [source, setSource] = useState("");
//   const [loading, setLoading] = useState(false);

//   useEffect(() => {
//     if (!file) return;
//     setLoading(true);
//     apiGet("/file?path=" + encodeURIComponent(file.path))
//       .then(d => setSource(d.source || "-- (empty or unreadable)"))
//       .finally(() => setLoading(false));
//   }, [file?.path]);

//   if (!file) return (
//     <div className="empty-state">
//       <i className="ti ti-file" aria-hidden="true" /> select a file to view source
//     </div>
//   );

//   return (
//     <div className="source-viewer">
//       <div className="viewer-head">{file.name}</div>
//       {loading
//         ? <div className="empty-state">loading...</div>
//         : <pre className="source-code">{source}</pre>
//       }
//     </div>
//   );
// }

// // ── Test panel ─────────────────────────────────────────────────────────────

// // BUG FIX 2: The tab switching (inputs / variables / history) was purely visual —
// // clicking a tab added the "active" class but never showed/hid the tab panels
// // because there was no state driving visibility. Added activeTab state.

// function TestPanel({ subp, testResults, onRunTest }) {
//   const [inputs,      setInputs]      = useState({});
//   const [expected,    setExpected]    = useState({});
//   const [running,     setRunning]     = useState(false);
//   const [lastResult,  setLastResult]  = useState(null);
//   const [activeTab,   setActiveTab]   = useState("inputs");

//   // BUG FIX 3: inputs state was never reset when switching between subprograms.
//   // If you clicked Check_Pixel then Update_Grid, the old Check_Pixel input values
//   // remained visible/active. Now reset on every subp change.
//   useEffect(() => {
//     if (!subp) return;
//     const init = {};
//     subp.params
//       .filter(p => p.dir === "in" || p.dir === "in out")
//       .forEach(p => { init[p.name] = typeDefault(p.type); });
//     setInputs(init);

//     const exp = {};
//     subp.params
//       .filter(p => p.dir === "out" || p.dir === "in out")
//       .forEach(p => { exp[p.name] = typeDefault(p.type); });
//     setExpected(exp);

//     setLastResult(null);
//     setActiveTab("inputs");
//   }, [subp?.name, subp?.file]);   // include file — same name in different files

//   const setInput  = (k, v) => setInputs(i  => ({ ...i, [k]: v }));
//   const setExpect = (k, v) => setExpected(e => ({ ...e, [k]: v }));

//   const autoGen = () => {
//     if (!subp) return;
//     const next = {};
//     subp.params
//       .filter(p => p.dir === "in" || p.dir === "in out")
//       .forEach(p => {
//         const c = p.constraint || {};
//         if (c.kind === "integer")
//           next[p.name] = String(Math.floor(Math.random() * Math.min(c.max, 255)));
//         else if (c.kind === "float")
//           next[p.name] = (Math.random() * 10).toFixed(2);
//         else if (c.kind === "boolean")
//           next[p.name] = Math.random() > 0.5 ? "True" : "False";
//         else
//           next[p.name] = typeDefault(p.type);
//       });
//     setInputs(next);
//   };

//   const runTest = async () => {
//     setRunning(true);
//     const result = await onRunTest(subp.name, inputs, expected);
//     setLastResult(result);
//     setRunning(false);
//   };

//   if (!subp) return (
//     <div className="empty-state">
//       <i className="ti ti-function" aria-hidden="true" /> select a subprogram to test
//     </div>
//   );

//   // BUG FIX 4: param direction filter was wrong.
//   // `p.dir.includes("in")` matched BOTH "in" and "in out" correctly,
//   // but also matched "out" that had "in" elsewhere if data was dirty.
//   // Use exact string comparison instead.
//   const inParams  = subp.params.filter(p => p.dir === "in" || p.dir === "in out");
//   const outParams = subp.params.filter(p => p.dir === "out" || p.dir === "in out");
//   const prevResults = testResults.filter(r => r.subprogram === subp.name);

//   return (
//     <div className="test-panel">
//       <div className="test-head">
//         <span className="test-title">{subp.name}</span>
//         <div className="test-meta">
//           <span>{subp.file_name}</span>
//           {subp.start_line && <span>· lines {subp.start_line}–{subp.end_line}</span>}
//           {subp.complexity  && <span>· complexity {subp.complexity}</span>}
//           {subp.is_dead && <span className="badge badge-dead">dead code</span>}
//         </div>
//       </div>

//       {/* BUG FIX 2 cont: tabs now control activeTab state */}
//       <div className="section-tabs">
//         {["inputs", "variables", "history"].map(tab => (
//           <span
//             key={tab}
//             className={`stab ${activeTab === tab ? "active" : ""}`}
//             onClick={() => setActiveTab(tab)}
//           >
//             {tab}
//             {tab === "history" && prevResults.length > 0 &&
//               <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>
//                 ({prevResults.length})
//               </span>
//             }
//           </span>
//         ))}
//       </div>

//       {/* ── INPUTS TAB ── */}
//       {activeTab === "inputs" && (
//         <div className="input-section">
//           {inParams.length === 0 ? (
//             <div className="empty-state" style={{ padding: "1rem 0" }}>
//               no in parameters for this subprogram
//             </div>
//           ) : (
//             <>
//               <div className="section-label">in parameters — set test values</div>
//               <div className="input-grid">
//                 {inParams.map(p => (
//                   <div key={p.name} className="input-card">
//                     <div className="input-header">
//                       <span className="input-dir">{p.dir}</span>
//                       <span className="input-name">{p.name}</span>
//                     </div>
//                     <div className="input-type mono">
//                       {p.type} {caseBadge(p.type)}
//                     </div>
//                     {typeLabel(p.type) && (
//                       <div className="input-range">{typeLabel(p.type)}</div>
//                     )}
//                     {p.constraint?.kind === "boolean" ? (
//                       <select
//                         className="input-field"
//                         value={inputs[p.name] ?? "False"}
//                         onChange={e => setInput(p.name, e.target.value)}
//                       >
//                         <option>False</option>
//                         <option>True</option>
//                       </select>
//                     ) : (
//                       <input
//                         className="input-field"
//                         type={p.constraint?.kind === "integer" ? "number" : "text"}
//                         value={inputs[p.name] ?? typeDefault(p.type)}
//                         onChange={e => setInput(p.name, e.target.value)}
//                         min={p.constraint?.min}
//                         max={p.constraint?.max}
//                       />
//                     )}
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//           {outParams.length > 0 && (
//             <>
//               <div className="section-label">expected output values</div>
//               <div className="input-grid">
//                 {outParams.map(p => (
//                   <div key={p.name} className="input-card input-card-out">
//                     <div className="input-header">
//                       <span className="input-dir out">out</span>
//                       <span className="input-name">{p.name}</span>
//                     </div>
//                     <div className="input-type mono">{p.type} {caseBadge(p.type)}</div>
//                     {typeLabel(p.type) && (
//                       <div className="input-range">{typeLabel(p.type)}</div>
//                     )}
//                     <input
//                       className="input-field"
//                       type="text"
//                       value={expected[p.name] ?? typeDefault(p.type)}
//                       onChange={e => setExpect(p.name, e.target.value)}
//                       placeholder="expected value"
//                     />
//                   </div>
//                 ))}
//               </div>
//             </>
//           )}

//           <div className="btn-row">
//             <button className="btn btn-primary" onClick={runTest} disabled={running}>
//               <i className="ti ti-player-play" aria-hidden="true" />
//               {running ? "running..." : "run test"}
//             </button>
//             <button className="btn" onClick={autoGen}>
//               <i className="ti ti-wand" aria-hidden="true" /> auto-fill
//             </button>
//             <button className="btn" onClick={() => {
//               const blob = new Blob([JSON.stringify(inputs, null, 2)],
//                 { type: "application/json" });
//               const a = document.createElement("a");
//               a.href = URL.createObjectURL(blob);
//               a.download = `${subp.name}_inputs.json`;
//               a.click();
//             }}>
//               <i className="ti ti-download" aria-hidden="true" /> export inputs
//             </button>
//           </div>

//           {lastResult && (
//             <div className={`result-box result-${lastResult.status}`}>
//               <div className="result-header">
//                 <i className={`ti ${lastResult.status === "pass"
//                   ? "ti-circle-check" : "ti-circle-x"}`}
//                   aria-hidden="true" />
//                 <span>{lastResult.message}</span>
//                 <span className="result-time">{lastResult.elapsed_ms}ms</span>
//               </div>
//               {lastResult.violations?.length > 0 && (
//                 <ul className="violation-list">
//                   {lastResult.violations.map((v, i) => (
//                     <li key={i} className="mono">
//                       {v.variable} ({v.type}): {v.error}
//                     </li>
//                   ))}
//                 </ul>
//               )}
//               {Object.keys(lastResult.actual || {}).length > 0 && (
//                 <div className="result-table mono">
//                   {Object.entries(lastResult.actual).map(([k, v]) => (
//                     <div key={k} className="result-row">
//                       <span>{k}</span>
//                       <span className="result-expected">expected: {expected[k]}</span>
//                       <span className={`result-actual ${v === expected[k] ? "ok" : "bad"}`}>
//                         actual: {v}
//                       </span>
//                     </div>
//                   ))}
//                 </div>
//               )}
//               <div className="result-types mono">
//                 normalized types: {JSON.stringify(lastResult.normalized_types || {})}
//               </div>
//             </div>
//           )}
//         </div>
//       )}

//       {/* ── VARIABLES TAB ── */}
//       {activeTab === "variables" && (
//         <div className="input-section">
//           <div className="section-label">
//             all variables — declared type vs normalized (case-insensitive check)
//           </div>
//           {subp.variables.length === 0 ? (
//             <div className="empty-state" style={{ padding: "1rem 0" }}>
//               no variables extracted
//             </div>
//           ) : (
//             <table className="vars-table">
//               <thead>
//                 <tr>
//                   <th>name</th>
//                   <th>declared type</th>
//                   <th>normalized (.lower)</th>
//                   <th>scope</th>
//                   <th>constraint</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {subp.variables.map((v, i) => (
//                   <tr key={i}>
//                     <td className="mono">{v.name}</td>
//                     <td className="mono">
//                       {v.type} {caseBadge(v.type)}
//                     </td>
//                     <td className="mono" style={{ color: "var(--color-text-success)" }}>
//                       {v.type_normalized}
//                     </td>
//                     <td>
//                       <span className={`scope-pill scope-${v.scope}`}>{v.scope}</span>
//                     </td>
//                     <td className="mono" style={{ fontSize: 11 }}>
//                       {v.constraint?.kind === "integer"
//                         ? `${v.constraint.min} .. ${v.constraint.max}`
//                         : v.constraint?.kind || "—"}
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>
//           )}
//         </div>
//       )}

//       {/* ── HISTORY TAB ── */}
//       {activeTab === "history" && (
//         <div className="input-section">
//           <div className="section-label">test run history for {subp.name}</div>
//           {prevResults.length === 0 ? (
//             <div className="empty-state" style={{ padding: "1rem 0" }}>
//               no tests run yet — switch to inputs tab
//             </div>
//           ) : (
//             prevResults.slice().reverse().map(r => (
//               <div key={r.id} className={`history-row result-${r.status}`}>
//                 <StatusDot status={r.status} />
//                 <span className="mono" style={{ fontSize: 11, minWidth: 60 }}>{r.id}</span>
//                 <span style={{ fontSize: 11, minWidth: 70 }}>{r.timestamp}</span>
//                 <span style={{ fontSize: 11, fontWeight: 500 }}>{r.status}</span>
//                 <span className="mono" style={{ fontSize: 10, color: "var(--color-text-secondary)", flex: 1 }}>
//                   {JSON.stringify(r.inputs)}
//                 </span>
//               </div>
//             ))
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

// // ── Top summary bar ────────────────────────────────────────────────────────

// // BUG FIX 5: SummaryBar held its own local `path` state initialised from
// // `projectPath` prop — but projectPath started as "" so the input was always
// // blank. The user typed a path, clicked analyze, but the parent's `analyze()`
// // received the prop value ("") not the typed value because the local state
// // was disconnected from the parent. Fixed with a ref so the input value is
// // always read directly at click time.

// function SummaryBar({ subprograms, testResults, projectPath, onAnalyze, analyzing }) {
//   const pathRef = useRef(null);
//   const passed  = testResults.filter(r => r.status === "pass").length;
//   const failed  = testResults.filter(r => r.status === "fail" || r.status === "error").length;
//   const pending = Math.max(0,
//     subprograms.length - new Set(testResults.map(r => r.subprogram)).size
//   );

//   return (
//     <div className="topbar">
//       <div className="topbar-left">
//         <i className="ti ti-test-pipe" style={{ fontSize: 18 }} aria-hidden="true" />
//         <span className="app-title">Ada test studio</span>
//         <div className="path-input-group">
//           <input
//             ref={pathRef}
//             className="path-input"
//             defaultValue={projectPath}
//             placeholder="/path/to/ada/project"
//             onKeyDown={e => { if (e.key === "Enter") onAnalyze(pathRef.current.value.trim()); }}
//           />
//           <button
//             className="btn btn-primary"
//             disabled={analyzing}
//             onClick={() => onAnalyze(pathRef.current.value.trim())}
//           >
//             <i className={`ti ${analyzing ? "ti-loader-2" : "ti-refresh"}`} aria-hidden="true" />
//             {analyzing ? "analyzing..." : "analyze"}
//           </button>
//         </div>
//       </div>
//       <div className="topbar-right">
//         <span className="stat-pill pass">{passed} passed</span>
//         <span className="stat-pill fail">{failed} failed</span>
//         <span className="stat-pill pend">{pending} pending</span>
//       </div>
//     </div>
//   );
// }

// // ── Root App ───────────────────────────────────────────────────────────────

// export default function App() {
//   const [files,        setFiles]       = useState([]);
//   const [subprograms,  setSubprograms] = useState([]);
//   const [testResults,  setTestResults] = useState([]);
//   const [activeFile,   setActiveFile]  = useState(null);
//   const [activeSubp,   setActiveSubp]  = useState(null);
//   const [projectPath,  setProjectPath] = useState("");
//   const [view,         setView]        = useState("test");
//   const [analyzing,    setAnalyzing]   = useState(false);
//   const [statusMsg,    setStatusMsg]   = useState("");

//   const refresh = useCallback(async () => {
//     const [f, s, r] = await Promise.all([
//       apiGet("/files"),
//       apiGet("/subprograms"),
//       apiGet("/test/results"),
//     ]);
//     // Guard: API can return {} on error — only set state if arrays
//     if (Array.isArray(f)) setFiles(f);
//     if (Array.isArray(s)) setSubprograms(s);
//     if (Array.isArray(r)) setTestResults(r);
//   }, []);

//   // On mount: check if backend already has data (e.g. started with --path)
//   useEffect(() => { refresh(); }, [refresh]);

//   const analyze = async (path) => {
//     if (!path) {
//       setStatusMsg("⚠ enter a project path first");
//       return;
//     }
//     setAnalyzing(true);
//     setStatusMsg("analyzing...");
//     setActiveFile(null);
//     setActiveSubp(null);

//     const result = await apiPost("/analyze", { path });

//     if (result.error) {
//       setStatusMsg(`error: ${result.error}`);
//     } else {
//       setProjectPath(path);
//       setStatusMsg(
//         `found ${result.file_count} file(s), ${result.subprogram_count} subprogram(s)`
//       );
//       // Re-fetch everything so the UI reflects the new analysis
//       await refresh();
//     }
//     setAnalyzing(false);
//   };

//   const runTest = async (subpName, inputs, expected) => {
//     const result = await apiPost("/test/run", { subprogram: subpName, inputs, expected });
//     setTestResults(prev => [
//       ...prev,
//       {
//         ...result,
//         subprogram: subpName,
//         timestamp:  new Date().toLocaleTimeString(),
//         inputs,
//         expected,
//       },
//     ]);
//     return result;
//   };

//   const selectFile = (file) => {
//     setActiveFile(file);
//     const first = subprograms.find(s => s.file === file.path);
//     if (first) setActiveSubp(first);
//     setView("source");
//   };

//   const selectSubp = (s) => {
//     setActiveSubp(s);
//     const f = files.find(f => f.path === s.file);
//     if (f) setActiveFile(f);
//     setView("test");
//   };

//   return (
//     <div className="app">
//       <SummaryBar
//         subprograms={subprograms}
//         testResults={testResults}
//         projectPath={projectPath}
//         onAnalyze={analyze}
//         analyzing={analyzing}
//       />

//       {statusMsg && (
//         <div className="status-bar">
//           <i className="ti ti-info-circle" aria-hidden="true" /> {statusMsg}
//           <button className="status-close" onClick={() => setStatusMsg("")}>×</button>
//         </div>
//       )}

//       <div className="workspace">
//         <div className="left-col">
//           <FileExplorer
//             files={files}
//             activeFile={activeFile?.path}
//             onSelect={selectFile}
//           />
//           <SubprogramList
//             subprograms={subprograms}
//             activeSubp={activeSubp}
//             testResults={testResults}
//             onSelect={selectSubp}
//           />
//         </div>

//         <div className="center-col">
//           {view === "source"
//             ? <SourceViewer file={activeFile} />
//             : <TestPanel
//                 subp={activeSubp}
//                 testResults={testResults}
//                 onRunTest={runTest}
//               />
//           }
//         </div>

//         <div className="right-col">
//           <div className="panel-head">
//             <i className="ti ti-list" aria-hidden="true" /> all results
//           </div>
//           {testResults.length === 0 ? (
//             <div className="empty-state" style={{ padding: "1rem", fontSize: 12 }}>
//               no tests run yet
//             </div>
//           ) : (
//             testResults.slice().reverse().map((r, i) => (
//               <div
//                 key={r.id || i}
//                 className="result-item"
//                 onClick={() => {
//                   const s = subprograms.find(s => s.name === r.subprogram);
//                   if (s) selectSubp(s);
//                 }}
//                 style={{ cursor: "pointer" }}
//               >
//                 <StatusDot status={r.status} />
//                 <div>
//                   <div style={{ fontSize: 12, fontWeight: 500 }}>{r.subprogram}</div>
//                   <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
//                     {r.timestamp} · {r.status}
//                   </div>
//                 </div>
//               </div>
//             ))
//           )}
//         </div>
//       </div>
//     </div>
//   );
// }





import { useState, useEffect, useCallback, useRef } from "react";

// API base — uses relative path so React proxy (package.json) forwards to Flask.
// This avoids CORS issues entirely: browser talks to localhost:3000,
// proxy silently forwards to localhost:5050.
// If you ever serve frontend and backend on the same port, change to "/api".
const API = "/api";

// Safe JSON fetch — guards against HTML error pages being returned instead
// of JSON (which causes "Unexpected token '<'" in the browser console).
async function safeFetch(url, options) {
  const r = await fetch(url, options);
  const ct = r.headers.get("content-type") || "";
  if (!ct.includes("application/json")) {
    const text = await r.text();
    throw new Error(
      `Expected JSON from ${url} but got ${r.status} ${r.statusText}. ` +
      `Content-Type: ${ct}. ` +
      `First 120 chars: ${text.slice(0, 120)}`
    );
  }
  return r;
}

// ── helpers ────────────────────────────────────────────────────────────────

function typeDefault(type) {
  const tl = (type || "").toLowerCase();
  if (tl.includes("bool"))      return "False";
  if (tl.includes("float"))     return "0.0";
  if (tl.includes("character")) return "'A'";
  if (tl.includes("string"))    return '"Hello"';
  return "0";
}

function typeLabel(type) {
  const tl = (type || "").toLowerCase();
  if (tl.includes("uint16"))  return "0 .. 65535";
  if (tl.includes("uint32"))  return "0 .. 4294967295";
  if (tl.includes("natural")) return "0 .. 2147483647";
  if (tl.includes("integer")) return "-2147483648 .. 2147483647";
  if (tl.includes("float"))   return "float";
  if (tl.includes("bool"))    return "True | False";
  return "";
}

function caseBadge(type) {
  const t  = type || "";
  const tl = t.toLowerCase();
  if (t === t.toUpperCase() && t !== tl)
    return <span className="badge badge-caps">CAPS</span>;
  if (t === tl)
    return <span className="badge badge-lower">lower</span>;
  return <span className="badge badge-orig">orig</span>;
}

function StatusDot({ status }) {
  const color = { pass: "#1D9E75", fail: "#E24B4A", error: "#BA7517", none: "#B4B2A9" };
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: color[status] || color.none, flexShrink: 0,
    }} />
  );
}

// ── API calls ──────────────────────────────────────────────────────────────

// BUG FIX 1: apiGet and apiPost had no error handling — any network error
// or non-2xx response silently returned undefined, causing downstream
// "Cannot read properties of undefined" errors that swallowed the real issue.

async function apiGet(path) {
  try {
    const r = await safeFetch(API + path);
    if (!r.ok) {
      console.error(`[API] GET ${path} → ${r.status}`);
      return [];
    }
    return await r.json();
  } catch (e) {
    console.error(`[API] GET ${path} failed:`, e.message);
    return [];
  }
}

async function apiPost(path, body) {
  try {
    const r = await safeFetch(API + path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    if (!r.ok) console.error(`[API] POST ${path} → ${r.status}`, data);
    return data;
  } catch (e) {
    console.error(`[API] POST ${path} failed:`, e.message);
    return { error: e.message };
  }
}

// ── FileExplorer ───────────────────────────────────────────────────────────

function FileExplorer({ files, activeFile, onSelect }) {
  return (
    <div className="panel">
      <div className="panel-head">
        <i className="ti ti-folder" aria-hidden="true" /> files
        {files.length === 0 && (
          <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: 4 }}>
            — run analyze
          </span>
        )}
      </div>
      {files.map(f => (
        <div
          key={f.path}
          className={`sidebar-item ${activeFile === f.path ? "active" : ""}`}
          onClick={() => onSelect(f)}
        >
          <i className={`ti ${f.ext === ".ads" ? "ti-file-description" : "ti-file-code"}`}
             aria-hidden="true" />
          <span className="item-name">{f.name}</span>
          <span className="item-ext">{f.ext}</span>
        </div>
      ))}
    </div>
  );
}

// ── SubprogramList ─────────────────────────────────────────────────────────

function SubprogramList({ subprograms, activeSubp, testResults, onSelect }) {
  const statusOf = (name) => {
    const rs = testResults.filter(r => r.subprogram === name);
    if (!rs.length) return "none";
    if (rs.some(r => r.status === "fail" || r.status === "error")) return "fail";
    if (rs.every(r => r.status === "pass")) return "pass";
    return "none";
  };

  return (
    <div className="panel">
      <div className="panel-head">
        <i className="ti ti-function" aria-hidden="true" /> subprograms
        {subprograms.length === 0 && (
          <span style={{ fontSize: 10, color: "var(--color-text-secondary)", marginLeft: 4 }}>
            — run analyze
          </span>
        )}
      </div>
      {subprograms.map(s => (
        <div
          key={`${s.file}-${s.name}`}
          className={`sidebar-item ${activeSubp?.name === s.name && activeSubp?.file === s.file ? "active" : ""}`}
          onClick={() => onSelect(s)}
        >
          <StatusDot status={statusOf(s.name)} />
          <span className="item-name">{s.name}</span>
          {s.is_dead && <span className="badge badge-dead">dead</span>}
        </div>
      ))}
    </div>
  );
}

// ── Source viewer ──────────────────────────────────────────────────────────

function SourceViewer({ file }) {
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!file) return;
    setLoading(true);
    apiGet("/file?path=" + encodeURIComponent(file.path))
      .then(d => setSource(d.source || "-- (empty or unreadable)"))
      .finally(() => setLoading(false));
  }, [file?.path]);

  if (!file) return (
    <div className="empty-state">
      <i className="ti ti-file" aria-hidden="true" /> select a file to view source
    </div>
  );

  return (
    <div className="source-viewer">
      <div className="viewer-head">{file.name}</div>
      {loading
        ? <div className="empty-state">loading...</div>
        : <pre className="source-code">{source}</pre>
      }
    </div>
  );
}

// ── Test panel ─────────────────────────────────────────────────────────────

// BUG FIX 2: The tab switching (inputs / variables / history) was purely visual —
// clicking a tab added the "active" class but never showed/hid the tab panels
// because there was no state driving visibility. Added activeTab state.

function TestPanel({ subp, testResults, onRunTest }) {
  const [inputs,      setInputs]      = useState({});
  const [expected,    setExpected]    = useState({});
  const [running,     setRunning]     = useState(false);
  const [lastResult,  setLastResult]  = useState(null);
  const [activeTab,   setActiveTab]   = useState("inputs");

  // BUG FIX 3: inputs state was never reset when switching between subprograms.
  // If you clicked Check_Pixel then Update_Grid, the old Check_Pixel input values
  // remained visible/active. Now reset on every subp change.
  useEffect(() => {
    if (!subp) return;
    const init = {};
    subp.params
      .filter(p => p.dir === "in" || p.dir === "in out")
      .forEach(p => { init[p.name] = typeDefault(p.type); });
    setInputs(init);

    const exp = {};
    subp.params
      .filter(p => p.dir === "out" || p.dir === "in out")
      .forEach(p => { exp[p.name] = typeDefault(p.type); });
    setExpected(exp);

    setLastResult(null);
    setActiveTab("inputs");
  }, [subp?.name, subp?.file]);   // include file — same name in different files

  const setInput  = (k, v) => setInputs(i  => ({ ...i, [k]: v }));
  const setExpect = (k, v) => setExpected(e => ({ ...e, [k]: v }));

  const autoGen = () => {
    if (!subp) return;
    const next = {};
    subp.params
      .filter(p => p.dir === "in" || p.dir === "in out")
      .forEach(p => {
        const c = p.constraint || {};
        if (c.kind === "integer")
          next[p.name] = String(Math.floor(Math.random() * Math.min(c.max, 255)));
        else if (c.kind === "float")
          next[p.name] = (Math.random() * 10).toFixed(2);
        else if (c.kind === "boolean")
          next[p.name] = Math.random() > 0.5 ? "True" : "False";
        else
          next[p.name] = typeDefault(p.type);
      });
    setInputs(next);
  };

  const runTest = async () => {
    setRunning(true);
    const result = await onRunTest(subp.name, inputs, expected);
    setLastResult(result);
    setRunning(false);
  };

  if (!subp) return (
    <div className="empty-state">
      <i className="ti ti-function" aria-hidden="true" /> select a subprogram to test
    </div>
  );

  // BUG FIX 4: param direction filter was wrong.
  // `p.dir.includes("in")` matched BOTH "in" and "in out" correctly,
  // but also matched "out" that had "in" elsewhere if data was dirty.
  // Use exact string comparison instead.
  const inParams  = subp.params.filter(p => p.dir === "in" || p.dir === "in out");
  const outParams = subp.params.filter(p => p.dir === "out" || p.dir === "in out");
  const prevResults = testResults.filter(r => r.subprogram === subp.name);

  return (
    <div className="test-panel">
      <div className="test-head">
        <span className="test-title">{subp.name}</span>
        <div className="test-meta">
          <span>{subp.file_name}</span>
          {subp.start_line && <span>· lines {subp.start_line}–{subp.end_line}</span>}
          {subp.complexity  && <span>· complexity {subp.complexity}</span>}
          {subp.is_dead && <span className="badge badge-dead">dead code</span>}
        </div>
      </div>

      {/* BUG FIX 2 cont: tabs now control activeTab state */}
      <div className="section-tabs">
        {["inputs", "variables", "history"].map(tab => (
          <span
            key={tab}
            className={`stab ${activeTab === tab ? "active" : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
            {tab === "history" && prevResults.length > 0 &&
              <span style={{ marginLeft: 4, fontSize: 10, opacity: 0.7 }}>
                ({prevResults.length})
              </span>
            }
          </span>
        ))}
      </div>

      {/* ── INPUTS TAB ── */}
      {activeTab === "inputs" && (
        <div className="input-section">
          {inParams.length === 0 ? (
            <div className="empty-state" style={{ padding: "1rem 0" }}>
              no in parameters for this subprogram
            </div>
          ) : (
            <>
              <div className="section-label">in parameters — set test values</div>
              <div className="input-grid">
                {inParams.map(p => (
                  <div key={p.name} className="input-card">
                    <div className="input-header">
                      <span className="input-dir">{p.dir}</span>
                      <span className="input-name">{p.name}</span>
                    </div>
                    <div className="input-type mono">
                      {p.type} {caseBadge(p.type)}
                    </div>
                    {typeLabel(p.type) && (
                      <div className="input-range">{typeLabel(p.type)}</div>
                    )}
                    {p.constraint?.kind === "boolean" ? (
                      <select
                        className="input-field"
                        value={inputs[p.name] ?? "False"}
                        onChange={e => setInput(p.name, e.target.value)}
                      >
                        <option>False</option>
                        <option>True</option>
                      </select>
                    ) : (
                      <input
                        className="input-field"
                        type={p.constraint?.kind === "integer" ? "number" : "text"}
                        value={inputs[p.name] ?? typeDefault(p.type)}
                        onChange={e => setInput(p.name, e.target.value)}
                        min={p.constraint?.min}
                        max={p.constraint?.max}
                      />
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {outParams.length > 0 && (
            <>
              <div className="section-label">expected output values</div>
              <div className="input-grid">
                {outParams.map(p => (
                  <div key={p.name} className="input-card input-card-out">
                    <div className="input-header">
                      <span className="input-dir out">out</span>
                      <span className="input-name">{p.name}</span>
                    </div>
                    <div className="input-type mono">{p.type} {caseBadge(p.type)}</div>
                    {typeLabel(p.type) && (
                      <div className="input-range">{typeLabel(p.type)}</div>
                    )}
                    <input
                      className="input-field"
                      type="text"
                      value={expected[p.name] ?? typeDefault(p.type)}
                      onChange={e => setExpect(p.name, e.target.value)}
                      placeholder="expected value"
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="btn-row">
            <button className="btn btn-primary" onClick={runTest} disabled={running}>
              <i className="ti ti-player-play" aria-hidden="true" />
              {running ? "running..." : "run test"}
            </button>
            <button className="btn" onClick={autoGen}>
              <i className="ti ti-wand" aria-hidden="true" /> auto-fill
            </button>
            <button className="btn" onClick={() => {
              const blob = new Blob([JSON.stringify(inputs, null, 2)],
                { type: "application/json" });
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `${subp.name}_inputs.json`;
              a.click();
            }}>
              <i className="ti ti-download" aria-hidden="true" /> export inputs
            </button>
          </div>

          {lastResult && (
            <div className={`result-box result-${lastResult.status}`}>
              <div className="result-header">
                <i className={`ti ${lastResult.status === "pass"
                  ? "ti-circle-check" : "ti-circle-x"}`}
                  aria-hidden="true" />
                <span>{lastResult.message}</span>
                <span className="result-time">{lastResult.elapsed_ms}ms</span>
              </div>
              {lastResult.violations?.length > 0 && (
                <ul className="violation-list">
                  {lastResult.violations.map((v, i) => (
                    <li key={i} className="mono">
                      {v.variable} ({v.type}): {v.error}
                    </li>
                  ))}
                </ul>
              )}
              {Object.keys(lastResult.actual || {}).length > 0 && (
                <div className="result-table mono">
                  {Object.entries(lastResult.actual).map(([k, v]) => (
                    <div key={k} className="result-row">
                      <span>{k}</span>
                      <span className="result-expected">expected: {expected[k]}</span>
                      <span className={`result-actual ${v === expected[k] ? "ok" : "bad"}`}>
                        actual: {v}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="result-types mono">
                normalized types: {JSON.stringify(lastResult.normalized_types || {})}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VARIABLES TAB ── */}
      {activeTab === "variables" && (
        <div className="input-section">
          <div className="section-label">
            all variables — declared type vs normalized (case-insensitive check)
          </div>
          {subp.variables.length === 0 ? (
            <div className="empty-state" style={{ padding: "1rem 0" }}>
              no variables extracted
            </div>
          ) : (
            <table className="vars-table">
              <thead>
                <tr>
                  <th>name</th>
                  <th>declared type</th>
                  <th>normalized (.lower)</th>
                  <th>scope</th>
                  <th>constraint</th>
                </tr>
              </thead>
              <tbody>
                {subp.variables.map((v, i) => (
                  <tr key={i}>
                    <td className="mono">{v.name}</td>
                    <td className="mono">
                      {v.type} {caseBadge(v.type)}
                    </td>
                    <td className="mono" style={{ color: "var(--color-text-success)" }}>
                      {v.type_normalized}
                    </td>
                    <td>
                      <span className={`scope-pill scope-${v.scope}`}>{v.scope}</span>
                    </td>
                    <td className="mono" style={{ fontSize: 11 }}>
                      {v.constraint?.kind === "integer"
                        ? `${v.constraint.min} .. ${v.constraint.max}`
                        : v.constraint?.kind || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── HISTORY TAB ── */}
      {activeTab === "history" && (
        <div className="input-section">
          <div className="section-label">test run history for {subp.name}</div>
          {prevResults.length === 0 ? (
            <div className="empty-state" style={{ padding: "1rem 0" }}>
              no tests run yet — switch to inputs tab
            </div>
          ) : (
            prevResults.slice().reverse().map(r => (
              <div key={r.id} className={`history-row result-${r.status}`}>
                <StatusDot status={r.status} />
                <span className="mono" style={{ fontSize: 11, minWidth: 60 }}>{r.id}</span>
                <span style={{ fontSize: 11, minWidth: 70 }}>{r.timestamp}</span>
                <span style={{ fontSize: 11, fontWeight: 500 }}>{r.status}</span>
                <span className="mono" style={{ fontSize: 10, color: "var(--color-text-secondary)", flex: 1 }}>
                  {JSON.stringify(r.inputs)}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Top summary bar ────────────────────────────────────────────────────────

// BUG FIX 5: SummaryBar held its own local `path` state initialised from
// `projectPath` prop — but projectPath started as "" so the input was always
// blank. The user typed a path, clicked analyze, but the parent's `analyze()`
// received the prop value ("") not the typed value because the local state
// was disconnected from the parent. Fixed with a ref so the input value is
// always read directly at click time.

function SummaryBar({ subprograms, testResults, projectPath, onAnalyze, analyzing }) {
  const pathRef = useRef(null);
  const passed  = testResults.filter(r => r.status === "pass").length;
  const failed  = testResults.filter(r => r.status === "fail" || r.status === "error").length;
  const pending = Math.max(0,
    subprograms.length - new Set(testResults.map(r => r.subprogram)).size
  );

  return (
    <div className="topbar">
      <div className="topbar-left">
        <i className="ti ti-test-pipe" style={{ fontSize: 18 }} aria-hidden="true" />
        <span className="app-title">Ada test studio</span>
        <div className="path-input-group">
          <input
            ref={pathRef}
            className="path-input"
            defaultValue={projectPath}
            placeholder="/path/to/ada/project"
            onKeyDown={e => { if (e.key === "Enter") onAnalyze(pathRef.current.value.trim()); }}
          />
          <button
            className="btn btn-primary"
            disabled={analyzing}
            onClick={() => onAnalyze(pathRef.current.value.trim())}
          >
            <i className={`ti ${analyzing ? "ti-loader-2" : "ti-refresh"}`} aria-hidden="true" />
            {analyzing ? "analyzing..." : "analyze"}
          </button>
        </div>
      </div>
      <div className="topbar-right">
        <span className="stat-pill pass">{passed} passed</span>
        <span className="stat-pill fail">{failed} failed</span>
        <span className="stat-pill pend">{pending} pending</span>
      </div>
    </div>
  );
}

// ── Root App ───────────────────────────────────────────────────────────────

export default function App() {
  const [files,        setFiles]       = useState([]);
  const [subprograms,  setSubprograms] = useState([]);
  const [testResults,  setTestResults] = useState([]);
  const [activeFile,   setActiveFile]  = useState(null);
  const [activeSubp,   setActiveSubp]  = useState(null);
  const [projectPath,  setProjectPath] = useState("");
  const [view,         setView]        = useState("test");
  const [analyzing,    setAnalyzing]   = useState(false);
  const [statusMsg,    setStatusMsg]   = useState("");

  const refresh = useCallback(async () => {
    const [f, s, r] = await Promise.all([
      apiGet("/files"),
      apiGet("/subprograms"),
      apiGet("/test/results"),
    ]);
    // Guard: API can return {} on error — only set state if arrays
    if (Array.isArray(f)) setFiles(f);
    if (Array.isArray(s)) setSubprograms(s);
    if (Array.isArray(r)) setTestResults(r);
  }, []);

  // On mount: check if backend already has data (e.g. started with --path)
  useEffect(() => { refresh(); }, [refresh]);

  const analyze = async (path) => {
    if (!path) {
      setStatusMsg("⚠ enter a project path first");
      return;
    }
    setAnalyzing(true);
    setStatusMsg("analyzing...");
    setActiveFile(null);
    setActiveSubp(null);

    const result = await apiPost("/analyze", { path });

    if (result.error) {
      setStatusMsg(`error: ${result.error}`);
    } else {
      setProjectPath(path);
      setStatusMsg(
        `found ${result.file_count} file(s), ${result.subprogram_count} subprogram(s)`
      );
      // Re-fetch everything so the UI reflects the new analysis
      await refresh();
    }
    setAnalyzing(false);
  };

  const runTest = async (subpName, inputs, expected) => {
    const result = await apiPost("/test/run", { subprogram: subpName, inputs, expected });
    setTestResults(prev => [
      ...prev,
      {
        ...result,
        subprogram: subpName,
        timestamp:  new Date().toLocaleTimeString(),
        inputs,
        expected,
      },
    ]);
    return result;
  };

  const selectFile = (file) => {
    setActiveFile(file);
    const first = subprograms.find(s => s.file === file.path);
    if (first) setActiveSubp(first);
    setView("source");
  };

  const selectSubp = (s) => {
    setActiveSubp(s);
    const f = files.find(f => f.path === s.file);
    if (f) setActiveFile(f);
    setView("test");
  };

  return (
    <div className="app">
      <SummaryBar
        subprograms={subprograms}
        testResults={testResults}
        projectPath={projectPath}
        onAnalyze={analyze}
        analyzing={analyzing}
      />

      {statusMsg && (
        <div className="status-bar">
          <i className="ti ti-info-circle" aria-hidden="true" /> {statusMsg}
          <button className="status-close" onClick={() => setStatusMsg("")}>×</button>
        </div>
      )}

      <div className="workspace">
        <div className="left-col">
          <FileExplorer
            files={files}
            activeFile={activeFile?.path}
            onSelect={selectFile}
          />
          <SubprogramList
            subprograms={subprograms}
            activeSubp={activeSubp}
            testResults={testResults}
            onSelect={selectSubp}
          />
        </div>

        <div className="center-col">
          {view === "source"
            ? <SourceViewer file={activeFile} />
            : <TestPanel
                subp={activeSubp}
                testResults={testResults}
                onRunTest={runTest}
              />
          }
        </div>

        <div className="right-col">
          <div className="panel-head">
            <i className="ti ti-list" aria-hidden="true" /> all results
          </div>
          {testResults.length === 0 ? (
            <div className="empty-state" style={{ padding: "1rem", fontSize: 12 }}>
              no tests run yet
            </div>
          ) : (
            testResults.slice().reverse().map((r, i) => (
              <div
                key={r.id || i}
                className="result-item"
                onClick={() => {
                  const s = subprograms.find(s => s.name === r.subprogram);
                  if (s) selectSubp(s);
                }}
                style={{ cursor: "pointer" }}
              >
                <StatusDot status={r.status} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{r.subprogram}</div>
                  <div style={{ fontSize: 11, color: "var(--color-text-secondary)" }}>
                    {r.timestamp} · {r.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}