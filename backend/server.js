const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const path = require('path');

const app = express();
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});


// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Constants
const MAX_MODEL_CHARS = 4000;

// PDF upload and text extraction endpoint
app.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).send('File not uploaded');
  }

  try {
    const filePath = path.resolve(__dirname, req.file.path);
    const dataBuffer = require('fs').readFileSync(filePath);
    const pdfData = await pdfParse(dataBuffer);
    
    // Get text content
    const text = pdfData.text;

    // Check text length
    if (text.length > MAX_MODEL_CHARS) {
      console.warn('Text exceeds maximum character limit');
    }

    // Send the extracted text to client
    res.json({ 
      text: text,
      textLength: text.length,
      exceedsLimit: text.length > MAX_MODEL_CHARS
    });

    // Clean up: Delete uploaded file
    require('fs').unlinkSync(filePath);

  } catch (error) {
    console.error('Error processing PDF:', error);
    res.status(500).send('Error processing PDF');
  }
});

// Text length check endpoint
app.post('/check-text', (req, res) => {
  const { text } = req.body;
  
  if (!text) {
    return res.status(400).send('No text provided');
  }

  res.json({
    textLength: text.length,
    exceedsLimit: text.length > MAX_MODEL_CHARS
  });
});

// Writing capability check endpoint
app.get('/check-capabilities', (req, res) => {
  res.json({
    hasWriter: true,
    hasRewriter: true,
    maxLength: MAX_MODEL_CHARS
  });
});

// Writing options endpoint
app.get('/writing-options', (req, res) => {
  res.json({
    tones: [
      'professional',
      'casual',
      'formal',
      'friendly',
      'enthusiastic'
    ],
    formats: [
      'email',
      'blog-post',
      'social-media',
      'business-letter',
      'creative-writing'
    ],
    lengths: [
      'short',
      'medium',
      'long'
    ]
  });
});

app.post('/write', async (req, res) => {
    const { prompt, tone, length, format, context } = req.body;
    
    try {
      // Create writer instance with configurations
      const writer = await ai.writer.create({
        tone: tone,
        length: length,
        format: format,
        sharedContext: context?.trim()
      });
  
      // Generate the text
      const result = await writer.write(prompt);
  
      res.json({
        success: true,
        result: result
      });
  
    } catch (error) {
      console.error('Write error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  app.post('/rewrite', async (req, res) => {
    const { text, tone, length, format, context } = req.body;
  
    try {
      // Create rewriter instance with configurations
      const rewriter = await ai.rewriter.create({
        tone: tone,
        length: length,
        format: format,
        sharedContext: context?.trim()
      });
  
      // Generate the rewritten text
      const result = await rewriter.rewrite(text);
  
      res.json({
        success: true,
        result: result
      });
  
    } catch (error) {
      console.error('Rewrite error:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
  
  app.post('/write-stream', async (req, res) => {
    const { prompt, tone, length, format, context } = req.body;
  
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
  
    try {
      // Create writer instance with configurations
      const writer = await ai.writer.create({
        tone: tone,
        length: length,
        format: format,
        sharedContext: context?.trim()
      });
  
      // Start the streaming write process
      const stream = await writer.writeStream(prompt);
  
      // Handle the stream
      for await (const chunk of stream) {
        if (chunk) {
          res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        }
      }
  
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
  
    } catch (error) {
      console.error('Stream error:', error);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.end();
    }
  
    // Handle client disconnect
    req.on('close', () => {
      // Cleanup if needed
    });
  });

app.post('/prompt', async (req, res) => {
  const { prompt, context } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'No prompt provided'
    });
  }

  if (!self.ai || !self.ai.languageModel) {
    return res.status(400).json({
      success: false,
      error: 'AI Language Model not available'
    });
  }

  try {
    // Create AI session with default settings
    const session = await self.ai.languageModel.create({
      temperature: Number(req.body.temperature || 0.7),
      topK: Number(req.body.topK || 40)
    });

    // Format prompt with context if provided
    const fullPrompt = context 
      ? `Context from PDF: ${context}\n\nQuestion: ${prompt}`
      : prompt;

    // Get streaming response
    const stream = await session.promptStreaming(fullPrompt);
    let fullResponse = '';

    for await (const chunk of stream) {
      fullResponse = chunk.trim();
    }

    // Clean up session
    session.destroy();

    res.json({
      success: true,
      result: fullResponse
    });

  } catch (error) {
    console.error('Prompt error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add streaming endpoint
app.post('/prompt-stream', async (req, res) => {
  const { prompt, context } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'No prompt provided'
    });
  }

  if (!self.ai || !self.ai.languageModel) {
    return res.status(400).json({
      success: false,
      error: 'AI Language Model not available'
    });
  }

  // Set headers for Server-Sent Events
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const session = await self.ai.languageModel.create({
      temperature: Number(req.body.temperature || 0.7),
      topK: Number(req.body.topK || 40)
    });

    const fullPrompt = context 
      ? `Context from PDF: ${context}\n\nQuestion: ${prompt}`
      : prompt;

    const stream = await session.promptStreaming(fullPrompt);

    for await (const chunk of stream) {
      if (chunk) {
        res.write(`data: ${JSON.stringify({ chunk: chunk.trim() })}\n\n`);
      }
    }

    // Clean up session
    session.destroy();
    
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }

  // Handle client disconnect
  req.on('close', () => {
    // Cleanup if needed
  });
});

// Get AI capabilities
app.get('/ai-capabilities', async (req, res) => {
  try {
    if (!self.ai || !self.ai.languageModel) {
      throw new Error('AI Language Model not available');
    }

    const capabilities = await self.ai.languageModel.capabilities();
    res.json({
      success: true,
      capabilities
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
