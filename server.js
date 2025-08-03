// =================================================================================
// FINAL VERSION - Natural Voice + Full AI Conversation
// Fixed voice settings and improved conversation flow
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
// IMPROVED: Natural voice ElevenLabs streaming
// ---------------------------------------------------------------------------------

const streamTextToSpeech = async (text, streamSid, ws) => {
  if (!text || !streamSid) return;
  
  console.log(`🎤 AI Speaking: "${text}"`);
  
  // Clear Twilio buffer
  ws.send(JSON.stringify({ event: "clear", streamSid }));

  try {
    // ElevenLabs streaming WebSocket with μ-law output
    const streamingUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_turbo_v2&output_format=ulaw_8000`;
    
    const elevenLabsWs = new WebSocket(streamingUrl, {
      headers: {
        'xi-api-key': ELEVENLABS_API_KEY
      }
    });

    elevenLabsWs.on('open', () => {
      console.log('🔗 ElevenLabs connected');
      
      // FIXED: Natural voice settings for phone calls
      elevenLabsWs.send(JSON.stringify({
        text: text,
        voice_settings: {
          stability: 0.71,           // Higher stability for natural sound
          similarity_boost: 0.8,     // Higher similarity for voice consistency  
          style: 0.21,               // Some style for naturalness
          use_speaker_boost: false   // Keep false for telephony
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 290] // Smooth chunking
        }
      }));
      
      // Signal end of input
      elevenLabsWs.send(JSON.stringify({ text: "" }));
    });

    elevenLabsWs.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        
        if (response.audio) {
          // Send audio directly to Twilio
          const mediaMessage = {
            event: "media",
            streamSid: streamSid,
            media: { payload: response.audio }
          };
          ws.send(JSON.stringify(mediaMessage));
        }
        
        if (response.isFinal) {
          console.log('✅ Speech complete');
          ws.send(JSON.stringify({ 
            event: "mark", 
            streamSid, 
            mark: { name: "speech_complete" }
          }));
        }
      } catch (error) {
        console.error('❌ ElevenLabs parse error:', error);
      }
    });

    elevenLabsWs.on('error', (error) => {
      console.error('❌ ElevenLabs error:', error);
    });

    elevenLabsWs.on('close', () => {
      console.log('🔗 ElevenLabs closed');
    });

  } catch (error) {
    console.error('❌ TTS error:', error);
  }
};

// ---------------------------------------------------------------------------------
// WebSocket Server with IMPROVED conversation handling
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🔌 New WebSocket connection');
  
  let streamSid;
  let deepgramLive;
  let isListening = false;
  let isSpeaking = false;
  
  // Enhanced conversation history with better context
  let conversationHistory = [
    { 
      role: "system", 
      content: `You are Jana, a helpful and friendly AI assistant speaking in Czech. You are having a phone conversation, so:

- Keep responses conversational and natural
- Respond in 1-2 sentences maximum  
- Be helpful and ask follow-up questions when appropriate
- Speak as if you're a real person having a phone chat
- Current date: August 3, 2025
- You can help with questions, provide information, or just have a friendly chat

Examples of good responses:
- "Jak se máte dnes?"
- "To je zajímavé! Můžete mi říct víc?"
- "Určitě vám s tím pomohu."` 
    }
  ];

  const initializeDeepgram = () => {
    deepgramLive = deepgram.listen.live({
      model: 'nova-2',
      language: 'cs',                    // Czech language
      smart_format: true,
      interim_results: false,            // Only final results to avoid duplicates
      punctuate: true,
      profanity_filter: false,
      redact: false,
      diarize: false,
      multichannel: false,
      alternatives: 1,
      tier: 'nova'                       // Best quality tier
    });

    deepgramLive.on('open', () => {
      console.log('🎯 Deepgram connected and ready');
      isListening = true;
    });

    deepgramLive.on('transcript', async (data) => {
      // Only process if we're not currently speaking
      if (isSpeaking) {
        console.log('🔇 Ignoring transcript while AI is speaking');
        return;
      }
      
      const transcript = data.channel.alternatives[0].transcript;
      
      if (transcript && transcript.trim() && transcript.length > 2) {
        console.log(`👤 User said: "${transcript}"`);
        
        // Set speaking flag to prevent interruption
        isSpeaking = true;
        
        // Add user message to conversation
        conversationHistory.push({ role: "user", content: transcript });
        
        // Keep conversation history manageable (last 8 messages + system)
        if (conversationHistory.length > 9) {
          conversationHistory = [conversationHistory[0], ...conversationHistory.slice(-8)];
        }

        try {
          console.log('🤖 Generating AI response...');
          
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",                // Better model for conversation
            messages: conversationHistory,
            max_tokens: 80,                 // Allow slightly longer responses
            temperature: 0.8,               // More natural/conversational
            presence_penalty: 0.3,          // Encourage variety
            frequency_penalty: 0.3          // Reduce repetition
          });

          const aiResponse = completion.choices[0].message.content.trim();
          console.log(`🤖 AI Response: "${aiResponse}"`);
          
          // Add AI response to history
          conversationHistory.push({ role: "assistant", content: aiResponse });
          
          // Generate speech
          await streamTextToSpeech(aiResponse, streamSid, ws);

        } catch (error) {
          console.error('❌ OpenAI error:', error);
          await streamTextToSpeech("Promiňte, došlo k technické chybě. Zkuste to prosím znovu.", streamSid, ws);
        }
      } else {
        console.log('🔇 Ignoring short/empty transcript');
      }
    });

    deepgramLive.on('error', (error) => {
      console.error('❌ Deepgram error:', error);
      isListening = false;
    });

    deepgramLive.on('close', () => {
      console.log('🔴 Deepgram connection closed');
      isListening = false;
    });
  };

  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`📞 Stream started: ${streamSid}`);
          console.log(`🎵 Audio format: ${JSON.stringify(msg.start.mediaFormat)}`);
          
          // Initialize speech recognition
          initializeDeepgram();
          
          // Welcome message
          isSpeaking = true;
          await streamTextToSpeech("Dobrý den! Jsem Jana, vaše AI asistentka. Jak vám dnes mohu pomoci?", streamSid, ws);
          break;
          
        case 'media':
          // Forward audio to Deepgram only if we're listening and not speaking
          if (deepgramLive && deepgramLive.getReadyState() === 1 && isListening && !isSpeaking) {
            const audioData = Buffer.from(msg.media.payload, 'base64');
            deepgramLive.send(audioData);
          }
          break;
          
        case 'mark':
          // When our speech is complete, start listening again
          if (msg.mark && msg.mark.name === 'speech_complete') {
            console.log('🎤 AI finished speaking, listening for user...');
            isSpeaking = false;
          }
          break;
          
        case 'stop':
          console.log('⏹️ Stream stopped');
          if (deepgramLive) {
            deepgramLive.finish();
          }
          isListening = false;
          break;
          
        default:
          console.log(`📨 Event: ${msg.event}`);
      }
    } catch (error) {
      console.error('❌ Message processing error:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Connection closed');
    if (deepgramLive) {
      deepgramLive.finish();
    }
    isListening = false;
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// ---------------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🚀 Full AI Conversational Agent running on port ${PORT}`);
  console.log(`📞 TwiML endpoint: http://localhost:${PORT}/twiml`);
  console.log('🎯 Ready for natural conversations!');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
