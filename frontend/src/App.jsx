import React, { useState, useEffect } from 'react';
import { runResearch } from './api/research';

// Mock data to simulate the response of the multi-agent system when in Demo Mode
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
  // --- 1. React States ---
  const [topic, setTopic] = useState('');          // Input box value
  const [loading, setLoading] = useState(false);    // True when research is running
  const [error, setError] = useState('');          // Stores error messages (if any)
  const [useMock, setUseMock] = useState(true);    // Toggle for Simulated Demo Mode
  
  // Stores the final research dictionary returned by the Python backend
  const [results, setResults] = useState(null);
  
  // Selected tab in the results panel ('search', 'scraped', 'report', 'critique')
  const [activeTab, setActiveTab] = useState('search');
  
  // Tracks which visual step is active during loading (0 = Search, 1 = Scrape, 2 = Write, 3 = Critique)
  const [simulatedStep, setSimulatedStep] = useState(0);

  // --- 2. Visual Step Simulation (For loading feedback) ---
  useEffect(() => {
    let timer;
    if (loading) {
      setSimulatedStep(0);
      // We cycle through steps 0, 1, 2, 3 every 3 seconds to show progress to the user
      timer = setInterval(() => {
        setSimulatedStep((prev) => {
          if (prev < 3) return prev + 1;
          return prev; // Stay on the last step until fetch completes
        });
      }, 3000);
    } else {
      setSimulatedStep(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  // --- 3. Execute Research Logic ---
  const handleStartResearch = async (e) => {
    e.preventDefault();
    if (!topic.trim()) return;

    // Reset states for a new run
    setLoading(true);
    setError('');
    setResults(null);
    setActiveTab('search');

    if (useMock) {
      // --- Demo Mode: Wait 5 seconds and load mock results ---
      setTimeout(() => {
        setResults(MOCK_RESEARCH_RESPONSE);
        setLoading(false);
      }, 5000);
    } else {
      // --- Live Mode: Perform real API call to app.py backend ---
      try {
        const data = await runResearch(topic);
        setResults(data);
        setLoading(false);
      } catch (err) {
        console.error("Research failed:", err);
        setError(err.message || "Failed to execute research pipeline.");
        setLoading(false);
      }
    }
  };

  // --- 4. Helper Helpers for Parsing Text Results ---

  // Helper to split Tavily search text into readable blocks
  const parseSearchResults = (rawText) => {
    if (!rawText) return [];
    const blocks = rawText.split('\n----\n');
    return blocks.map(block => {
      const lines = block.split('\n');
      let title = 'Untitled Source';
      let url = '#';
      let snippet = '';
      
      lines.forEach(line => {
        if (line.startsWith('Title:')) title = line.replace('Title:', '').trim();
        else if (line.startsWith('URL:')) url = line.replace('URL:', '').trim();
        else if (line.startsWith('Snippet:')) snippet = line.replace('Snippet:', '').trim();
      });
      return { title, url, snippet };
    });
  };

  // Helper to parse Critic markdown-like score, strengths, and areas to improve
  const parseCriticFeedback = (text) => {
    const data = { score: 'N/A', strengths: [], improvements: [], verdict: '' };
    if (!text) return data;

    // Extract score (e.g. Score: 8/10 or Score: 8.5/10)
    const scoreMatch = text.match(/Score:\s*(\d+(\.\d+)?\/\d+|\d+)/i);
    if (scoreMatch) data.score = scoreMatch[1];

    // Extract bullet points
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

  // Generate downloadable report markdown file
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

  // Pre-parse the parsed items
  const parsedSearch = results ? parseSearchResults(results.search_results) : [];
  const parsedCritic = results ? parseCriticFeedback(results.feedback) : null;

  // --- 5. JSX Render ---
  return (
    <div className="app-container">
      {/* Human-designed book/editorial style header */}
      <header className="app-header">
        <h1 className="project-name">AI Multi Agent Research System</h1>
        <p className="project-subtitle">Automated Literature Review & Critique Pipeline</p>
      </header>

      <div className="main-layout">
        
        {/* Left Side: Topic controls and Pipeline Stepper */}
        <aside className="editorial-card">
          <h3 className="label-title">Research Setup</h3>
          
          <form onSubmit={handleStartResearch}>
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
            </div>

            {/* Simulated run mode checkbox */}
            <div className="demo-toggle-row">
              <span className="toggle-label">Demo Simulation Mode</span>
              <input
                type="checkbox"
                className="checkbox-toggle"
                checked={useMock}
                onChange={(e) => setUseMock(e.target.checked)}
                disabled={loading}
              />
            </div>

            <button 
              type="submit" 
              className={`btn-primary ${loading ? 'btn-stop' : ''}`}
              disabled={!topic.trim() && !loading}
            >
              {loading ? "Running Pipeline..." : "Generate Report"}
            </button>
          </form>

          {/* Stepper tracking agents */}
          <div className="pipeline-timeline">
            <h3 className="label-title" style={{ marginTop: '2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
              Pipeline Progress
            </h3>
            
            {/* Step 1: Search */}
            <div className={`timeline-step ${loading && simulatedStep === 0 ? 'active' : ''} ${results ? 'done' : ''}`}>
              <div className="step-marker"></div>
              <span className="step-text">Search Agent (Tavily Query)</span>
            </div>

            {/* Step 2: Scrape */}
            <div className={`timeline-step ${loading && simulatedStep === 1 ? 'active' : ''} ${results ? 'done' : ''}`}>
              <div className="step-marker"></div>
              <span className="step-text">Scraping Agent (Soup Extractor)</span>
            </div>

            {/* Step 3: Writer */}
            <div className={`timeline-step ${loading && simulatedStep === 2 ? 'active' : ''} ${results ? 'done' : ''}`}>
              <div className="step-marker"></div>
              <span className="step-text">Writing Agent (Report Draft)</span>
            </div>

            {/* Step 4: Critic */}
            <div className={`timeline-step ${loading && simulatedStep === 3 ? 'active' : ''} ${results ? 'done' : ''}`}>
              <div className="step-marker"></div>
              <span className="step-text">Critic Agent (Peer Evaluation)</span>
            </div>
          </div>
        </aside>

        {/* Right Side: Tab Workspace Feed */}
        <main className="editorial-card">
          
          {/* Alerts */}
          {error && (
            <div className="alert-banner error">
              <strong>Pipeline Error:</strong> {error}
            </div>
          )}

          {loading && (
            <div className="alert-banner running">
              Pipeline Active: Running Agent {simulatedStep + 1} of 4. Fetching content...
            </div>
          )}

          {/* Tab selector menu */}
          <nav className="workspace-tabs">
            <button 
              className={`tab-link ${activeTab === 'search' ? 'active' : ''}`}
              onClick={() => setActiveTab('search')}
            >
              Search Results
            </button>
            <button 
              className={`tab-link ${activeTab === 'scraped' ? 'active' : ''}`}
              onClick={() => setActiveTab('scraped')}
            >
              Scraped Body
            </button>
            <button 
              className={`tab-link ${activeTab === 'report' ? 'active' : ''}`}
              onClick={() => setActiveTab('report')}
            >
              Written Draft
            </button>
            <button 
              className={`tab-link ${activeTab === 'critique' ? 'active' : ''}`}
              onClick={() => setActiveTab('critique')}
            >
              Critique
            </button>
          </nav>

          {/* Tab content panel */}
          <div className="feed-content">
            
            {/* If no research has run yet and not loading */}
            {!results && !loading && (
              <div className="empty-placeholder">
                Enter a topic keyword and click Generate Report to invoke the system.
              </div>
            )}

            {/* If loading and results haven't arrived yet */}
            {loading && !results && (
              <div className="empty-placeholder">
                Analyzing literature data. Please wait...
              </div>
            )}

            {/* Search Tab View */}
            {results && activeTab === 'search' && (
              <div className="search-results-list">
                {parsedSearch.map((item, index) => (
                  <article className="search-item" key={index}>
                    <h4 className="search-item-header">{item.title}</h4>
                    <a href={item.url} className="search-item-link" target="_blank" rel="noopener noreferrer">
                      {item.url}
                    </a>
                    <p className="search-item-text">{item.snippet}</p>
                  </article>
                ))}
              </div>
            )}

            {/* Scraped Excerpt Tab View */}
            {results && activeTab === 'scraped' && (
              <div className="scraped-box">
                {results.scraped_content}
              </div>
            )}

            {/* Draft Report Tab View */}
            {results && activeTab === 'report' && (
              <div className="report-document">
                {/* Parse report markdown headers dynamically */}
                {results.report.split('\n').map((line, idx) => {
                  if (line.startsWith('# ')) {
                    return <h1 key={idx}>{line.substring(2)}</h1>;
                  }
                  if (line.startsWith('## ')) {
                    return <h2 key={idx}>{line.substring(3)}</h2>;
                  }
                  if (line.startsWith('- ')) {
                    return <li key={idx}>{line.substring(2)}</li>;
                  }
                  return <p key={idx}>{line}</p>;
                })}
              </div>
            )}

            {/* Critique Feedback Tab View */}
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
                        {parsedCritic.strengths.map((str, idx) => (
                          <li key={idx}>{str}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {parsedCritic.improvements.length > 0 && (
                    <div className="critique-box">
                      <h4>Suggested Improvements</h4>
                      <ul>
                        {parsedCritic.improvements.map((imp, idx) => (
                          <li key={idx}>{imp}</li>
                        ))}
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

          {/* Footer Actions (Markdown download button) */}
          {results && results.report && (
            <footer className="card-footer">
              <button className="btn-secondary" onClick={handleDownloadFile}>
                Download Document (.md)
              </button>
            </footer>
          )}

        </main>
      </div>
    </div>
  );
}
