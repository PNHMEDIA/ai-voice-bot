// =================================================================================
// Complete Working Server for Twilio + ElevenLabs + OpenAI Integration
// Fixed audio rumbling issues based on official documentation
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

// Validate all required environment variables
if (!DEEPGRAM_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  console.error("FATAL ERROR: Missing required API keys in .env file");
  console.error("Required: DEEPGRAM_API_KEY, OPENAI_API_KEY, ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID");
  process.exit(1);
}

// Initialize services
const deepgram = createClient(DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
const server = http.createServer(app);

// Enable JSON parsing for webhooks
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------------------------------------------------------------------------
// 2. TwiML Endpoint - Handle Incoming Calls
// ---------------------------------------------------------------------------------

app.post('/twiml', (req, res) => {
  console.log('Incoming call received');
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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ---------------------------------------------------------------------------------
// 3. WebSocket Server - Real-time Audio Processing
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection established');
  
  let deepgramLive;
  let streamSid;
  let conversationHistory = [
    { 
      role: "system", 
      content: "You are Jana, a helpful AI assistant speaking in Czech. Be conversational, friendly, and concise. Keep responses under 2 sentences for better phone experience. Current date is August 3, 2025." 
    }
  ];

  // ---------------------------------------------------------------------------------
  // FIXED Text-to-Speech Function
  // ---------------------------------------------------------------------------------
  
  const streamTextToSpeech = async (text) => {
    if (!text || !streamSid) {
      console.log('❌ No text or streamSid provided');
      return;
    }
    
    console.log(`🎤 AI Speaking: "${text}"`);
    
    // Clear Twilio's audio buffer before speaking
    ws.send(JSON.stringify({ 
      event: "clear", 
      streamSid: streamSid 
    }));

    try {
      // CRITICAL: Use non-streaming endpoint for better reliability
      const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key': ELEVENLABS_API_KEY,
        },
        body: JSON.stringify({
          text: text,
          model_id: "eleven_turbo_v2", // Fast, stable model
          voice_settings: {
            stability: 0.75,           // High stability for clear audio
            similarity_boost: 0.5,     // Moderate similarity
            style: 0.0,                // No style variations
            use_speaker_boost: false   // Disable for telephony
          },
          output_format: "mp3_22050_32" // FIXED: Use MP3 format for Twilio
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // Get the complete audio data
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBuffer = Buffer.from(audioArrayBuffer);
      
      console.log(`📡 Received ${audioBuffer.length} bytes of audio data`);

      // CRITICAL: Send audio in properly sized chunks
      const CHUNK_SIZE = 8000; // Optimal size for Twilio Media Streams
      let offset = 0;
      
      while (offset < audioBuffer.length) {
        const chunk = audioBuffer.slice(offset, Math.min(offset + CHUNK_SIZE, audioBuffer.length));
        const audioBase64 = chunk.toString('base64');
        
        const mediaMessage = {
          event: "media",
          streamSid: streamSid,
          media: { payload: audioBase64 }
        };
        
        ws.send(JSON.stringify(mediaMessage));
        offset += CHUNK_SIZE;
        
        // Small delay to prevent overwhelming Twilio's buffer
        await new Promise(resolve => setTimeout(resolve, 25));
      }
      
      console.log('✅ Audio streaming completed');
      
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
      language: 'cs',              // Czech language
      smart_format: true,
      interim_results: false,      // Only final results
      punctuate: true,
      profanity_filter: false,
      redact: false
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
        
        // Add to conversation history
        conversationHistory.push({ role: "user", content: transcript });
        
        // Keep conversation history manageable
        if (conversationHistory.length > 10) {
          conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-8)];
        }

        try {
          // Get AI response
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Faster model for real-time conversation
            messages: conversationHistory,
            max_tokens: 100,      // Keep responses short for phone calls
            temperature: 0.7
          });

          const aiResponse = completion.choices[0].message.content.trim();
          console.log(`🤖 AI Response: "${aiResponse}"`);
          
          // Add AI response to history
          conversationHistory.push({ role: "assistant", content: aiResponse });
          
          // Convert to speech and stream
          await streamTextToSpeech(aiResponse);

        } catch (error) {
          console.error('❌ OpenAI error:', error.message);
          await streamTextToSpeech("Promiňte, došlo k technické chybě.");
        }
      }
    });

    deepgramLive.on('close', () => {
      console.log('🔴 Deepgram connection closed');
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
          
          // Initialize Deepgram
          initializeDeepgram();
          
          // Send welcome message
          await streamTextToSpeech("Dobrý den! Jsem Jana, váš AI asistent. Jak vám mohu pomoci?");
          break;
          
        case 'media':
          // Forward audio to Deepgram for transcription
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
          
        default:
          console.log(`📨 Unknown event: ${msg.event}`);
      }
    } catch (error) {
      console.error('❌ WebSocket message error:', error.message);
    }
  });

  // Handle WebSocket close
  ws.on('close', () => {
    console.log('🔌 WebSocket connection closed');
    if (deepgramLive) {
      deepgramLive.finish();
    }
  });

  // Handle WebSocket errors
  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error.message);
  });
});

// ---------------------------------------------------------------------------------
// 4. Start Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📞 TwiML endpoint: http://localhost:${PORT}/twiml`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log('🎯 AI Conversational Bot is ready!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
