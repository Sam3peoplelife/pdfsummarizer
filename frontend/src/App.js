import React, { useState, useEffect } from 'react';
import axios from 'axios';

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
    <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>
        PDF Text Extractor and AI Assistant
      </h1>
      
      {/* File Upload Section */}
      <div style={{ marginBottom: '30px', textAlign: 'center' }}>
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          style={{ marginRight: '10px' }}
        />
        <button 
          onClick={handleUpload}
          disabled={isLoading || !aiSupported}
          style={{ 
            padding: '8px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {isLoading ? 'Processing...' : 'Upload & Summarize'}
        </button>
      </div>

      {/* Summary Options */}
      <fieldset style={{ marginBottom: '30px', padding: '15px', borderRadius: '4px' }}>
        <legend>Summary Options</legend>
        <div style={{ display: 'flex', gap: '20px', justifyContent: 'center' }}>
          <div>
            <label htmlFor="type">Summary Type: </label>
            <select 
              id="type"
              value={summaryType} 
              onChange={(e) => setSummaryType(e.target.value)}
              style={{ padding: '5px' }}
            >
              <option value="key-points">Key Points</option>
              <option value="tl;dr">TL;DR</option>
              <option value="teaser">Teaser</option>
              <option value="headline">Headline</option>
            </select>
          </div>

          <div>
            <label htmlFor="format">Format: </label>
            <select 
              id="format"
              value={summaryFormat} 
              onChange={(e) => setSummaryFormat(e.target.value)}
              style={{ padding: '5px' }}
            >
              <option value="markdown">Markdown</option>
              <option value="plain-text">Plain text</option>
            </select>
          </div>

          <div>
            <label htmlFor="length">Length: </label>
            <select 
              id="length"
              value={summaryLength} 
              onChange={(e) => setSummaryLength(e.target.value)}
              style={{ padding: '5px' }}
            >
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
            </select>
          </div>
        </div>
      </fieldset>

      {/* Error Display */}
      {error && (
        <div style={{ 
          color: 'red', 
          marginBottom: '20px', 
          padding: '10px', 
          backgroundColor: '#ffebee',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          {error}
        </div>
      )}

      {/* Results Section */}
      {(pdfText || summary) && (
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px' }}>
            {/* Original Text */}
            <div>
              <h3>Original Text:</h3>
              <div style={{ 
                border: '1px solid #ccc', 
                padding: '15px', 
                borderRadius: '4px',
                maxHeight: '400px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                backgroundColor: '#f8f9fa'
              }}>
                {pdfText}
              </div>
            </div>

            {/* Summary */}
            <div>
              <h3>Summary:</h3>
              <pre style={{ 
                border: '1px solid #ccc', 
                padding: '15px', 
                borderRadius: '4px',
                maxHeight: '400px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                margin: 0,
                backgroundColor: '#f8f9fa'
              }}>
                {summary}
              </pre>
            </div>
          </div>

          {/* AI Question Section */}
          <div style={{ marginTop: '30px' }}>
            <h3>Ask Questions About the Text</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask a question about the text..."
                style={{ 
                  flex: 1,
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '16px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isPrompting) {
                    handlePromptSubmit();
                  }
                }}
              />
              <button
                onClick={handlePromptSubmit}
                disabled={isPrompting || !aiSupported}
                style={{ 
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isPrompting ? 'not-allowed' : 'pointer'
                }}
              >
                {isPrompting ? 'Processing...' : 'Ask AI'}
              </button>
            </div>

            {/* AI Response */}
            {promptResponse && (
              <div>
                <h4>AI Response:</h4>
                <pre style={{ 
                  border: '1px solid #ccc',
                  padding: '15px',
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  backgroundColor: '#f8f9fa',
                  fontSize: '16px'
                }}>
                  {promptResponse}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Content Generation Section */}
        {pdfText && (
          <div style={{ marginTop: '30px', borderTop: '1px solid #ccc', paddingTop: '20px' }}>
            <h3>Generate Additional Content</h3>
            
            {/* Prompt Input */}
            <div style={{ 
              display: 'flex', 
              gap: '10px', 
              marginBottom: '20px' 
            }}>
              <input
                type="text"
                value={generationPrompt}
                onChange={(e) => setGenerationPrompt(e.target.value)}
                placeholder="Enter your prompt (e.g., 'Create a bullet-point summary' or 'Explain this in simple terms')"
                style={{ 
                  flex: 1,
                  padding: '10px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '16px'
                }}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !isGenerating) {
                    handleGenerateContent();
                  }
                }}
              />
              <button
                onClick={handleGenerateContent}
                disabled={isGenerating}
                style={{ 
                  padding: '8px 20px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: isGenerating ? 'not-allowed' : 'pointer'
                }}
              >
                {isGenerating ? 'Generating...' : 'Generate'}
              </button>
            </div>

            {/* Generated Content Display */}
            {generatedContent && (
              <div>
                <h4>Generated Content:</h4>
                <pre style={{ 
                  border: '1px solid #ccc',
                  padding: '15px',
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  backgroundColor: '#f8f9fa',
                  fontSize: '16px'
                }}>
                  {generatedContent}
                </pre>
              </div>
            )}
          </div>
        )}
    </div>
  );
}

export default App;
