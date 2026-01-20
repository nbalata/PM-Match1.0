
import React, { useState } from 'react';
import { AnalysisResult } from '../types';
import ScoreChart from './ScoreChart';
import { 
  CheckCircle2, 
  Target, 
  Lightbulb, 
  ExternalLink, 
  Mail, 
  Copy, 
  Check,
  ChevronLeft,
  ArrowRight,
  ShieldCheck,
  XCircle,
  PlusCircle,
  RotateCcw,
  Building2,
  Zap
} from 'lucide-react';

interface AnalysisDashboardProps {
  result: AnalysisResult;
  onReset: () => void;
}

const AnalysisDashboard: React.FC<AnalysisDashboardProps> = ({ result, onReset }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyEmail = () => {
    navigator.clipboard.writeText(result.sampleEmail);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-20">
      {/* Top Nav */}
      <div className="flex items-center justify-between">
        <button 
          onClick={onReset}
          className="group flex items-center gap-2 text-sm font-bold text-slate-500 hover:text-white uppercase tracking-widest transition-colors"
        >
          <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
          Back to inputs
        </button>
      </div>

      <div className="space-y-12">
        {/* Company Header */}
        <div className="text-center space-y-3">
          <div className="flex items-center justify-center gap-3 text-blue-400">
            <Building2 size={24} />
            <h2 className="text-4xl md:text-6xl font-black tracking-tight uppercase">
              {result.companyName}
            </h2>
          </div>
          <p className="text-slate-500 font-bold uppercase tracking-[0.2em] text-xs">Strategic Analysis Complete</p>
        </div>

        {/* Match Score Area */}
        <div className="w-full">
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-3xl p-10 backdrop-blur-xl relative overflow-hidden flex flex-col items-center">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full -mr-32 -mt-32" />
            <div className="flex items-center gap-3 mb-8 text-indigo-400">
              <Target size={20} />
              <h3 className="font-bold uppercase tracking-[0.15em] text-xs">Overall Competency Fit</h3>
            </div>
            <ScoreChart score={result.score} />
            <div className="mt-8 pt-6 border-t border-slate-800/50 flex items-center justify-between w-full max-w-sm">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">Analysis Confidence</span>
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">Verified by Gemini 3</span>
            </div>
          </div>
        </div>

        {/* Quick Take Bullets */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-1 text-yellow-500">
            <Lightbulb size={22} />
            <h3 className="font-bold uppercase tracking-[0.15em] text-sm">Strategic Context</h3>
          </div>
          <div className="flex flex-col gap-4">
            {result.quickTake.map((item, i) => (
              <div key={i} className="group relative bg-slate-900/30 border border-slate-800/50 hover:border-yellow-500/30 rounded-2xl p-5 backdrop-blur-sm transition-all flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-yellow-500/10 flex items-center justify-center text-yellow-500 text-xs font-black flex-shrink-0 group-hover:scale-110 transition-transform">
                  0{i+1}
                </div>
                <p className="text-base font-medium text-slate-200 leading-relaxed pt-1">{item}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Strengths & Gaps Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Matches */}
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 text-emerald-400">
              <ShieldCheck size={20} />
              <h3 className="font-bold uppercase tracking-[0.15em] text-xs">Key Matches</h3>
            </div>
            <ul className="space-y-4">
              {result.strengths.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed group">
                  <CheckCircle2 size={16} className="text-emerald-500 mt-0.5 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          {/* Gaps */}
          <div className="bg-slate-900/30 border border-slate-800/50 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-6 text-orange-400">
              <XCircle size={20} />
              <h3 className="font-bold uppercase tracking-[0.15em] text-xs">Critical Gaps</h3>
            </div>
            <ul className="space-y-4">
              {result.missingSkills.map((s, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300 leading-relaxed group">
                  <Target size={16} className="text-orange-500 mt-0.5 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* HM Outreach Section */}
        <div className="space-y-6 pt-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-3 text-blue-400">
              <Mail size={22} />
              <h3 className="font-bold uppercase tracking-[0.15em] text-sm">Hiring Manager Pitch</h3>
            </div>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest border border-slate-800 rounded-full px-3 py-1 bg-slate-900/40">Professional Outreach</span>
          </div>
          
          <div className="bg-blue-600/5 border border-blue-500/20 rounded-3xl overflow-hidden shadow-2xl transition-all hover:shadow-blue-500/10">
            {/* Header / Toolbar */}
            <div className="bg-slate-900/50 px-8 py-4 flex items-center justify-between border-b border-blue-500/10">
              <div className="flex gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-red-500/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/30" />
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/30" />
              </div>
              <button 
                onClick={handleCopyEmail}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex-shrink-0"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy Email'}
              </button>
            </div>

            {/* Content Area */}
            <div className="p-10 bg-slate-950/40">
              <div className="max-w-prose mx-auto">
                <div className="flex items-center gap-2 mb-8 text-blue-400/60 border-b border-blue-500/10 pb-4">
                  <Zap size={14} className="fill-blue-400/20" />
                  <span className="text-[10px] font-black uppercase tracking-widest">High-Conversion Structure</span>
                </div>
                <pre className="whitespace-pre-wrap font-sans text-base text-slate-200 leading-relaxed">
                  {result.sampleEmail}
                </pre>
              </div>
            </div>
          </div>
        </div>

        {/* Sources - if any */}
        {result.groundingSources && result.groundingSources.length > 0 && (
          <div className="space-y-4 pt-4">
             <div className="flex items-center gap-2 px-1 text-slate-500">
              <ExternalLink size={16} />
              <h3 className="font-bold uppercase tracking-[0.15em] text-[10px]">Reference Sources</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {result.groundingSources.map((source, i) => (
                <a 
                  key={i} 
                  href={source.uri} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-full bg-slate-900/50 border border-slate-800 text-[10px] font-bold text-slate-400 hover:text-white hover:border-blue-500/30 transition-all flex items-center gap-2"
                >
                  {source.title} <ArrowRight size={10} />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* New Match CTA */}
        <div className="pt-12 flex justify-center">
          <button
            onClick={onReset}
            className="group relative flex items-center gap-4 px-10 py-5 bg-white hover:bg-slate-100 text-slate-950 rounded-2xl font-black text-base uppercase tracking-wider transition-all hover:scale-[1.03] active:scale-[0.98] shadow-[0_25px_50px_rgba(255,255,255,0.1)]"
          >
            <PlusCircle size={22} className="text-blue-600" />
            Start New PM Match
            <RotateCcw size={20} className="text-slate-400 group-hover:rotate-180 transition-transform duration-500" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default AnalysisDashboard;
