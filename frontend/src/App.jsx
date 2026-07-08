import React, { useState, useEffect } from 'react';
import { fetchHistory, fetchSaved, runResearch, saveResearch, saveResearchEntry } from './api/research';

const MOCK_RESEARCH_RESPONSE = {
  search_results:
    "Title: Multi-Agent Collaboration Patterns in 2026\nURL: https://agenticblog.org/collaboration\nSnippet: Researchers outline standard design paradigms for multi-agent chains, emphasizing sequential and conversational handoffs.\n----\nTitle: Engineering Job-Ready Agent Systems\nURL: https://techjournals.com/agent-engineering\nSnippet: Practical architectures for enterprise agent design prioritize clear boundary roles, structured inputs/outputs, and comprehensive verification runs.",
  scraped_content:
    "Successfully scraped and extracted article body from: https://agenticblog.org/collaboration\n\n[Article Excerpt]:\nMulti-agent systems perform complex workflows by delegating tasks to specialized roles. A typical design involves: (1) A Search Agent to find raw data; (2) A Reader Agent to extract relevant details; (3) A Writer Agent to generate structured reports; and (4) A Critic Agent to grade outputs and identify weaknesses. Sequential routing guarantees high reliability in autonomous pipelines.",
  report:
    "# Introduction\nMulti-agent systems represent a major evolution in AI engineering, dividing complex tasks among specialized, collaborative agents.\n\n# Key Findings\n- **Role Specialization**: Assigning focused, single-purpose roles (Searcher, Reader, Writer, Critic) increases total task reliability.\n- **Sequential Handoffs**: Transferring outputs from one agent as inputs to the next creates clean validation checkpoints.\n- **Interactive Evaluation**: Implementing a Critic agent ensures reports are revised and graded against quality metrics.\n\n# Conclusion\nDividing and conquering tasks using distinct agents is a highly effective design pattern for complex information retrieval.",
  feedback:
    "Score: 8.5/10\n\nStrengths:\n- Clear structural separation of findings\n- Excellent summary of role specialization benefits\n- Good factual details on sequential handoffs\n\nAreas to Improve:\n- Include physical limitations of latency in multi-agent routing\n- Add a section on token cost management\n\nOne line verdict:\nA high-quality report detailing key structures of agentic pipelines."
};

export default function App() {
  const [topic, setTopic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [results, setResults] = useState(null);
  const [activeTab, setActiveTab] = useState('search');
  const [simulatedStep, setSimulatedStep] = useState(0);
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const [savedEntries, setSavedEntries] = useState([]);
  const [activeView, setActiveView] = useState('history');
  const [saving, setSaving] = useState(false);

  const refreshWorkspaceLists = async () => {
    try {
      const [historyData, savedData] = await Promise.all([fetchHistory(), fetchSaved()]);
      setHistory(historyData);
      setSavedEntries(savedData);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    refreshWorkspaceLists();
  }, []);

  useEffect(() => {
    let timer;
    if (loading) {
      setSimulatedStep(0);
      timer = setInterval(() => {
        setSimulatedStep((prev) => (prev < 3 ? prev + 1 : prev));
      }, 3000);
    } else {
      setSimulatedStep(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const resetWorkspace = () => {
    setResults(null);
    setError('');
    setActiveTab('search');
    setTopic('');
    setLoading(false);
    setWorkspaceMenuOpen(false);
    setActiveView('history');
  };

  const handleStartResearch = async (e) => {
    e.preventDefault();
    const trimmedTopic = topic.trim();
    if (!trimmedTopic) return;

    setLoading(true);
    setError('');
    setResults(null);
    setActiveTab('search');
    setWorkspaceMenuOpen(false);
    setActiveView('history');

    try {
      const data = await runResearch(trimmedTopic);
      setResults(data);
      await refreshWorkspaceLists();
    } catch (err) {
      console.error('Research failed:', err);
      setError(err.message || 'Failed to execute research pipeline.');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadHistoryItem = (entry) => {
    try {
      const parsed = typeof entry.generated_report === 'string' ? JSON.parse(entry.generated_report) : entry.generated_report;
      setResults({ ...parsed, id: entry.id, is_saved: entry.is_saved });
      setTopic(entry.topic);
      setActiveTab('search');
      setWorkspaceMenuOpen(false);
      setActiveView('history');
      setError('');
    } catch (err) {
      setError('Unable to restore this saved research entry.');
    }
  };

  const parseSearchResults = (rawText) => {
    if (!rawText) return [];
    const blocks = rawText.split('\n----\n');
    return blocks.map((block) => {
      const lines = block.split('\n');
      let title = 'Untitled Source';
      let url = '#';
      let snippet = '';

      lines.forEach((line) => {
        if (line.startsWith('Title:')) title = line.replace('Title:', '').trim();
        else if (line.startsWith('URL:')) url = line.replace('URL:', '').trim();
        else if (line.startsWith('Snippet:')) snippet = line.replace('Snippet:', '').trim();
      });
      return { title, url, snippet };
    });
  };

  const parseCriticFeedback = (text) => {
    const data = { score: 'N/A', strengths: [], improvements: [], verdict: '' };
    if (!text) return data;

    const scoreMatch = text.match(/Score:\s*(\d+(\.\d+)?\/\d+|\d+)/i);
    if (scoreMatch) data.score = scoreMatch[1];

    const lines = text.split('\n');
    let currentSection = '';

    for (let line of lines) {
      line = line.trim();
      if (/strengths/i.test(line)) {
        currentSection = 'strengths';
        continue;
      }
      if (/areas to improve|improve/i.test(line)) {
        currentSection = 'improvements';
        continue;
      }
      if (/verdict/i.test(line)) {
        currentSection = 'verdict';
        continue;
      }

      if (line.startsWith('-') || line.startsWith('*')) {
        const bulletText = line.substring(1).trim();
        if (bulletText) {
          if (currentSection === 'strengths') data.strengths.push(bulletText);
          if (currentSection === 'improvements') data.improvements.push(bulletText);
        }
      } else if (currentSection === 'verdict' && line) {
        data.verdict = line;
      }
    }
    return data;
  };

  const handleSaveResearch = async () => {
    if (!results || !results.id || saving) return;
    setSaving(true);
    try {
      const updated = await saveResearch(results.id);
      setResults((prev) => prev ? { ...prev, is_saved: true } : prev);
      const nextSaved = [updated, ...savedEntries.filter((entry) => entry.id !== updated.id)];
      setSavedEntries(nextSaved);
      setHistory((prev) => prev.map((entry) => entry.id === updated.id ? { ...entry, is_saved: true } : entry));
      await refreshWorkspaceLists();
    } catch (err) {
      setError(err.message || 'Unable to save research.');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadFile = () => {
    if (!results || !results.report) return;
    const blob = new Blob([results.report], { type: 'text/markdown' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `research-${topic.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const parsedSearch = results ? parseSearchResults(results.search_results) : [];
  const parsedCritic = results ? parseCriticFeedback(results.feedback) : null;
  const workflowSteps = [
    { label: 'Tavily Intake' },
    { label: 'Source Review' },
    { label: 'Narrative Build' },
    { label: 'Verification Sweep' },
  ];

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="app-title-block">
          <h1 className="project-name">AI Multi Agent Research System</h1>
          <p className="project-subtitle">Automated Literature Review & Critique Pipeline</p>
        </div>
        <div className="header-actions">
          <button className="hamburger-btn" onClick={() => setWorkspaceMenuOpen((prev) => !prev)} aria-label="Open workspace menu">
            ☰
          </button>
          <button className="btn-secondary" onClick={resetWorkspace}>Refresh</button>
        </div>
      </header>

      {workspaceMenuOpen && (
        <div className="workspace-menu-panel">
          <div className="workspace-menu-actions">
            <button className={`workspace-menu-btn ${activeView === 'history' ? 'active' : ''}`} onClick={() => setActiveView('history')}>
              History
            </button>
            <button className={`workspace-menu-btn ${activeView === 'saved' ? 'active' : ''}`} onClick={() => setActiveView('saved')}>
              Saved Searches
            </button>
          </div>

          <div className="workspace-menu-content">
            {activeView === 'history' ? (
              history.length > 0 ? (
                <div className="history-list">
                  {history.map((entry) => (
                    <button key={entry.id} className="history-item" onClick={() => handleLoadHistoryItem(entry)}>
                      <span className="history-topic">{entry.topic}</span>
                      <span className="history-date">{entry.search_date}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="placeholder-card">No history yet.</div>
              )
            ) : savedEntries.length > 0 ? (
              <div className="history-list">
                {savedEntries.map((entry) => (
                  <button key={entry.id} className="history-item" onClick={() => handleLoadHistoryItem(entry)}>
                    <span className="history-topic">{entry.topic}</span>
                    <span className="history-date">{entry.search_date}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="placeholder-card">No saved searches yet.</div>
            )}
          </div>
        </div>
      )}

      <div className="main-layout">
        <main className="editorial-card main-card">
          <div className="workspace-toolbar">
            <div>
              <h3 className="label-title">Research Studio</h3>
              <p className="toolbar-copy">Enter a topic to explore, summarize, and critique research in one flow.</p>
            </div>
          </div>

          <form onSubmit={handleStartResearch} className="research-form">
            <div className="form-group">
              <input
                type="text"
                className="text-input"
                placeholder="Enter subject keyword..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={loading}
                required
              />
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Generating...' : 'Generate Report'}
              </button>
            </div>

            {loading && (
            <div className="compact-flow">
              {workflowSteps.map((step, index) => {
                const stageClass = simulatedStep === index ? 'active' : simulatedStep > index ? 'done' : '';
                return (
                  <div className={`compact-flow-step ${stageClass}`} key={step.label}>
                    <span className="compact-dot" />
                    <span className="compact-label">{step.label}</span>
                  </div>
                );
              })}
            </div>
          )}

          {error && <div className="alert-banner error"><strong>Pipeline Error:</strong> {error}</div>}
          {loading && <div className="alert-banner running">Pipeline Active: Running Agent {simulatedStep + 1} of 4. Fetching content...</div>}

          <nav className="workspace-tabs">
            <button className={`tab-link ${activeTab === 'search' ? 'active' : ''}`} onClick={() => setActiveTab('search')}>Search Results</button>
            <button className={`tab-link ${activeTab === 'scraped' ? 'active' : ''}`} onClick={() => setActiveTab('scraped')}>Scraped Body</button>
            <button className={`tab-link ${activeTab === 'report' ? 'active' : ''}`} onClick={() => setActiveTab('report')}>Written Draft</button>
            <button className={`tab-link ${activeTab === 'critique' ? 'active' : ''}`} onClick={() => setActiveTab('critique')}>Critique</button>
          </nav>

          <div className="feed-content">
            {!results && !loading && <div className="empty-placeholder">Enter a topic keyword and click Generate Report to invoke the system.</div>}
            {loading && !results && <div className="empty-placeholder">Analyzing literature data. Please wait...</div>}

            {results && activeTab === 'search' && (
              <div className="search-results-list">
                {parsedSearch.map((item, index) => (
                  <article className="search-item" key={index}>
                    <h4 className="search-item-header">{item.title}</h4>
                    <a href={item.url} className="search-item-link" target="_blank" rel="noopener noreferrer">{item.url}</a>
                    <p className="search-item-text">{item.snippet}</p>
                  </article>
                ))}
              </div>
            )}

            {results && activeTab === 'scraped' && <div className="scraped-box">{results.scraped_content}</div>}

            {results && activeTab === 'report' && (
              <div className="report-document">
                {results.report.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) return <h1 key={idx}>{line.substring(2)}</h1>;
                  if (line.startsWith('## ')) return <h2 key={idx}>{line.substring(3)}</h2>;
                  if (line.startsWith('- ')) return <li key={idx}>{line.substring(2)}</li>;
                  return <p key={idx}>{line}</p>;
                })}
              </div>
            )}

            {results && activeTab === 'critique' && parsedCritic && (
              <div className="critique-summary">
                <div className="editorial-score-badge">
                  <span className="badge-score-number">{parsedCritic.score}</span>
                  <span className="badge-score-text">Pipeline Score</span>
                </div>
                <div className="critique-sections">
                  {parsedCritic.strengths.length > 0 && (
                    <div className="critique-box">
                      <h4>Strengths Identified</h4>
                      <ul>
                        {parsedCritic.strengths.map((str, idx) => <li key={idx}>{str}</li>)}
                      </ul>
                    </div>
                  )}
                  {parsedCritic.improvements.length > 0 && (
                    <div className="critique-box">
                      <h4>Suggested Improvements</h4>
                      <ul>
                        {parsedCritic.improvements.map((imp, idx) => <li key={idx}>{imp}</li>)}
                      </ul>
                    </div>
                  )}
                </div>
                {parsedCritic.verdict && (
                  <div className="verdict-banner">
                    <div className="verdict-header">Verdict</div>
                    <div className="verdict-body">"{parsedCritic.verdict}"</div>
                  </div>
                )}
              </div>
            )}
          </div>
          </form>

          {results && results.report && (
            <footer className="card-footer">
              <button className={`save-btn ${results.is_saved ? 'saved' : ''}`} onClick={handleSaveResearch} disabled={saving || Boolean(results.is_saved)}>
                {results.is_saved ? '✔ Saved' : '♡ Save Research'}
              </button>
              <button className="btn-secondary" onClick={handleDownloadFile}>Download Document (.md)</button>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}
