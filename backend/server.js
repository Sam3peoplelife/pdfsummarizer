const express = require('express');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const cors = require('cors');
const path = require('path');
const marked = require('marked');
const createDOMPurify = require('dompurify');
const { JSDOM } = require('jsdom');
const window = new JSDOM('').window;
const DOMPurify = createDOMPurify(window);

const app = express();
const upload = multer({ 
  dest: 'uploads/',
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  }
});

const ai = {
  writer: {
    create: async (config) => {
      return {
        write: async (prompt) => {
          // Implement your writing logic here
          return `Generated content for prompt: ${prompt}`;
        },
        writeStream: async function* (prompt) {
          // Implement your streaming logic here
          yield "Streaming ";
          yield "content ";
          yield "for: ";
          yield prompt;
        }
      };
    }
  },
  rewriter: {
    create: async (config) => {
      return {
        rewrite: async (text) => {
          // Implement your rewriting logic here
          return `Rewritten content: ${text}`;
        }
      };
    }
  },
  promptModel: {
    create: async (config) => {
      const session = {
        temperature: config.temperature || 0.7,
        topK: config.topK || 40,
        
        async prompt(text) {
          // Implement your prompt logic here
          return `Generated response for: ${text}`;
        },

        async promptStreaming(text) {
          // Implementation of streaming functionality
          async function* generator() {
            const chunks = [
              "Processing ",
              "your ",
              "prompt: ",
              text
            ];
            
            for (const chunk of chunks) {
              yield chunk;
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          return generator();
        }
      };
      
      return session;
    }
  }
};

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
    
    const text = pdfData.text;

    if (text.length > MAX_MODEL_CHARS) {
      console.warn('Text exceeds maximum character limit');
    }

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
    hasPromptModel: true,
    maxLength: MAX_MODEL_CHARS,
    defaultTemperature: 0.7,
    defaultTopK: 40
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
  
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'No prompt provided'
    });
  }

  try {
    const writer = await ai.writer.create({
      tone: tone || 'professional',
      length: length || 'medium',
      format: format || 'general',
      sharedContext: context?.trim()
    });

    const result = await writer.write(prompt);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('Write error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

app.post('/rewrite', async (req, res) => {
  const { text, tone, length, format, context } = req.body;

  if (!text) {
    return res.status(400).json({
      success: false,
      error: 'No text provided'
    });
  }

  try {
    const rewriter = await ai.rewriter.create({
      tone: tone || 'professional',
      length: length || 'medium',
      format: format || 'general',
      sharedContext: context?.trim()
    });

    const result = await rewriter.rewrite(text);

    res.json({
      success: true,
      result: result
    });

  } catch (error) {
    console.error('Rewrite error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

app.post('/write-stream', async (req, res) => {
  const { prompt, tone, length, format, context } = req.body;

  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'No prompt provided'
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const writer = await ai.writer.create({
      tone: tone || 'professional',
      length: length || 'medium',
      format: format || 'general',
      sharedContext: context?.trim()
    });

    const stream = await writer.writeStream(prompt);

    for await (const chunk of stream) {
      if (chunk) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Internal server error' })}\n\n`);
    res.end();
  }

  req.on('close', () => {
    // Cleanup if needed
  });
});

// New Prompt API endpoints
app.post('/create-session', async (req, res) => {
  const { temperature, topK } = req.body;
  
  try {
    const session = await ai.promptModel.create({
      temperature: Number(temperature) || 0.7,
      topK: Number(topK) || 40
    });
    
    res.json({
      success: true,
      message: 'Session created successfully'
    });
  } catch (error) {
    console.error('Session creation error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create session'
    });
  }
});

app.post('/prompt', async (req, res) => {
  const { prompt, temperature, topK } = req.body;
  
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'No prompt provided'
    });
  }

  try {
    const session = await ai.promptModel.create({
      temperature: Number(temperature) || 0.7,
      topK: Number(topK) || 40
    });

    const result = await session.prompt(prompt);
    const sanitizedHtml = DOMPurify.sanitize(marked.parse(result));
    
    res.json({
      success: true,
      result: result,
      html: sanitizedHtml
    });
  } catch (error) {
    console.error('Prompt error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Internal server error'
    });
  }
});

app.post('/prompt-stream', async (req, res) => {
  const { prompt, temperature, topK } = req.body;
  
  if (!prompt) {
    return res.status(400).json({
      success: false,
      error: 'No prompt provided'
    });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const session = await ai.promptModel.create({
      temperature: Number(temperature) || 0.7,
      topK: Number(topK) || 40
    });

    const stream = await session.promptStreaming(prompt);

    for await (const chunk of stream) {
      if (chunk) {
        const sanitizedHtml = DOMPurify.sanitize(marked.parse(chunk));
        res.write(`data: ${JSON.stringify({ 
          chunk: chunk,
          html: sanitizedHtml 
        })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();

  } catch (error) {
    console.error('Stream error:', error);
    res.write(`data: ${JSON.stringify({ 
      error: error.message || 'Internal server error' 
    })}\n\n`);
    res.end();
  }

  req.on('close', () => {
    // Cleanup if needed
  });
});

const PORT = 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
