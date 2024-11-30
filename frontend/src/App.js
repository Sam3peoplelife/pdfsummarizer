import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

function App() {
  // Existing state variables
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [summary, setSummary] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [aiSupported, setAiSupported] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [promptResponse, setPromptResponse] = useState('');
  const [isPrompting, setIsPrompting] = useState(false);
  const [summaryType, setSummaryType] = useState('key-points');
  const [summaryFormat, setSummaryFormat] = useState('markdown');
  const [summaryLength, setSummaryLength] = useState('short');

  const [generatedContent, setGeneratedContent] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationPrompt, setGenerationPrompt] = useState('');

  const [generationFormat, setGenerationFormat] = useState('summary');
  const [generationTone, setGenerationTone] = useState('professional');
  const [generationLength, setGenerationLength] = useState('medium');
  const [generationOptions, setGenerationOptions] = useState(null);

  // Check AI API support on component mount
  useEffect(() => {
    if (!window.ai || !window.ai.languageModel) {
      setAiSupported(false);
      setError('Your browser does not support the AI API. Please use Chrome with AI features enabled.');
    }
  }, []);

  // Fetch available generation options when component mounts
  useEffect(() => {
    fetch('http://localhost:5000/generation-options')
      .then(response => response.json())
      .then(options => setGenerationOptions(options))
      .catch(error => console.error('Error fetching generation options:', error));
  }, []);

  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0]);
    setError('');
    // Reset states when new file is selected
    setPdfText('');
    setSummary('');
    setPromptResponse('');
  };

  const handleUpload = async () => {
    if (!pdfFile) {
      setError('Please select a PDF file');
      return;
    }

    setIsLoading(true);
    setError('');

    const formData = new FormData();
    formData.append('file', pdfFile);

    try {
      // Upload PDF and get text
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPdfText(response.data.text);

      if (response.data.exceedsLimit) {
        setError('Warning: Text length exceeds maximum limit. Summary may be incomplete.');
      }

      // Create summarization session with correct format options
      const session = await window.ai.summarizer.create({
        type: summaryType,
        format: summaryFormat,
        length: summaryLength
      });

      const summaryResult = await session.summarize(response.data.text);
      setSummary(summaryResult);

      await session.destroy();

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Failed to process PDF and generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptSubmit = async () => {
    if (!prompt.trim()) {
      setError('Please enter a question');
      return;
    }

    if (!aiSupported) {
      setError('AI features are not supported in your browser');
      return;
    }

    setIsPrompting(true);
    setError('');

    try {
      const session = await window.ai.languageModel.create({
        temperature: 0.7,
        topK: 40
      });

      const fullPrompt = `Context from the PDF:\n${pdfText}\n\nSummary:\n${summary}\n\nQuestion: ${prompt}`;
      const stream = await session.promptStreaming(fullPrompt);
      let response = '';

      for await (const chunk of stream) {
        response = chunk.trim();
        setPromptResponse(response);
      }

      await session.destroy();
    } catch (error) {
      console.error('Prompt error:', error);
      setError(error.message || 'Failed to get AI response');
    } finally {
      setIsPrompting(false);
    }
  };

  // New function for content generation
  const handleGenerateContent = async () => {
    if (!pdfText) {
      setError('Please upload and process a PDF first');
      return;
    }
  
    if (!generationPrompt.trim()) {
      setError('Please enter a prompt for generation');
      return;
    }
  
    setIsGenerating(true);
    setError('');
  
    try {
      const response = await fetch('http://localhost:5000/generate-content', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pdfText,
          userPrompt: generationPrompt
        }),
      });
  
      const data = await response.json();
      if (data.success) {
        setGeneratedContent(data.result);
      } else {
        setError(data.error || 'Failed to generate content');
      }
    } catch (error) {
      console.error('Generation error:', error);
      setError(error.message || 'Failed to generate content');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="notion-container">
      {/* Header */}
      <header className="notion-header">
        <h1>PDF Text Extractor and AI Assistant</h1>
      </header>

      {/* Main Content */}
      <main className="notion-main">
        {/* File Upload Section */}
        <section className="notion-section">
          <div className="upload-container">
            <input 
              type="file" 
              accept=".pdf" 
              onChange={handleFileChange} 
              className="notion-file-input"
            />
            <button 
              onClick={handleUpload}
              disabled={isLoading || !aiSupported}
              className={`notion-button ${isLoading ? 'loading' : ''}`}
            >
              {isLoading ? 'Processing...' : 'Upload & Summarize'}
            </button>
          </div>
        </section>

        {/* Summary Options */}
        <section className="notion-section">
          <div className="notion-options">
            <div className="option-group">
              <label htmlFor="type">Summary Type</label>
              <select 
                id="type"
                value={summaryType} 
                onChange={(e) => setSummaryType(e.target.value)}
                className="notion-select"
              >
                <option value="key-points">Key Points</option>
                <option value="tl;dr">TL;DR</option>
                <option value="teaser">Teaser</option>
                <option value="headline">Headline</option>
              </select>
            </div>

            <div className="option-group">
              <label htmlFor="format">Format</label>
              <select 
                id="format"
                value={summaryFormat} 
                onChange={(e) => setSummaryFormat(e.target.value)}
                className="notion-select"
              >
                <option value="markdown">Markdown</option>
                <option value="plain-text">Plain text</option>
              </select>
            </div>

            <div className="option-group">
              <label htmlFor="length">Length</label>
              <select 
                id="length"
                value={summaryLength} 
                onChange={(e) => setSummaryLength(e.target.value)}
                className="notion-select"
              >
                <option value="short">Short</option>
                <option value="medium">Medium</option>
                <option value="long">Long</option>
              </select>
            </div>
          </div>
        </section>

        {/* Error Display */}
        {error && (
          <div className="notion-callout error">
            {error}
          </div>
        )}

        {/* Results Section */}
        {(pdfText || summary) && (
          <section className="notion-section results">
            <div className="notion-columns">
              {/* Original Text */}
              <div className="notion-column">
                <h3>Original Text</h3>
                <div className="notion-content-box">
                  {pdfText}
                </div>
              </div>

              {/* Summary */}
              <div className="notion-column">
                <h3>Summary</h3>
                <div className="notion-content-box">
                  {summary}
                </div>
              </div>
            </div>

            {/* AI Question Section */}
            <div className="notion-ai-section">
              <h3>Ask Questions About the Text</h3>
              <div className="notion-input-group">
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ask a question about the text..."
                  className="notion-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !isPrompting) {
                      handlePromptSubmit();
                    }
                  }}
                />
                <button
                  onClick={handlePromptSubmit}
                  disabled={isPrompting || !aiSupported}
                  className={`notion-button secondary ${isPrompting ? 'loading' : ''}`}
                >
                  {isPrompting ? 'Processing...' : 'Ask AI'}
                </button>
              </div>

              {/* AI Response */}
              {promptResponse && (
                <div className="notion-response">
                  <h4>AI Response</h4>
                  <div className="notion-content-box">
                    {promptResponse}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

export default App;
