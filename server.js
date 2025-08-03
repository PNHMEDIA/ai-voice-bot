// =================================================================================
// FIXED Server - Properly converts ElevenLabs audio to Twilio µ-law format
// This eliminates the rumbling by using correct audio format conversion
// =================================================================================

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk');
const OpenAI = require('openai');

// ---------------------------------------------------------------------------------
// 1. Configuration and Validation
// ---------------------------------------------------------------------------------

const PORT = process.env.PORT || 8080;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

if (!DEEPGRAM_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  console.error("FATAL ERROR: Missing required API keys in .env file");
  process.exit(1);
}

const deepgram = createClient(DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------------
// 2. Audio Conversion Functions - CRITICAL FIX
// ---------------------------------------------------------------------------------

// µ-law encoding lookup table
const MULAW_TABLE = [
  0, 0, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 3,
  4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6, 6,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7,
  7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7, 7
];

// Convert 16-bit PCM sample to µ-law
function linearToMulaw(pcm) {
  const BIAS = 0x84;
  const CLIP = 32635;
  
  let sign = (pcm >> 8) & 0x80;
  if (sign) pcm = -pcm;
  if (pcm > CLIP) pcm = CLIP;
  
  pcm += BIAS;
  let exp = MULAW_TABLE[(pcm >> 7) & 0xFF];
  let mantissa = (pcm >> (exp + 3)) & 0x0F;
  
  return ~(sign | (exp << 4) | mantissa);
}

// Convert PCM buffer to µ-law
function pcmToMulaw(pcmBuffer) {
  const mulawBuffer = Buffer.alloc(pcmBuffer.length / 2);
  
  for (let i = 0; i < pcmBuffer.length; i += 2) {
    const pcmSample = pcmBuffer.readInt16LE(i);
    mulawBuffer[i / 2] = linearToMulaw(pcmSample);
  }
  
  return mulawBuffer;
}

// ---------------------------------------------------------------------------------
// 3. TwiML Endpoint
// ---------------------------------------------------------------------------------

app.post('/twiml', (req, res) => {
  console.log('📞 Incoming call received');
  const host = req.get('host');
  const websocketUrl = `wss://${host}`;
  
  const twiml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Connect>
        <Stream url="${websocketUrl}" />
      </Connect>
    </Response>
  `;
  
  res.type('text/xml');
  res.send(twiml);
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------------
// 4. WebSocket Server with FIXED Audio Processing
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection established');
  
  let deepgramLive;
  let streamSid;
  let conversationHistory = [
    { 
      role: "system", 
      content: "You are Jana, a helpful AI assistant speaking in Czech. Be conversational, friendly, and very concise - keep responses to 1-2 short sentences maximum for phone calls. Current date is August 3, 2025." 
    }
  ];

  // ---------------------------------------------------------------------------------
  // CRITICAL FIX: Proper audio format conversion for Twilio
  // ---------------------------------------------------------------------------------
  
  const streamTextToSpeech = async (text) => {
    if (!text || !streamSid) {
      console.log('❌ No text or streamSid provided');
      return;
    }
    
    console.log(`🎤 AI Speaking: "${text}"`);
    
    // Clear Twilio's audio buffer
    ws.send(JSON.stringify({ 
      event: "clear", 
      streamSid: streamSid 
    }));

    try {
      // STEP 1: Get PCM audio from ElevenLabs (this is the key fix)
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2",
          voice_settings: {
            stability: 0.75,
            similarity_boost: 0.5,
            style: 0.0,
            use_speaker_boost: false
          },
          output_format: "pcm_16000" // CRITICAL: Get raw PCM data, not MP3
        }),
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      // STEP 2: Get the raw PCM audio data
      const pcmArrayBuffer = await response.arrayBuffer();
      const pcmBuffer = Buffer.from(pcmArrayBuffer);
      
      console.log(`📡 Received ${pcmBuffer.length} bytes of PCM data`);

      // STEP 3: Convert PCM to µ-law format (this eliminates the rumbling!)
      const mulawBuffer = pcmToMulaw(pcmBuffer);
      
      console.log(`🔄 Converted to ${mulawBuffer.length} bytes of µ-law data`);

      // STEP 4: Send µ-law audio to Twilio in chunks
      const CHUNK_SIZE = 640; // Optimal chunk size for 8kHz µ-law (80ms of audio)
      let offset = 0;
      
      while (offset < mulawBuffer.length) {
        const chunk = mulawBuffer.slice(offset, Math.min(offset + CHUNK_SIZE, mulawBuffer.length));
        const audioBase64 = chunk.toString('base64');
        
        const mediaMessage = {
          event: "media",
          streamSid: streamSid,
          media: { payload: audioBase64 }
        };
        
        ws.send(JSON.stringify(mediaMessage));
        offset += CHUNK_SIZE;
        
        // Timing is critical for smooth playback
        await new Promise(resolve => setTimeout(resolve, 80)); // 80ms per chunk
      }
      
      console.log('✅ µ-law audio streaming completed');
      
      // Mark end of speech
      ws.send(JSON.stringify({ 
        event: "mark", 
        streamSid: streamSid, 
        mark: { name: "bot_finished_speaking" }
      }));

    } catch (error) {
      console.error('❌ Text-to-Speech error:', error.message);
    }
  };

  // ---------------------------------------------------------------------------------
  // Initialize Deepgram Connection
  // ---------------------------------------------------------------------------------
  
  const initializeDeepgram = () => {
    deepgramLive = deepgram.listen.live({
      model: 'nova-2',
      language: 'cs',
      smart_format: true,
      interim_results: false,
      punctuate: true
    });

    deepgramLive.on('open', () => {
      console.log('🎯 Deepgram connection opened');
    });

    deepgramLive.on('error', (error) => {
      console.error('❌ Deepgram error:', error);
    });

    deepgramLive.on('transcript', async (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      
      if (transcript && transcript.trim()) {
        console.log(`👤 User said: "${transcript}"`);
        
        conversationHistory.push({ role: "user", content: transcript });
        
        // Keep conversation history manageable
        if (conversationHistory.length > 10) {
          conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-8)];
        }

        try {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: conversationHistory,
            max_tokens: 50, // Very short responses for phone calls
            temperature: 0.7
          });

          const aiResponse = completion.choices[0].message.content.trim();
          console.log(`🤖 AI Response: "${aiResponse}"`);
          
          conversationHistory.push({ role: "assistant", content: aiResponse });
          
          await streamTextToSpeech(aiResponse);

        } catch (error) {
          console.error('❌ OpenAI error:', error.message);
          await streamTextToSpeech("Promiňte, došlo k chybě.");
        }
      }
    });
  };

  // ---------------------------------------------------------------------------------
  // Handle Twilio WebSocket Messages
  // ---------------------------------------------------------------------------------
  
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`📞 Twilio stream started (SID: ${streamSid})`);
          console.log(`🎵 Media format: ${msg.start.mediaFormat.encoding} @ ${msg.start.mediaFormat.sampleRate}Hz`);
          
          initializeDeepgram();
          
          await streamTextToSpeech("Dobrý den! Jsem Jana. Jak vám mohu pomoci?");
          break;
          
        case 'media':
          if (deepgramLive && deepgramLive.getReadyState() === 1) {
            const audioData = Buffer.from(msg.media.payload, 'base64');
            deepgramLive.send(audioData);
          }
          break;
          
        case 'mark':
          console.log(`🏷️ Mark received: ${JSON.stringify(msg.mark)}`);
          break;
          
        case 'stop':
          console.log('⏹️ Twilio stream stopped');
          if (deepgramLive) {
            deepgramLive.finish();
          }
          break;
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error.message);
    }
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    if (deepgramLive) {
      deepgramLive.finish();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
});

// ---------------------------------------------------------------------------------
// 5. Start Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📞 TwiML endpoint: http://localhost:${PORT}/twiml`);
  console.log('🎯 AI Conversational Bot with FIXED µ-law audio conversion is ready!');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
