// =================================================================================
// DEBUG VERSION - Better error handling to identify the issue
// =================================================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');

// Basic setup first
const PORT = process.env.PORT || 8080;

console.log('🚀 Starting server...');
console.log('📋 Environment check:');
console.log(`- PORT: ${PORT}`);
console.log(`- DEEPGRAM_API_KEY: ${process.env.DEEPGRAM_API_KEY ? 'Set' : 'Missing'}`);
console.log(`- OPENAI_API_KEY: ${process.env.OPENAI_API_KEY ? 'Set' : 'Missing'}`);
console.log(`- ELEVENLABS_API_KEY: ${process.env.ELEVENLABS_API_KEY ? 'Set' : 'Missing'}`);
console.log(`- ELEVENLABS_VOICE_ID: ${process.env.ELEVENLABS_VOICE_ID ? 'Set' : 'Missing'}`);

// Initialize services with error handling
let deepgram, openai;

try {
  const { createClient } = require('@deepgram/sdk');
  const OpenAI = require('openai');
  
  if (process.env.DEEPGRAM_API_KEY) {
    deepgram = createClient(process.env.DEEPGRAM_API_KEY);
    console.log('✅ Deepgram initialized');
  }
  
  if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log('✅ OpenAI initialized');
  }
} catch (error) {
  console.error('❌ Error initializing services:', error.message);
}

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Basic error handling middleware
app.use((error, req, res, next) => {
  console.error('❌ Express error:', error);
  res.status(500).json({ error: 'Internal server error', message: error.message });
});

// ---------------------------------------------------------------------------------
// Simplified TwiML Endpoint
// ---------------------------------------------------------------------------------

app.post('/twiml', (req, res) => {
  try {
    console.log('📞 Incoming call received');
    const host = req.get('host');
    const websocketUrl = `wss://${host}`;
    
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${websocketUrl}" />
  </Connect>
</Response>`;
    
    res.type('text/xml');
    res.send(twiml);
    console.log('✅ TwiML response sent');
  } catch (error) {
    console.error('❌ TwiML endpoint error:', error);
    res.status(500).send('Error');
  }
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    env: {
      deepgram: !!process.env.DEEPGRAM_API_KEY,
      openai: !!process.env.OPENAI_API_KEY,
      elevenlabs: !!process.env.ELEVENLABS_API_KEY,
      voiceId: !!process.env.ELEVENLABS_VOICE_ID
    }
  });
});

// ---------------------------------------------------------------------------------
// Simplified Audio Conversion (without complex μ-law for now)
// ---------------------------------------------------------------------------------

const simpleTextToSpeech = async (text, streamSid, ws) => {
  if (!text || !streamSid) {
    console.log('❌ No text or streamSid provided');
    return;
  }
  
  console.log(`🎤 AI Speaking: "${text}"`);
  
  try {
    // Clear buffer first
    ws.send(JSON.stringify({ 
      event: "clear", 
      streamSid: streamSid 
    }));

    // Try the simplest approach first - direct μ-law from ElevenLabs
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_turbo_v2",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5
        },
        output_format: "ulaw_8000" // Try direct μ-law format
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs error: ${response.status} - ${errorText}`);
    }

    const audioBuffer = await response.arrayBuffer();
    const audioData = Buffer.from(audioBuffer);
    
    console.log(`📡 Received ${audioData.length} bytes of μ-law audio`);

    // Send in small chunks
    const CHUNK_SIZE = 640;
    let offset = 0;
    
    while (offset < audioData.length) {
      const chunk = audioData.slice(offset, Math.min(offset + CHUNK_SIZE, audioData.length));
      const audioBase64 = chunk.toString('base64');
      
      const mediaMessage = {
        event: "media",
        streamSid: streamSid,
        media: { payload: audioBase64 }
      };
      
      ws.send(JSON.stringify(mediaMessage));
      offset += CHUNK_SIZE;
      
      await new Promise(resolve => setTimeout(resolve, 80));
    }
    
    console.log('✅ Audio streaming completed');
    
    ws.send(JSON.stringify({ 
      event: "mark", 
      streamSid: streamSid, 
      mark: { name: "speech_complete" }
    }));

  } catch (error) {
    console.error('❌ Text-to-Speech error:', error);
    console.error('Full error:', error.stack);
  }
};

// ---------------------------------------------------------------------------------
// Simplified WebSocket Server
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ 
  server,
  perMessageDeflate: false 
});

wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection');
  
  let streamSid;
  let deepgramLive;

  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      console.log(`📨 Received: ${msg.event}`);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`📞 Stream started: ${streamSid}`);
          console.log(`🎵 Format: ${JSON.stringify(msg.start.mediaFormat)}`);
          
          // Simple welcome message
          await simpleTextToSpeech("Ahoj! Testujeme audio.", streamSid, ws);
          break;
          
        case 'media':
          // Just log for now, don't process
          console.log(`🎵 Audio chunk received: ${msg.media.payload.length} chars`);
          break;
          
        case 'stop':
          console.log('⏹️ Stream stopped');
          break;
          
        case 'mark':
          console.log(`🏷️ Mark: ${JSON.stringify(msg.mark)}`);
          break;
          
        default:
          console.log(`❓ Unknown event: ${msg.event}`);
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error);
      console.error('Raw message:', message.toString());
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket closed');
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

wss.on('error', (error) => {
  console.error('❌ WebSocket Server error:', error);
});

// ---------------------------------------------------------------------------------
// Start Server with Error Handling
// ---------------------------------------------------------------------------------

server.on('error', (error) => {
  console.error('❌ Server error:', error);
});

server.listen(PORT, () => {
  console.log(`🚀 DEBUG Server running on port ${PORT}`);
  console.log(`📞 TwiML: http://localhost:${PORT}/twiml`);
  console.log(`🏥 Health: http://localhost:${PORT}/health`);
  console.log('🎯 Ready for testing!');
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
