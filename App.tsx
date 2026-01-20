
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { 
  FileText, 
  Briefcase, 
  Sparkles, 
  Loader2, 
  ChevronRight,
  ShieldCheck,
  Zap,
  XCircle,
  UploadCloud,
  Linkedin,
  Search,
  Mail,
  Target,
  History,
  Save,
  Trash2,
  Clock,
  Link2,
  ExternalLink,
  Key,
  AlertCircle
} from 'lucide-react';
import { analyzeJobMatch } from './services/geminiService';
import { AnalysisResult, LoadingStatus, SavedResume, SavedJob } from './types';
import AnalysisDashboard from './components/AnalysisDashboard';

// PDF Extraction Utility
const getPdfText = async (data: ArrayBuffer): Promise<string> => {
  const pdfjsLib = await import('https://esm.sh/pdfjs-dist@4.10.38/build/pdf.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.10.38/build/pdf.worker.mjs';
  
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  let fullText = "";
  
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item: any) => item.str)
      .join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
};

// DOCX Extraction Utility
const getDocxText = async (data: ArrayBuffer): Promise<string> => {
  const mammoth = await import('https://esm.sh/mammoth@1.8.0');
  const result = await mammoth.extractRawText({ arrayBuffer: data });
  return result.value;
};

const LOADING_MESSAGES = [
  "Analyzing core competencies...",
  "Mapping experience to job requirements...",
  "Identifying key skill matches...",
  "Spotting critical experience gaps...",
  "Researching company product culture...",
  "Drafting your personalized pitch...",
  "Finalizing match score..."
];

const RESUME_STORAGE_KEY = 'pm_match_resumes';
const JOB_STORAGE_KEY = 'pm_match_jobs';

const App: React.FC = () => {
  const [resume, setResume] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [jobUrl, setJobUrl] = useState('');
  const [status, setStatus] = useState<LoadingStatus>(LoadingStatus.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsgIdx, setLoadingMsgIdx] = useState(0);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(true);
  
  // History State
  const [savedResumes, setSavedResumes] = useState<SavedResume[]>([]);
  const [savedJobs, setSavedJobs] = useState<SavedJob[]>([]);
  const [showResumeHistory, setShowResumeHistory] = useState(false);
  const [showJobHistory, setShowJobHistory] = useState(false);
  const [newResumeName, setNewResumeName] = useState('');

  // Refs
  const resumeInputRef = useRef<HTMLInputElement>(null);
  const jobInputRef = useRef<HTMLInputElement>(null);

  // Load history and check API key on mount
  useEffect(() => {
    const checkApiKey = async () => {
      if (window.aistudio?.hasSelectedApiKey) {
        const selected = await window.aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      }
    };
    checkApiKey();

    const storedResumes = localStorage.getItem(RESUME_STORAGE_KEY);
    if (storedResumes) {
      try { setSavedResumes(JSON.parse(storedResumes)); } catch (e) { console.error(e); }
    }
    const storedJobs = localStorage.getItem(JOB_STORAGE_KEY);
    if (storedJobs) {
      try { setSavedJobs(JSON.parse(storedJobs)); } catch (e) { console.error(e); }
    }
  }, []);

  // Cycle loading messages
  useEffect(() => {
    let interval: number;
    if (status === LoadingStatus.LOADING) {
      interval = window.setInterval(() => {
        setLoadingMsgIdx((prev) => (prev + 1) % LOADING_MESSAGES.length);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [status]);

  const handleOpenKeyDialog = async () => {
    if (window.aistudio?.openSelectKey) {
      await window.aistudio.openSelectKey();
      setHasApiKey(true); // Assume success per race condition rule
    }
  };

  const saveResumeToHistory = () => {
    if (!resume.trim()) return;
    const title = newResumeName.trim() || "My Resume";
    
    const newEntry: SavedResume = {
      id: crypto.randomUUID(),
      name: title,
      content: resume,
      timestamp: Date.now()
    };

    const updated = [newEntry, ...savedResumes];
    setSavedResumes(updated);
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(updated));
    setNewResumeName('');
  };

  const saveJobToHistory = (companyName: string) => {
    if (!jobDescription.trim() && !jobUrl.trim()) return;
    
    // Check if duplicate company recently
    const isDuplicate = savedJobs.some(j => 
      j.name.toLowerCase() === companyName.toLowerCase() && 
      (Date.now() - j.timestamp < 1000 * 60 * 5) // within 5 mins
    );
    if (isDuplicate) return;

    const newEntry: SavedJob = {
      id: crypto.randomUUID(),
      name: companyName,
      content: jobDescription,
      url: jobUrl,
      timestamp: Date.now()
    };

    const updated = [newEntry, ...savedJobs];
    setSavedJobs(updated);
    localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteResume = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedResumes.filter(r => r.id !== id);
    setSavedResumes(updated);
    localStorage.setItem(RESUME_STORAGE_KEY, JSON.stringify(updated));
  };

  const deleteJob = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = savedJobs.filter(j => j.id !== id);
    setSavedJobs(updated);
    localStorage.setItem(JOB_STORAGE_KEY, JSON.stringify(updated));
  };

  const selectResume = (r: SavedResume) => {
    setResume(r.content);
    setShowResumeHistory(false);
  };

  const selectJob = (j: SavedJob) => {
    setJobDescription(j.content);
    setJobUrl(j.url);
    setShowJobHistory(false);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>, target: 'resume' | 'job') => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setError(null);

    const fileType = file.type;
    const fileName = file.name.toLowerCase();

    try {
      if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const extractedText = await getPdfText(buffer);
        if (target === 'resume') setResume(extractedText);
        else setJobDescription(extractedText);
      } 
      else if (fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
        const buffer = await file.arrayBuffer();
        const extractedText = await getDocxText(buffer);
        if (target === 'resume') setResume(extractedText);
        else setJobDescription(extractedText);
      }
      else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          if (target === 'resume') setResume(content);
          else setJobDescription(content);
          setIsProcessingFile(false);
        };
        reader.onerror = () => {
          setError("Failed to read text file.");
          setIsProcessingFile(false);
        };
        reader.readAsText(file);
        return;
      }
      setIsProcessingFile(false);
    } catch (err) {
      console.error("File processing error:", err);
      setError(`Could not extract text from ${fileName.split('.').pop()?.toUpperCase()}.`);
      setIsProcessingFile(false);
    }
    event.target.value = '';
  };

  const handleAnalyze = async () => {
    if (!resume.trim()) { setError("Please provide your resume content."); return; }
    if (!jobDescription.trim() && !jobUrl.trim()) { setError("Please provide a job description or a public URL."); return; }

    setStatus(LoadingStatus.LOADING);
    setError(null);

    try {
      const data = await analyzeJobMatch(resume, jobDescription, jobUrl);
      saveJobToHistory(data.companyName);
      setResult(data);
      setStatus(LoadingStatus.SUCCESS);
    } catch (err: any) {
      console.error("Analysis error:", err);
      console.error("Error message:", err.message);
      console.error("Error stack:", err.stack);
      
      // Handle the "Requested entity was not found" error specifically for tool usage
      if (err.message?.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("Your project configuration requires a paid API key for search features. Please select one.");
        await handleOpenKeyDialog();
      } else {
        // Show the actual error message for debugging
        const errorMsg = err.message || err.toString() || "Unknown error";
        setError(`Analysis failed: ${errorMsg}. Please check the console for more details.`);
      }
      setStatus(LoadingStatus.ERROR);
    }
  };

  const handleReset = useCallback(() => {
    setStatus(LoadingStatus.IDLE);
    setResult(null);
    setError(null);
  }, []);

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 selection:bg-blue-500/30">
      <input type="file" ref={resumeInputRef} className="hidden" accept=".txt,.md,.pdf,.doc,.docx" onChange={(e) => handleFileUpload(e, 'resume')} />
      <input type="file" ref={jobInputRef} className="hidden" accept=".txt,.md,.pdf,.doc,.docx" onChange={(e) => handleFileUpload(e, 'job')} />

      {/* Floating API Key Status if missing */}
      {!hasApiKey && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-4 duration-500">
          <button 
            onClick={handleOpenKeyDialog}
            className="flex items-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-full shadow-2xl shadow-indigo-500/20 text-sm font-bold transition-all hover:scale-105"
          >
            <Key size={18} />
            Setup Paid API Key for Search Features
          </button>
        </div>
      )}

      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/5 blur-[120px] rounded-full" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-indigo-600/5 blur-[120px] rounded-full" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 py-6 md:py-8">
        <header className="text-center mb-6">
          <h1 className="text-4xl md:text-6xl font-black mb-2 tracking-tighter">
            PM <span className="bg-gradient-to-br from-blue-400 via-indigo-400 to-violet-500 bg-clip-text text-transparent italic">Match</span>
          </h1>
          <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto font-medium opacity-70">
            Benchmark your experience against any role and generate a high-conversion pitch.
          </p>
        </header>

        <main>
          {status === LoadingStatus.SUCCESS && result ? (
            <AnalysisDashboard result={result} onReset={handleReset} />
          ) : (
            <div className="space-y-8 max-w-5xl mx-auto">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start pt-2">
                {/* Resume Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-widest">
                        <FileText size={18} className="text-blue-500" />
                        Resume
                      </label>
                      <button 
                        onClick={() => setShowResumeHistory(!showResumeHistory)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-bold transition-all ${
                          showResumeHistory ? 'bg-blue-500/20 border-blue-500 text-blue-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        <History size={14} />
                        History {savedResumes.length > 0 && <span className="opacity-60">({savedResumes.length})</span>}
                      </button>
                    </div>
                    <button onClick={() => resumeInputRef.current?.click()} className="text-xs font-bold uppercase tracking-widest text-blue-400 flex items-center gap-1.5 hover:text-blue-300 transition-colors">
                      <UploadCloud size={16} /> Upload
                    </button>
                  </div>

                  {showResumeHistory && (
                    <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 overflow-hidden">
                      <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                        {savedResumes.length === 0 ? <p className="text-sm text-slate-600 italic p-3 text-center">No history yet</p> : savedResumes.map(r => (
                          <div key={r.id} onClick={() => selectResume(r)} className="group flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-blue-500/30 cursor-pointer transition-all">
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-slate-300">{r.name}</span>
                              <span className="text-[10px] text-slate-600">{formatDate(r.timestamp)}</span>
                            </div>
                            <button onClick={(e) => deleteResume(r.id, e)} className="p-1.5 rounded-md text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="relative group">
                    <textarea value={resume} onChange={(e) => setResume(e.target.value)} placeholder="Paste your resume or upload a file..." className="w-full h-[240px] bg-slate-900/40 border border-slate-800 focus:border-blue-500/50 rounded-xl p-5 text-slate-200 text-base leading-relaxed outline-none transition-all" />
                    {isProcessingFile && <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm rounded-xl flex items-center justify-center"><Loader2 className="animate-spin text-blue-500" size={36} /></div>}
                  </div>

                  {resume.trim() && !isProcessingFile && (
                    <div className="flex gap-2 animate-in fade-in duration-300">
                      <input type="text" placeholder="Resume Title..." value={newResumeName} onChange={(e) => setNewResumeName(e.target.value)} className="flex-1 bg-slate-900/40 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-300 outline-none focus:border-blue-500/30" />
                      <button onClick={saveResumeToHistory} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-bold hover:bg-blue-500/20 transition-all"><Save size={16} /> Save</button>
                    </div>
                  )}
                </div>

                {/* Job Section */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-widest pl-1">
                        <Link2 size={16} className="text-indigo-400" /> Job URL
                      </label>
                      <button 
                        onClick={() => setShowJobHistory(!showJobHistory)}
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-full border text-xs font-bold transition-all ${
                          showJobHistory ? 'bg-indigo-500/20 border-indigo-500 text-indigo-300' : 'bg-slate-900 border-slate-800 text-slate-500'
                        }`}
                      >
                        <History size={14} />
                        Jobs {savedJobs.length > 0 && <span className="opacity-60">({savedJobs.length})</span>}
                      </button>
                    </div>

                    {showJobHistory && (
                      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-3 animate-in fade-in slide-in-from-top-2 overflow-hidden mb-3">
                        <div className="max-h-40 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                          {savedJobs.length === 0 ? <p className="text-sm text-slate-600 italic p-3 text-center">No history yet</p> : savedJobs.map(j => (
                            <div key={j.id} onClick={() => selectJob(j)} className="group flex items-center justify-between p-3 rounded-lg bg-slate-950/40 border border-slate-800 hover:border-indigo-500/30 cursor-pointer transition-all">
                              <div className="flex flex-col gap-0.5 max-w-[80%]">
                                <span className="text-sm font-semibold text-slate-300 truncate">{j.name}</span>
                                <span className="text-[10px] text-slate-600">{formatDate(j.timestamp)}</span>
                              </div>
                              <button onClick={(e) => deleteJob(j.id, e)} className="p-1.5 rounded-md text-slate-600 hover:text-red-400 transition-colors"><Trash2 size={16} /></button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="relative">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600"><Search size={18} /></div>
                      <input type="text" value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} placeholder="Job Link (ensure this is a public url)" className="w-full bg-slate-900/40 border border-slate-800 rounded-lg py-3 pl-12 pr-4 text-base text-slate-200 outline-none focus:border-indigo-500/50 transition-all" />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <label className="flex items-center gap-2 text-sm font-bold text-slate-400 uppercase tracking-widest">
                        <Briefcase size={18} className="text-indigo-400" /> Description
                      </label>
                      <button onClick={() => jobInputRef.current?.click()} className="text-xs font-bold uppercase tracking-widest text-indigo-400 flex items-center gap-1 hover:text-indigo-300 transition-colors">
                        <UploadCloud size={16} /> Upload JD
                      </button>
                    </div>
                    <div className="relative group">
                      <textarea value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} placeholder="Paste job description..." className="w-full h-[160px] bg-slate-900/40 border border-slate-800 rounded-xl p-5 text-base leading-relaxed outline-none focus:border-indigo-500/50 transition-all" />
                      {isProcessingFile && <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm rounded-xl flex items-center justify-center"><Loader2 className="animate-spin text-indigo-500" size={32} /></div>}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4 pt-2">
                {error && <div className="px-6 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-3 animate-in shake duration-500"><AlertCircle size={18} /> {error}</div>}
                
                <button 
                  onClick={handleAnalyze} 
                  disabled={status === LoadingStatus.LOADING || isProcessingFile} 
                  className="group relative px-12 py-5 bg-white text-slate-950 font-black rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all flex flex-col items-center gap-1 shadow-[0_20px_50px_rgba(59,130,246,0.25)] disabled:opacity-50 disabled:scale-100 overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-blue-500/0 via-blue-500/5 to-blue-500/0 opacity-0 group-hover:opacity-100 -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out" />
                  {status === LoadingStatus.LOADING ? (
                    <div className="flex items-center gap-3">
                      <Loader2 className="animate-spin" size={20} />
                      <span className="text-base font-bold uppercase tracking-wide">{LOADING_MESSAGES[loadingMsgIdx]}</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <span className="text-xl uppercase tracking-wider">Analyze Fit & Generate Pitch</span>
                      <ChevronRight size={24} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  )}
                </button>
              </div>

              {/* Value Prop Section */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl mx-auto py-8 border-y border-slate-900/50">
                <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 mb-2 border border-blue-500/20">
                    <Target size={20} />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-1 text-slate-200">Deep Benchmark</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[160px]">Scoring based on core PM competencies.</p>
                </div>
                <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300 delay-75">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mb-2 border border-indigo-500/20">
                    <Zap size={20} />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-1 text-slate-200">3-Bullet Takeaway</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[160px]">The most critical alignment points.</p>
                </div>
                <div className="flex flex-col items-center text-center animate-in fade-in slide-in-from-bottom-2 duration-300 delay-150">
                  <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 mb-2 border border-violet-500/20">
                    <Mail size={20} />
                  </div>
                  <h4 className="text-xs font-bold uppercase tracking-widest mb-1 text-slate-200">Hiring Manager Pitch</h4>
                  <p className="text-xs text-slate-500 leading-relaxed max-w-[160px]">High-conversion response strategy.</p>
                </div>
              </div>
            </div>
          )}
        </main>

        <footer className="mt-12 pt-8 border-t border-slate-900 flex flex-col items-center gap-4">
          <div className="flex items-center gap-4 grayscale opacity-30 hover:grayscale-0 hover:opacity-100 transition-all cursor-default">
            <span className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Powered by</span>
            <div className="h-4 w-[1px] bg-slate-800" />
            <span className="text-sm font-bold text-slate-300 tracking-tighter">Google Gemini 3</span>
          </div>
          <p className="text-slate-800 text-[10px] uppercase font-bold tracking-widest">© {new Date().getFullYear()} PM Match AI Systems</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
