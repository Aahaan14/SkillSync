import React, { useState, useEffect } from 'react';
import { getCurrentUser, login, register, logout, triggerAnalysis, getLatestAnalysis, saveProfile } from '../api/client';
import { Profile } from '../types';
import { Loading } from '../components/Loading';
import { MatchScore } from '../components/MatchScore';
import { SkillGap } from '../components/SkillGap';
import { MarketSkills } from '../components/MarketSkills';

function App() {
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState('');
  
  const [analysis, setAnalysis] = useState<any>(null);
  const [loadingMsg, setLoadingMsg] = useState('');

  // Check auth on load
  useEffect(() => {
    getCurrentUser()
      .then(u => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setIsCheckingAuth(false));
  }, []);

  // Fetch latest analysis when user changes
  useEffect(() => {
    if (user) {
      getLatestAnalysis()
        .then(data => setAnalysis(data))
        .catch(() => setAnalysis(null));
    }
  }, [user]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoadingMsg(isRegister ? 'Creating account...' : 'Logging in...');
    try {
      const u = isRegister
        ? await register(email, password, fullName)
        : await login(email, password);
      setUser(u);
    } catch (err: any) {
      setError(err.message || (isRegister ? 'Registration failed' : 'Login failed'));
    } finally {
      setLoadingMsg('');
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setAnalysis(null);
    }
  };

  const handleExtractAndAnalyze = async () => {
    setError('');
    setLoadingMsg('Extracting profile data...');
    
    // Send message to active tab to extract profile
    chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
      const tab = tabs[0];
      if (tab.id) {
        chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PROFILE" }, async function(response) {
          if (chrome.runtime.lastError) {
            setError('Could not connect to page. Make sure you are on a profile page and refresh it.');
            setLoadingMsg('');
            return;
          }
          if (response && response.success && response.profile) {
            try {
              setLoadingMsg('Saving profile...');
              await saveProfile(response.profile as Profile);
              
              setLoadingMsg('Analyzing market data... This may take a minute.');
              const result = await triggerAnalysis();
              setAnalysis(result);
            } catch (err: any) {
              setError(err.message || 'Analysis failed');
            } finally {
              setLoadingMsg('');
            }
          } else {
            setError(response?.error || 'Failed to extract profile.');
            setLoadingMsg('');
          }
        });
      }
    });
  };

  if (isCheckingAuth) return <Loading message="Starting Copilot..." />;
  if (loadingMsg) return <Loading message={loadingMsg} />;

  // Login Screen
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 bg-white">
        <h1 className="text-2xl font-bold text-brand-600 mb-2">SkillSync</h1>
        <p className="text-sm text-gray-500 mb-8 text-center">Your Career Intelligence Copilot</p>
        
        <form onSubmit={handleAuth} className="w-full space-y-4">
          {isRegister && (
            <div>
              <input
                type="text"
                required
                placeholder="Full name"
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
            </div>
          )}
          <div>
            <input
              type="email"
              required
              placeholder="Email"
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>
          <div>
            <input
              type="password"
              required
              placeholder={isRegister ? 'Password (8+ chars, upper, lower, digit)' : 'Password'}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-red-500 text-center">{error}</p>}
          <button
            type="submit"
            className="w-full py-2 bg-brand-600 text-white rounded-lg font-medium text-sm hover:bg-brand-700 transition-colors"
          >
            {isRegister ? 'Create account' : 'Log In'}
          </button>
          <button
            type="button"
            onClick={() => { setIsRegister(!isRegister); setError(''); }}
            className="w-full text-xs text-gray-500 hover:text-brand-600"
          >
            {isRegister ? 'Already have an account? Log in' : 'Need an account? Register'}
          </button>
        </form>
      </div>
    );
  }

  // Dashboard Screen
  return (
    <div className="flex flex-col h-full bg-gray-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-100">
        <h1 className="text-lg font-bold text-gray-900">SkillSync</h1>
        <div className="flex items-center gap-2">
          <button 
            onClick={handleExtractAndAnalyze}
            className="px-3 py-1.5 bg-brand-600 text-white text-xs font-medium rounded hover:bg-brand-700 transition-colors"
          >
            Analyze Current Page
          </button>
          <button
            onClick={handleLogout}
            className="px-2 py-1.5 text-xs text-gray-500 hover:text-gray-800"
          >
            Log out
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3 m-4 text-xs text-red-700 bg-red-50 rounded-lg border border-red-100">
          {error}
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {analysis ? (
          <>
            <MatchScore score={analysis.overall_alignment_score || 0} />
            <SkillGap strengths={analysis.strengths || []} gaps={analysis.skill_gaps || []} />
            <MarketSkills marketSkills={analysis.market_skills || {}} />
            
            <div className="p-4 bg-white mt-2 mb-4 text-center">
              <a href="http://localhost:3000" target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-600 hover:text-brand-700 underline">
                View Full Web Dashboard ↗
              </a>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center text-gray-500">
            <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <p className="text-sm">Navigate to a professional profile and click <strong>Analyze Current Page</strong> to get started.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
