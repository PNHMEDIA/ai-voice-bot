// =================================================================================
// FINAL FIX - ElevenLabs streaming with proper query parameters
// Based on official ElevenLabs + Twilio solution
// =================================================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk');
const OpenAI = require('openai');

const PORT = process.env.PORT || 8080;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

if (!DEEPGRAM_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  console.error("Missing required API keys");
  process.exit(1);
}

const deepgram = createClient(DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------------
// TwiML Endpoint
// ---------------------------------------------------------------------------------

app.post('/twiml', (req, res) => {
  console.log('📞 Incoming call');
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
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// ---------------------------------------------------------------------------------
// FIXED: ElevenLabs streaming with proper WebSocket and query params
// ---------------------------------------------------------------------------------

const streamTextToSpeech = async (text, streamSid, ws) => {
  if (!text || !streamSid) return;
  
  console.log(`🎤 Speaking: "${text}"`);
  
  // Clear Twilio buffer
  ws.send(JSON.stringify({ event: "clear", streamSid }));

  try {
    // CRITICAL FIX: Use ElevenLabs streaming WebSocket with proper query params
    const streamingUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_turbo_v2&output_format=ulaw_8000`;
    
    const elevenLabsWs = new WebSocket(streamingUrl, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    elevenLabsWs.on('open', () => {
      console.log('🔗 ElevenLabs WebSocket connected');
      
      // Send the text to convert
      elevenLabsWs.send(JSON.stringify({
        text: text,
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
          style: 0.0,
          use_speaker_boost: false
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290]
        }
      }));
      
      // Signal end of input
      elevenLabsWs.send(JSON.stringify({ text: "" }));
    });

    elevenLabsWs.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        
        if (response.audio) {
          // Direct μ-law audio from ElevenLabs - send straight to Twilio
          const mediaMessage = {
            event: "media",
            streamSid: streamSid,
            media: { payload: response.audio }
          };
          ws.send(JSON.stringify(mediaMessage));
        }
        
        if (response.isFinal) {
          console.log('✅ ElevenLabs streaming complete');
          ws.send(JSON.stringify({ 
            event: "mark", 
            streamSid, 
            mark: { name: "speech_complete" }
          }));
        }
      } catch (error) {
        console.error('❌ ElevenLabs message parse error:', error);
      }
    });

    elevenLabsWs.on('error', (error) => {
      console.error('❌ ElevenLabs WebSocket error:', error);
    });

    elevenLabsWs.on('close', () => {
      console.log('🔗 ElevenLabs WebSocket closed');
    });

  } catch (error) {
    console.error('❌ Streaming error:', error);
  }
};

// ---------------------------------------------------------------------------------
// WebSocket Server
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔌 New connection');
  
  let streamSid;
  let deepgramLive;
  let conversationHistory = [
    { 
      role: "system", 
      content: "You are Jana, a helpful AI assistant speaking in Czech. Be very brief - maximum 10 words per response for phone calls." 
    }
  ];

  const initializeDeepgram = () => {
    deepgramLive = deepgram.listen.live({
      model: 'nova-2',
      language: 'cs',
      smart_format: true,
      interim_results: false
    });

    deepgramLive.on('open', () => {
      console.log('🎯 Deepgram connected');
    });

    deepgramLive.on('transcript', async (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      
      if (transcript && transcript.trim()) {
        console.log(`👤 User: "${transcript}"`);
        
        conversationHistory.push({ role: "user", content: transcript });
        
        if (conversationHistory.length > 6) {
          conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-4)];
        }

        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: conversationHistory,
            max_tokens: 30,
            temperature: 0.7
          });

          const aiResponse = completion.choices[0].message.content.trim();
          console.log(`🤖 AI: "${aiResponse}"`);
          
          conversationHistory.push({ role: "assistant", content: aiResponse });
          
          await streamTextToSpeech(aiResponse, streamSid, ws);

        } catch (error) {
          console.error('❌ OpenAI error:', error);
          await streamTextToSpeech("Promiňte, chyba.", streamSid, ws);
        }
      }
    });

    deepgramLive.on('error', (error) => {
      console.error('❌ Deepgram error:', error);
    });
  };

  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`📞 Stream started: ${streamSid}`);
          
          initializeDeepgram();
          
          // Simple welcome
          await streamTextToSpeech("Ahoj! Jsem Jana.", streamSid, ws);
          break;
          
        case 'media':
          if (deepgramLive && deepgramLive.getReadyState() === 1) {
            const audioData = Buffer.from(msg.media.payload, 'base64');
            deepgramLive.send(audioData);
          }
          break;
          
        case 'stop':
          console.log('⏹️ Stream stopped');
          if (deepgramLive) {
            deepgramLive.finish();
          }
          break;
      }
    } catch (error) {
      console.error('❌ Message error:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Connection closed');
    if (deepgramLive) {
      deepgramLive.finish();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// ---------------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📞 TwiML: http://localhost:${PORT}/twiml`);
  console.log('🎯 Fixed ElevenLabs streaming ready!');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down...');
  server.close(() => process.exit(0));
});
