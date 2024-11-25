import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [pdfFile, setPdfFile] = useState(null);
  const [pdfText, setPdfText] = useState('');
  const [summary, setSummary] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Writing states
  const [showWritingForm, setShowWritingForm] = useState(false);
  const [writingPrompt, setWritingPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [writingOptions, setWritingOptions] = useState(null);
  const [selectedOptions, setSelectedOptions] = useState({
    tone: 'professional',
    format: 'email',
    length: 'medium'
  });

  // Fetch writing options on component mount
  useEffect(() => {
    fetchWritingOptions();
  }, []);

  const fetchWritingOptions = async () => {
    try {
      const response = await axios.get('http://localhost:5000/writing-options');
      setWritingOptions(response.data);
    } catch (error) {
      console.error('Error fetching writing options:', error);
    }
  };

  // Summarization functions
  const handleFileChange = (e) => {
    setPdfFile(e.target.files[0]);
    setError('');
    setShowWritingForm(false);
    setGeneratedText('');
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
      const response = await axios.post('http://localhost:5000/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setPdfText(response.data.text);

      if (response.data.exceedsLimit) {
        setError('Warning: Text length exceeds maximum limit. Summary may be incomplete.');
      }

      const session = await window.ai.summarizer.create({
        type: 'key-points',
        format: 'markdown',
        length: 'short'
      });

      const summaryResult = await session.summarize(response.data.text);
      setSummary(summaryResult);
      setShowWritingForm(true);

      await session.destroy();

    } catch (error) {
      console.error('Error:', error);
      setError(error.message || 'Failed to process PDF and generate summary');
    } finally {
      setIsLoading(false);
    }
  };

  // Writing functions
  const handleWritingSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      const response = await axios.post('http://localhost:5000/write', {
        prompt: writingPrompt,
        ...selectedOptions,
        context: summary // Using the summary as context
      });

      setGeneratedText(response.data.result.generatedText);
    } catch (error) {
      setError('Error generating text: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center' }}>PDF Text Extractor and Summarizer</h1>
      
      {/* File Upload Section */}
      <div style={{ marginBottom: '20px' }}>
        <input 
          type="file" 
          accept=".pdf" 
          onChange={handleFileChange} 
          style={{ marginRight: '10px' }}
        />
        <button 
          onClick={handleUpload}
          disabled={isLoading}
          style={{ padding: '5px 15px' }}
        >
          {isLoading ? 'Processing...' : 'Upload & Summarize'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div style={{ color: 'red', marginBottom: '20px' }}>
          {error}
        </div>
      )}

      {/* Results Section */}
      {(pdfText || summary) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
          {/* Original Text */}
          <div>
            <h3>Original Text:</h3>
            <div 
              style={{ 
                border: '1px solid #ccc', 
                padding: '10px', 
                borderRadius: '4px',
                maxHeight: '500px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap'
              }}
            >
              {pdfText}
            </div>
          </div>

          {/* Summary */}
          <div>
            <h3>Summary:</h3>
            <pre 
              style={{ 
                border: '1px solid #ccc', 
                padding: '10px', 
                borderRadius: '4px',
                maxHeight: '500px',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                margin: 0
              }}
            >
              {summary}
            </pre>
          </div>
        </div>
      )}

      {/* Writing Form */}
      {showWritingForm && writingOptions && (
        <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '4px' }}>
          <h3>Generate Text Based on Summary</h3>
          <form onSubmit={handleWritingSubmit}>
            <div style={{ marginBottom: '15px' }}>
              <label htmlFor="prompt" style={{ display: 'block', marginBottom: '5px' }}>
                Writing Prompt:
              </label>
              <textarea
                id="prompt"
                value={writingPrompt}
                onChange={(e) => setWritingPrompt(e.target.value)}
                style={{ width: '100%', minHeight: '100px', padding: '8px' }}
                placeholder="Enter your writing prompt here..."
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '15px' }}>
              {/* Tone Selection */}
              <div>
                <label htmlFor="tone" style={{ display: 'block', marginBottom: '5px' }}>
                  Tone:
                </label>
                <select
                  id="tone"
                  value={selectedOptions.tone}
                  onChange={(e) => setSelectedOptions({...selectedOptions, tone: e.target.value})}
                  style={{ width: '100%', padding: '5px' }}
                >
                  {writingOptions.tones.map(tone => (
                    <option key={tone} value={tone}>{tone}</option>
                  ))}
                </select>
              </div>

              {/* Format Selection */}
              <div>
                <label htmlFor="format" style={{ display: 'block', marginBottom: '5px' }}>
                  Format:
                </label>
                <select
                  id="format"
                  value={selectedOptions.format}
                  onChange={(e) => setSelectedOptions({...selectedOptions, format: e.target.value})}
                  style={{ width: '100%', padding: '5px' }}
                >
                  {writingOptions.formats.map(format => (
                    <option key={format} value={format}>{format}</option>
                  ))}
                </select>
              </div>

              {/* Length Selection */}
              <div>
                <label htmlFor="length" style={{ display: 'block', marginBottom: '5px' }}>
                  Length:
                </label>
                <select
                  id="length"
                  value={selectedOptions.length}
                  onChange={(e) => setSelectedOptions({...selectedOptions, length: e.target.value})}
                  style={{ width: '100%', padding: '5px' }}
                >
                  {writingOptions.lengths.map(length => (
                    <option key={length} value={length}>{length}</option>
                  ))}
                </select>
              </div>
            </div>

            <button 
              type="submit" 
              disabled={isLoading || !writingPrompt}
              style={{ padding: '8px 20px' }}
            >
              {isLoading ? 'Generating...' : 'Generate Text'}
            </button>
          </form>

          {/* Generated Text Display */}
          {generatedText && (
            <div style={{ marginTop: '20px' }}>
              <h3>Generated Text:</h3>
              <div 
                style={{ 
                  border: '1px solid #ccc', 
                  padding: '10px', 
                  borderRadius: '4px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {generatedText}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
