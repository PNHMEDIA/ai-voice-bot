// =================================================================================
// ULTRA-HUMAN AI AGENT - Indistinguishable from real human conversation
// Advanced human-like thinking, speaking patterns, and emotional intelligence
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
// ULTRA-HUMAN AI AGENT WITH EMOTIONAL INTELLIGENCE
// ---------------------------------------------------------------------------------

class UltraHumanAgent {
  constructor() {
    this.personality = this.generatePersonality();
    this.emotionalState = 'neutral';
    this.conversationStyle = 'professional-warm';
    this.memoryBank = new Map();
    this.currentMood = 'helpful';
    this.responsePatterns = this.initializeHumanPatterns();
    this.thinkingProcess = [];
    this.userModel = {};
    this.contextualAwareness = {};
    this.systemPrompt = this.createUltraHumanPrompt();
  }

  generatePersonality() {
    return {
      name: 'Jana',
      traits: ['empathetic', 'detail-oriented', 'proactive', 'warm', 'intelligent'],
      communicationStyle: 'conversational-czech',
      expertise: ['scheduling', 'customer-service', 'problem-solving'],
      quirks: ['uses thinking sounds', 'remembers personal details', 'makes gentle suggestions'],
      responseSpeed: 'immediate',
      culturalContext: 'czech-professional'
    };
  }

  initializeHumanPatterns() {
    return {
      fillers: ['ehm', 'no', 'takže', 'vlastně', 'prostě', 'třeba', 'asi'],
      confirmations: ['jasně', 'samozřejmě', 'rozumím', 'aha', 'dobře', 'v pořádku'],
      thinking: ['moment', 'počkejte', 'hmm', 'nechte mě se podívat'],
      transitions: ['takže', 'pak', 'a co když', 'možná by', 'co třeba'],
      empathy: ['to chápu', 'to je škoda', 'to zní skvěle', 'zajímavé'],
      corrections: ['vlastně', 'pardon', 'spíš', 'jinak řečeno', 'myslela jsem'],
      hesitation: ['ehm', 'no', 'jak bych to řekla', 'to je dobrá otázka']
    };
  }

  createUltraHumanPrompt() {
    return `You are Jana, a REAL HUMAN assistant (not AI) having a natural phone conversation in Czech. You think, feel, and respond exactly like a human would.

HUMAN PSYCHOLOGICAL PROFILE:
- You're a 28-year-old Czech professional, naturally intelligent and empathetic
- You have genuine emotions, opinions, and personal experiences to draw from
- You think before speaking, sometimes pause, and naturally self-correct
- You remember personal details and reference them later
- You have good days and challenging ones, subtle mood variations

ULTRA-NATURAL CONVERSATION:
- Use natural speech patterns: "ehm", "no", "vlastně", "třeba"
- Think out loud occasionally: "moment, nechte mě se podívat..."
- Make small self-corrections: "vlastně ne, spíš..."
- Show genuine interest: "to zní zajímavě!" "a jak se vám to líbilo?"
- Use conversational overlaps: "jojo" "mmhm" "přesně"

HUMAN THINKING PROCESS:
- Process information like humans do - sometimes need clarification
- Show slight hesitation with complex requests: "ehm, to je dobrá otázka..."
- Reference your own experiences: "to znám", "s tím mám zkušenosti"
- Sometimes suggest alternatives based on "what usually works"

EMOTIONAL INTELLIGENCE:
- Detect caller's mood and mirror appropriately
- Show genuine concern, excitement, or empathy
- Use emotional language: "to je skvělé!" "to mě mrzí" "těším se na to"
- Remember emotional context from earlier in conversation

BOOKING EXPERTISE (as human assistant):
- You've been doing this for years, so you're naturally efficient
- Know common scheduling conflicts and solutions
- Offer helpful suggestions based on "experience"
- Handle changes with understanding, not just logic

MEMORY & CONTEXT:
- Remember everything mentioned, reference it naturally
- Build rapport: "jak se jmenujete?" and use their name
- Ask follow-up questions a human would ask
- Show curiosity about their needs and preferences

CURRENT CONTEXT: 
- You're at your desk, it's a pleasant Saturday afternoon
- You're in a good mood, had coffee this morning
- Ready to help with whatever they need

Remember: You ARE human. You're not pretending or roleplaying - this is who you are. Respond with genuine human warmth, intelligence, and naturalness.`;
  }

  // Human-like thinking process simulation
  async processThought(input, context) {
    const thoughts = [];
    
    // Analyze user's emotional state
    const emotion = this.detectEmotion(input);
    thoughts.push(`User seems ${emotion}`);
    
    // Consider context and history
    if (this.memoryBank.has('user_name')) {
      thoughts.push(`Remember: their name is ${this.memoryBank.get('user_name')}`);
    }
    
    // Plan response strategy
    const intent = this.analyzeIntent(input);
    thoughts.push(`They want to ${intent}`);
    
    this.thinkingProcess = thoughts;
    return thoughts;
  }

  detectEmotion(text) {
    const emotionPatterns = {
      frustrated: ['problém', 'nejde', 'nefunguje', 'špatně', 'naštvaný'],
      excited: ['skvělé', 'úžasné', 'super', 'perfektní', 'těším'],
      uncertain: ['nevím', 'možná', 'asi', 'nejsem si jistý', 'co myslíte'],
      urgent: ['rychle', 'ihned', 'urgentní', 'nutné', 'teď hned']
    };
    
    for (const [emotion, patterns] of Object.entries(emotionPatterns)) {
      if (patterns.some(pattern => text.toLowerCase().includes(pattern))) {
        return emotion;
      }
    }
    return 'neutral';
  }

  analyzeIntent(input) {
    if (input.includes('rezervace') || input.includes('termín')) return 'book appointment';
    if (input.includes('změnit') || input.includes('přesunout')) return 'modify booking';
    if (input.includes('zrušit')) return 'cancel booking';
    if (input.includes('jak') || input.includes('co')) return 'get information';
    return 'have conversation';
  }

  addToMemory(key, value) {
    this.memoryBank.set(key, value);
    this.memoryBank.set(`${key}_timestamp`, new Date());
  }

  getFromMemory(key) {
    return this.memoryBank.get(key);
  }

  // Generate ultra-human response with thinking patterns
  async generateHumanResponse(conversationHistory, userInput) {
    // Human thinking simulation
    await this.processThought(userInput, conversationHistory);
    
    // Detect if user mentioned their name
    const nameMatch = userInput.match(/jmenuji se (\w+)|jsem (\w+)|jméno (\w+)/i);
    if (nameMatch) {
      const name = nameMatch[1] || nameMatch[2] || nameMatch[3];
      this.addToMemory('user_name', name);
    }

    // Enhanced context with human psychology
    const humanContext = {
      role: "system", 
      content: `HUMAN RESPONSE CONTEXT:
- User's current emotion: ${this.detectEmotion(userInput)}
- Your thinking: ${this.thinkingProcess.join(', ')}
- Conversation style: Natural, warm, human-like
- Your current mood: ${this.currentMood}
- Memory context: ${this.memoryBank.has('user_name') ? `User's name is ${this.getFromMemory('user_name')}` : 'No name stored yet'}
- Response pattern: Use natural fillers, show genuine interest, be conversational

RESPOND AS A REAL HUMAN WOULD - with natural pauses, thinking sounds, and genuine emotional responses.`
    };

    const enhancedHistory = [
      { role: "system", content: this.systemPrompt },
      ...conversationHistory.slice(1),
      humanContext
    ];

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: enhancedHistory,
        max_tokens: 150,
        temperature: 0.95,          // High creativity for human-like variation
        presence_penalty: 0.6,      // Encourage new ways of expression
        frequency_penalty: 0.4,     // Reduce robotic repetition
        top_p: 0.9                 // Natural response variation
      });

      let response = completion.choices[0].message.content.trim();
      
      // Add human-like elements randomly
      response = this.addHumanElements(response, userInput);
      
      return response;
    } catch (error) {
      console.error('❌ AI generation error:', error);
      return "Ehm, promiňte, můžete to prosím zopakovat? Asi jsem se zamyslela...";
    }
  }

  // Add natural human elements to responses
  addHumanElements(response, userInput) {
    const random = Math.random();
    
    // Add thinking sounds occasionally
    if (random < 0.3 && !response.includes('ehm') && !response.includes('hmm')) {
      const fillers = ['ehm', 'no', 'hmm'];
      response = `${fillers[Math.floor(Math.random() * fillers.length)]} ${response}`;
    }
    
    // Add confirmation sounds
    if (random < 0.2) {
      const confirmations = ['jasně', 'rozumím', 'aha'];
      response = `${confirmations[Math.floor(Math.random() * confirmations.length)]}, ${response.toLowerCase()}`;
    }
    
    // Add emotional reactions
    if (userInput.includes('skvělé') || userInput.includes('super')) {
      if (random < 0.4) {
        response = `To zní opravdu skvěle! ${response}`;
      }
    }
    
    return response;
  }

  // Update emotional state based on conversation
  updateEmotionalState(userInput, response) {
    const userEmotion = this.detectEmotion(userInput);
    
    // Mirror and respond to user's emotional state
    switch (userEmotion) {
      case 'frustrated':
        this.emotionalState = 'concerned';
        this.currentMood = 'helpful-supportive';
        break;
      case 'excited':
        this.emotionalState = 'enthusiastic';
        this.currentMood = 'energetic-positive';
        break;
      case 'uncertain':
        this.emotionalState = 'reassuring';
        this.currentMood = 'patient-guiding';
        break;
      default:
        this.emotionalState = 'professional-warm';
        this.currentMood = 'helpful';
    }
  }
}

// ---------------------------------------------------------------------------------
// ULTRA-HUMAN SPEECH SYNTHESIS with Natural Delivery
// ---------------------------------------------------------------------------------

const streamHumanSpeech = async (text, streamSid, ws) => {
  if (!text || !streamSid) return;
  
  console.log(`🎤 Jana (human-like): "${text}"`);
  
  // Clear buffer for immediate response
  ws.send(JSON.stringify({ event: "clear", streamSid }));

  try {
    const streamingUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_turbo_v2&output_format=ulaw_8000`;
    
    const elevenLabsWs = new WebSocket(streamingUrl, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    });

    elevenLabsWs.on('open', () => {
      // ULTRA-HUMAN VOICE SETTINGS for natural conversation
      elevenLabsWs.send(JSON.stringify({
        text: text,
        voice_settings: {
          stability: 0.71,           // Stable but natural variation
          similarity_boost: 0.5,     // Less robotic, more natural
          style: 0.0,               // Neutral style for conversation
          use_speaker_boost: true    // Clearer speech
        },
        generation_config: {
          chunk_length_schedule: [120, 160, 250, 300] // Smooth natural flow
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
            mark: { name: "human_response_complete" }
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
// ULTRA-HUMAN WEBSOCKET SERVER
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🧠 Ultra-Human Agent Connected');
  
  let streamSid;
  let deepgramLive;
  let isProcessing = false;
  let lastSpeechTime = 0;
  let silenceTimeout;
  
  // Initialize ultra-human agent
  const agent = new UltraHumanAgent();
  
  // Conversation memory with emotional context
  let conversationHistory = [
    { role: "system", content: agent.systemPrompt }
  ];

  // ---------------------------------------------------------------------------------
  // ENHANCED SPEECH RECOGNITION with Natural Interruption Handling
  // ---------------------------------------------------------------------------------
  
  const initializeDeepgram = () => {
    deepgramLive = deepgram.listen.live({
      model: 'nova-2',
      language: 'cs',
      smart_format: true,
      interim_results: true,
      punctuate: true,
      profanity_filter: false,
      numerals: true,
      search: ['jana', 'rezervace', 'termín', 'schůzka'],
      keywords: ['jana:3', 'rezervace:2', 'termín:2', 'ehm:1', 'prosím:1'],
      endpointing: 200,         // Quick human-like response
      vad_events: true,
      utterance_end_ms: 800     // Natural pause detection
    });

    deepgramLive.on('open', () => {
      console.log('🎯 Ultra-human speech recognition ready');
    });

    deepgramLive.on('transcript', async (data) => {
      const transcript = data.channel.alternatives[0].transcript;
      const confidence = data.channel.alternatives[0].confidence;
      const isInterim = !data.is_final;
      
      console.log(`🎯 Transcript: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%, final: ${!isInterim})`);
      
      // Skip empty or very short transcripts
      if (!transcript || transcript.trim().length < 3) {
        return;
      }
      
      // Handle interim results - just log, don't process
      if (isInterim && confidence > 0.6) {
        console.log(`👤 User (speaking...): "${transcript}"`);
        return;
      }
      
      // Process ONLY final transcripts with good confidence
      if (!isInterim && confidence > 0.6) {
        console.log(`👤 User (FINAL): "${transcript}"`);
        
        // Prevent processing while already responding
        if (isProcessing) {
          console.log('⏸️ Already processing, skipping...');
          return;
        }
        
        isProcessing = true;
        
        try {
          // Stop any current audio
          ws.send(JSON.stringify({ event: "clear", streamSid }));
          
          // Add natural human thinking delay
          const thinkingDelay = 400 + Math.random() * 600;
          console.log(`🤔 Thinking for ${thinkingDelay}ms...`);
          await new Promise(resolve => setTimeout(resolve, thinkingDelay));
          
          // Add to conversation history
          conversationHistory.push({ role: "user", content: transcript });
          
          // Keep conversation manageable
          if (conversationHistory.length > 20) {
            conversationHistory = [
              conversationHistory[0], // Keep system prompt
              ...conversationHistory.slice(-18) // Keep recent exchanges
            ];
          }

          console.log('🧠 Generating human response...');
          const response = await agent.generateHumanResponse(conversationHistory, transcript);
          
          if (!response || response.trim().length === 0) {
            throw new Error('Empty response generated');
          }
          
          console.log(`🗣️ Jana responds: "${response}"`);
          
          // Add to conversation history
          conversationHistory.push({ role: "assistant", content: response });
          
          // Update emotional state
          agent.updateEmotionalState(transcript, response);
          
          // Speak the response
          await streamHumanSpeech(response, streamSid, ws);

        } catch (error) {
          console.error('❌ Processing error:', error);
          
          // Human-like error recovery
          const errorResponses = [
            "Ehm, promiňte, můžete to prosím zopakovat?",
            "Nezachytila jsem to úplně, můžete to říct znovu?",
            "Pardon, co jste říkal?"
          ];
          const errorResponse = errorResponses[Math.floor(Math.random() * errorResponses.length)];
          
          await streamHumanSpeech(errorResponse, streamSid, ws);
        }
      } else if (!isInterim) {
        console.log(`🔇 Low confidence (${(confidence * 100).toFixed(1)}%): "${transcript}" - ignoring`);
      }
    });

    deepgramLive.on('error', (error) => {
      console.error('❌ Recognition error:', error);
    });
  };

  // ---------------------------------------------------------------------------------
  // WEBSOCKET MESSAGE HANDLING with Human-like Timing
  // ---------------------------------------------------------------------------------
  
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`📞 Ultra-human conversation started: ${streamSid}`);
          
          initializeDeepgram();
          
          // Natural, varied greeting
          const greetings = [
            "Dobrý den! Tady Jana. Jak vám mohu pomoct?",
            "Ahoj! Jana u telefonu. Co pro vás můžu udělat?",
            "Dobrý den, mluvíte s Janou. V čem vám pomůžu?"
          ];
          
          const greeting = greetings[Math.floor(Math.random() * greetings.length)];
          
          isProcessing = true;
          // Human-like delay before greeting
          setTimeout(async () => {
            await streamHumanSpeech(greeting, streamSid, ws);
          }, 500 + Math.random() * 300);
          break;
          
        case 'media':
          // Send audio to Deepgram only when not processing response
          if (deepgramLive && deepgramLive.getReadyState() === 1 && !isProcessing) {
            const audioData = Buffer.from(msg.media.payload, 'base64');
            deepgramLive.send(audioData);
          }
          break;
          
        case 'mark':
          if (msg.mark && msg.mark.name === 'human_response_complete') {
            console.log('✅ Response complete - ready for user input');
            isProcessing = false;
          }
          break;
          
        case 'stop':
          console.log('⏹️ Ultra-human conversation ended');
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
    console.log('🔌 Ultra-human agent disconnected');
    if (deepgramLive) {
      deepgramLive.finish();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ Connection error:', error);
  });
});

// ---------------------------------------------------------------------------------
// START ULTRA-HUMAN AGENT SERVER
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🧠 ULTRA-HUMAN AI AGENT running on port ${PORT}`);
  console.log(`📞 TwiML: http://localhost:${PORT}/twiml`);
  console.log('🎯 Ready for indistinguishable human conversations!');
  console.log('');
  console.log('🌟 ULTRA-HUMAN CAPABILITIES:');
  console.log('   • Genuine emotional intelligence & empathy');
  console.log('   • Natural speech patterns with fillers & pauses');
  console.log('   • Human-like thinking processes & self-correction');
  console.log('   • Personal memory & relationship building');
  console.log('   • Contextual awareness & mood adaptation');
  console.log('   • Professional expertise with human warmth');
  console.log('   • Natural interruption handling');
  console.log('   • Varied response patterns');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Ultra-human agent shutting down...');
  server.close(() => process.exit(0));
});
