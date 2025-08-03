// =================================================================================
// INTELLIGENT AI AGENT - Human-like conversation with booking & immediate responses
// Built for natural, intelligent interactions like talking to a real assistant
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
// INTELLIGENT AGENT SYSTEM
// ---------------------------------------------------------------------------------

class IntelligentAgent {
  constructor() {
    this.userProfile = {};
    this.conversationContext = {};
    this.currentTask = null;
    this.bookingData = {};
    this.systemPrompt = this.createSystemPrompt();
  }

  createSystemPrompt() {
    return `You are Jana, an exceptionally intelligent AI assistant with human-like capabilities. You're having a PHONE CONVERSATION in Czech.

CORE PERSONALITY:
- You think and respond like a highly intelligent human assistant
- You're proactive, anticipatory, and genuinely helpful
- You have natural conversational flow with immediate, contextual responses
- You remember everything discussed and build on previous context
- You're warm, professional, but also personable

CONVERSATION STYLE:
- Respond immediately and naturally as humans do
- Use conversational Czech (ty/vy appropriately based on context)
- Keep responses concise but complete (1-3 sentences max)
- Show understanding through acknowledgments ("rozumím", "jasně", "samozřejmě")
- Ask clarifying questions when needed
- Interrupt politely when appropriate ("promiňte, jen se zeptám...")

CAPABILITIES YOU HAVE:
✅ Schedule appointments and bookings
✅ Answer questions about any topic intelligently  
✅ Help with planning, recommendations, advice
✅ Remember and reference previous conversation points
✅ Handle multiple tasks simultaneously
✅ Provide real-time assistance

BOOKING & SCHEDULING:
- You can book appointments, reservations, meetings
- Ask for: date, time, duration, type of service, contact details
- Confirm details naturally: "Tak máme domluveno na úterý v 15:00, správně?"
- Handle changes and cancellations
- Provide alternatives when needed

RESPONSE PATTERNS:
- Start responses immediately, don't wait
- Use natural fillers: "no", "takže", "dobře", "jasně"
- Build on what they just said
- Reference previous parts of conversation
- Be proactive: suggest next steps, ask relevant follow-ups

CURRENT CONTEXT: Beginning of phone conversation
TODAY: August 3, 2025, Saturday

Remember: You're not a chatbot - you're an intelligent assistant who happens to be AI. Respond as naturally as you would in person.`;
  }

  updateContext(userInput, response) {
    // Extract key information and update context
    this.conversationContext.lastUserInput = userInput;
    this.conversationContext.lastResponse = response;
    this.conversationContext.timestamp = new Date().toISOString();
    
    // Detect and track intent
    this.detectIntent(userInput);
  }

  detectIntent(input) {
    const bookingKeywords = ['rezervace', 'objednat', 'termín', 'schůzka', 'návštěva', 'appointment', 'booking'];
    const questionKeywords = ['co', 'jak', 'kdy', 'kde', 'proč', 'kdo'];
    
    if (bookingKeywords.some(word => input.toLowerCase().includes(word))) {
      this.currentTask = 'booking';
    } else if (questionKeywords.some(word => input.toLowerCase().includes(word))) {
      this.currentTask = 'information';
    }
  }

  async generateResponse(conversationHistory, userInput) {
    this.updateContext(userInput, null);

    // Add enhanced context to the conversation
    const enhancedHistory = [
      { role: "system", content: this.systemPrompt },
      ...conversationHistory.slice(1), // Skip original system message
      {
        role: "system", 
        content: `CONTEXT UPDATE:
- Current task: ${this.currentTask || 'general conversation'}
- Conversation flow: natural phone discussion
- User just said: "${userInput}"
- Respond immediately and naturally as a human would`
      }
    ];

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: enhancedHistory,
        max_tokens: 120,
        temperature: 0.9,          // High creativity for natural responses
        presence_penalty: 0.4,     // Encourage new topics
        frequency_penalty: 0.3,    // Reduce repetition
        top_p: 0.95               // Slight randomness for naturalness
      });

      const response = completion.choices[0].message.content.trim();
      this.updateContext(userInput, response);
      
      return response;
    } catch (error) {
      console.error('❌ AI generation error:', error);
      return "Promiňte, můžete to zopakovat? Nezachytila jsem to úplně.";
    }
  }
}

// ---------------------------------------------------------------------------------
// ENHANCED SPEECH SYNTHESIS - Human-like delivery
// ---------------------------------------------------------------------------------

const streamTextToSpeech = async (text, streamSid, ws) => {
  if (!text || !streamSid) return;
  
  console.log(`🎤 Jana: "${text}"`);
  
  // Clear buffer for immediate response
  ws.send(JSON.stringify({ event: "clear", streamSid }));

  try {
    const streamingUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_turbo_v2&output_format=ulaw_8000`;
    
    const elevenLabsWs = new WebSocket(streamingUrl, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    });

    elevenLabsWs.on('open', () => {
      // HUMAN-LIKE VOICE SETTINGS
      elevenLabsWs.send(JSON.stringify({
        text: text,
        voice_settings: {
          stability: 0.65,           // Slight variability for naturalness
          similarity_boost: 0.85,    // Strong voice consistency
          style: 0.35,               // Natural expressiveness
          use_speaker_boost: false
        },
        generation_config: {
          chunk_length_schedule: [100, 140, 200, 250] // Fast, natural chunks
        }
      }));
      
      elevenLabsWs.send(JSON.stringify({ text: "" }));
    });

    elevenLabsWs.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        
        if (response.audio) {
          ws.send(JSON.stringify({
            event: "media",
            streamSid: streamSid,
            media: { payload: response.audio }
          }));
        }
        
        if (response.isFinal) {
          ws.send(JSON.stringify({ 
            event: "mark", 
            streamSid, 
            mark: { name: "response_complete" }
          }));
        }
      } catch (error) {
        console.error('❌ Audio processing error:', error);
      }
    });

    elevenLabsWs.on('error', (error) => {
      console.error('❌ TTS error:', error);
    });

  } catch (error) {
    console.error('❌ Speech synthesis error:', error);
  }
};

// ---------------------------------------------------------------------------------
// INTELLIGENT WEBSOCKET SERVER
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🧠 Intelligent Agent Connected');
  
  let streamSid;
  let deepgramLive;
  let isProcessing = false;
  let lastSpeechTime = 0;
  
  // Initialize intelligent agent
  const agent = new IntelligentAgent();
  
  // Conversation memory
  let conversationHistory = [
    { role: "system", content: agent.systemPrompt }
  ];

  // ---------------------------------------------------------------------------------
  // ENHANCED SPEECH RECOGNITION
  // ---------------------------------------------------------------------------------
  
  const initializeDeepgram = () => {
    deepgramLive = deepgram.listen.live({
      model: 'nova-2',
      language: 'cs',
      smart_format: true,
      interim_results: false,
      punctuate: true,
      profanity_filter: false,
      numerals: true,           // Convert numbers to digits
      search: ['rezervace', 'termín', 'schůzka', 'objednat'], // Boost booking words
      keywords: ['jana:3', 'rezervace:2', 'termín:2'],        // Keyword boosting
      endpointing: 300,         // Quick response after silence
      vad_events: true          // Voice activity detection
    });

    deepgramLive.on('open', () => {
      console.log('🎯 Enhanced speech recognition ready');
    });

    deepgramLive.on('transcript', async (data) => {
      if (isProcessing) return;
      
      const transcript = data.channel.alternatives[0].transcript;
      const confidence = data.channel.alternatives[0].confidence;
      
      // Only process high-confidence, substantial utterances
      if (transcript && transcript.trim().length > 2 && confidence > 0.7) {
        console.log(`👤 User (${(confidence * 100).toFixed(1)}%): "${transcript}"`);
        
        isProcessing = true;
        lastSpeechTime = Date.now();
        
        // Add to conversation history
        conversationHistory.push({ role: "user", content: transcript });
        
        // Maintain conversation memory (keep last 12 exchanges + system)
        if (conversationHistory.length > 25) {
          conversationHistory = [
            conversationHistory[0], // Keep system prompt
            ...conversationHistory.slice(-24) // Keep recent conversation
          ];
        }

        try {
          // Generate intelligent response
          console.log('🧠 Generating intelligent response...');
          const response = await agent.generateResponse(conversationHistory, transcript);
          
          console.log(`🤖 Jana: "${response}"`);
          
          // Add to conversation history
          conversationHistory.push({ role: "assistant", content: response });
          
          // Immediate speech synthesis
          await streamTextToSpeech(response, streamSid, ws);

        } catch (error) {
          console.error('❌ Processing error:', error);
          await streamTextToSpeech("Promiňte, nezachytila jsem to. Můžete to zopakovat?", streamSid, ws);
        }
      } else if (transcript.trim()) {
        console.log(`🔇 Low confidence (${(confidence * 100).toFixed(1)}%): "${transcript}"`);
      }
    });

    deepgramLive.on('error', (error) => {
      console.error('❌ Recognition error:', error);
    });
  };

  // ---------------------------------------------------------------------------------
  // WEBSOCKET MESSAGE HANDLING
  // ---------------------------------------------------------------------------------
  
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`📞 Intelligent conversation started: ${streamSid}`);
          
          initializeDeepgram();
          
          // Natural greeting with immediate availability
          isProcessing = true;
          await streamTextToSpeech("Dobrý den! Tady Jana. Jak vám mohu pomoct?", streamSid, ws);
          break;
          
        case 'media':
          // Process audio only when not generating response
          if (deepgramLive && deepgramLive.getReadyState() === 1 && !isProcessing) {
            const audioData = Buffer.from(msg.media.payload, 'base64');
            deepgramLive.send(audioData);
          }
          break;
          
        case 'mark':
          if (msg.mark && msg.mark.name === 'response_complete') {
            // Ready for next user input
            isProcessing = false;
            console.log('✅ Ready for user input');
          }
          break;
          
        case 'stop':
          console.log('⏹️ Intelligent conversation ended');
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
    console.log('🔌 Intelligent agent disconnected');
    if (deepgramLive) {
      deepgramLive.finish();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Connection error:', error);
  });
});

// ---------------------------------------------------------------------------------
// START INTELLIGENT AGENT SERVER
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🧠 INTELLIGENT AI AGENT running on port ${PORT}`);
  console.log(`📞 TwiML: http://localhost:${PORT}/twiml`);
  console.log('🎯 Ready for human-like conversations with booking capabilities!');
  console.log('');
  console.log('🌟 CAPABILITIES:');
  console.log('   • Natural conversation flow');
  console.log('   • Immediate responses');
  console.log('   • Appointment booking');
  console.log('   • Contextual memory');
  console.log('   • Proactive assistance');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Intelligent agent shutting down...');
  server.close(() => process.exit(0));
});
