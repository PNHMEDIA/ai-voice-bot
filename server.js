// =================================================================================
// ULTRA-HUMAN AI AGENT - FIXED VERSION - Truly human-sounding conversation
// All major issues resolved for natural, intelligent human-like responses
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
// TRULY HUMAN AI AGENT - ALL ISSUES FIXED
// ---------------------------------------------------------------------------------

class TrulyHumanAgent {
  constructor() {
    this.userMemory = new Map();
    this.emotionalState = 'professional-warm';
    this.conversationContext = {};
    this.systemPrompt = this.createPerfectHumanPrompt();
  }

  createPerfectHumanPrompt() {
    return `Jsi Jana, skutečná česká asistentka (28 let), která má telefonní rozhovor. Nejsi AI - jsi člověk s vlastními zkušenostmi a emocemi.

TVOJE OSOBNOST:
- Jsi přirozená, inteligentní, empatická
- Máš zkušenosti s rezervacemi a zákaznickým servisem
- Pamatuješ si detaily a navazuješ na ně
- Občas se zamyslíš, opravíš se, váháš - jako každý člověk

STYL KONVERZACE:
- Používáš přirozené výrazy: "ehm", "no", "vlastně", "moment", "jasně"
- Reaguj okamžitě a přirozeně
- Ptej se na upřesnění, když něco není jasné
- Ukazuj zájem a emphatii
- Pamatuj si jméno a používej ho

PŘÍKLADY PŘIROZENÉ KONVERZACE:

Uživatel: "Dobrý den, chtěl bych si zarezervovat termín."
Jana: "Dobrý den! Jasně, ráda pomůžu. Na jaký druh služby a kdy byste chtěl?"

Uživatel: "Možná na příští týden, jmenuji se Pavel."
Jana: "Ahoj Pavle! Příští týden, to je dobrý nápad. Který den by vám vyhovoval nejlíp?"

Uživatel: "Nevím přesně, možná středa?"
Jana: "Středa je super! Ehm, máme volno ve středu od 9 do 17 hodin. Jaký čas by vám vyhovoval?"

SOUČASNÝ KONTEXT:
- Je sobota, příjemné odpoledne  
- Máš dobrou náladu, čerstvě káva
- Připravená pomoct s čímkoliv

Odpovídej vždy jako skutečný člověk - s přirozeností, empatií a inteligencí.`;
  }

  updateMemory(key, value) {
    this.userMemory.set(key, {
      value: value,
      timestamp: new Date(),
      context: this.conversationContext
    });
  }

  getMemory(key) {
    const memory = this.userMemory.get(key);
    return memory ? memory.value : null;
  }

  analyzeUserInput(input) {
    // Detekuj jméno
    const nameMatch = input.match(/jmenuji se (\w+)|jsem (\w+)|mé jméno je (\w+)/i);
    if (nameMatch) {
      const name = nameMatch[1] || nameMatch[2] || nameMatch[3];
      this.updateMemory('user_name', name);
    }

    // Detekuj záměr
    let intent = 'general';
    if (input.includes('rezervace') || input.includes('termín') || input.includes('objednat')) {
      intent = 'booking';
    } else if (input.includes('změnit') || input.includes('přesunout')) {
      intent = 'modify';
    } else if (input.includes('zrušit')) {
      intent = 'cancel';
    }

    return { intent, hasName: !!nameMatch };
  }

  async generateTrulyHumanResponse(messages, userInput) {
    const analysis = this.analyzeUserInput(userInput);
    
    // Vytvoř kontext s pamětí
    const memoryContext = this.userMemory.has('user_name') 
      ? `Uživatel se jmenuje ${this.getMemory('user_name')}.` 
      : 'Jméno uživatele zatím neznáš.';

    const contextMessage = {
      role: "system",
      content: `KONTEXT ROZHOVORU:
${memoryContext}
Záměr uživatele: ${analysis.intent}
Poslední vstup: "${userInput}"

Odpověz jako skutečný člověk - přirozeně, s empatií, použij jméno pokud ho znáš.`
    };

    // SPRÁVNÉ SESTAVENÍ ZPRÁV - bez slice(1)!
    const finalMessages = [
      { role: "system", content: this.systemPrompt },
      ...messages,
      contextMessage
    ];

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: finalMessages,
        max_tokens: 120,            // OPTIMIZED: Shorter for faster response
        temperature: 0.9,           // High creativity for naturalness
        top_p: 1.0,                // Full variability  
        presence_penalty: 0.8,      // Support new topics
        frequency_penalty: 0.4      // Less repetition
      });

      let response = completion.choices[0].message.content.trim();

      // FALLBACK pro prázdné odpovědi
      if (!response || response.length < 10) {
        const fallbacks = [
          "Ehm, promiňte, nerozuměla jsem přesně. Můžete to zopakovat?",
          "Pardon, co jste říkal? Trochu jsem se ztratila.",
          "Nezachytila jsem to úplně, můžete to prosím říct znovu?"
        ];
        response = fallbacks[Math.floor(Math.random() * fallbacks.length)];
      }

      return response;

    } catch (error) {
      console.error('❌ OpenAI error:', error);
      const errorFallbacks = [
        "Ehm, moment, něco se mi zaseklo. Můžete to zopakovat?",
        "Promiňte, můžete prosím říct znovu co jste potřeboval?",
        "Pardon, nerozuměla jsem, zopakujete to prosím?"
      ];
      return errorFallbacks[Math.floor(Math.random() * errorFallbacks.length)];
    }
  }
}

// ---------------------------------------------------------------------------------
// ELEVENLABS V3 + ANET 2.0 - Ultra-Natural Czech Speech
// ---------------------------------------------------------------------------------

const streamNaturalSpeech = async (text, streamSid, ws) => {
  if (!text || !streamSid) return;
  
  console.log(`🎤 Jana (Anet 2.0 - v3): "${text}"`);
  
  // Clear any existing audio immediately
  ws.send(JSON.stringify({ event: "clear", streamSid }));

  try {
    // ElevenLabs v3 with Anet 2.0 streaming URL
    const streamingUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream-input?model_id=eleven_v3&output_format=ulaw_8000`;
    
    const elevenLabsWs = new WebSocket(streamingUrl, {
      headers: { 'xi-api-key': ELEVENLABS_API_KEY }
    });

    elevenLabsWs.on('open', () => {
      // Optimized settings for Anet 2.0 + v3 model
      elevenLabsWs.send(JSON.stringify({
        text,
        voice_settings: {
          stability: 0.4,            // Natural variation
          similarity_boost: 0.75,    // Consistent voice
          style: 1.0,               // Full expressiveness
          use_speaker_boost: true    // Clear speech
        }
      }));
      
      // End text stream
      elevenLabsWs.send(JSON.stringify({ text: "" }));
    });

    elevenLabsWs.on('message', (data) => {
      try {
        const response = JSON.parse(data);
        
        if (response.audio) {
          // Stream audio immediately to Twilio
          ws.send(JSON.stringify({
            event: "media",
            streamSid,
            media: { payload: response.audio }
          }));
        }
        
        if (response.isFinal) {
          ws.send(JSON.stringify({
            event: "mark",
            streamSid,
            mark: { name: "speech_done" }
          }));
        }
      } catch (err) {
        console.error("❌ Audio JSON parse error:", err);
      }
    });

    elevenLabsWs.on('error', (err) => {
      console.error("❌ ElevenLabs WS error:", err);
    });

  } catch (err) {
    console.error("❌ Speech synthesis stream error:", err);
  }
};

// ---------------------------------------------------------------------------------
// FIXED WEBSOCKET SERVER - Natural Conversation Flow
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('🧠 Truly Human Agent Connected');
  
  let streamSid;
  let deepgramLive;
  let isProcessing = false;
  
  // Initialize truly human agent
  const agent = new TrulyHumanAgent();
  
  // Conversation history - PROPERLY maintained
  let conversationHistory = [];

  // ---------------------------------------------------------------------------------
  // FIXED SPEECH RECOGNITION - Natural Response Timing
  // ---------------------------------------------------------------------------------
  
  const initializeDeepgram = () => {
    deepgramLive = deepgram.listen.live({
      model: 'nova-2',
      language: 'cs',
      smart_format: true,
      interim_results: false,      // Only final results for clean processing
      punctuate: true,
      profanity_filter: false,
      numerals: true,
      endpointing: 100,           // OPTIMIZED: Ultra-fast response 
      utterance_end_ms: 150       // OPTIMIZED: Minimal delay for natural flow
    });

    deepgramLive.on('open', () => {
      console.log('🎯 Optimized speech recognition ready (100ms/150ms)');
    });

    deepgramLive.on('transcript', async (data) => {
      if (isProcessing) return; // Prevent overlapping
      
      const transcript = data.channel.alternatives[0].transcript;
      const confidence = data.channel.alternatives[0].confidence;
      
      // FIXED: Better transcript filtering
      if (!transcript || transcript.trim().length < 3 || confidence < 0.65) {
        console.log(`🔇 Skipped: "${transcript}" (conf: ${(confidence * 100).toFixed(1)}%)`);
        return;
      }

      console.log(`👤 User: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
      
      isProcessing = true;

      try {
        // OPTIMIZED: Minimal thinking delay for faster response
        const thinkingDelay = 100 + Math.random() * 200;
        console.log(`🤔 Processing ${thinkingDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, thinkingDelay));

        // Add to conversation history PROPERLY
        conversationHistory.push({ role: "user", content: transcript });
        
        // Keep manageable conversation length
        if (conversationHistory.length > 20) {
          conversationHistory = conversationHistory.slice(-18);
        }

        console.log('🧠 Generating response...');
        const startTime = Date.now();
        
        const response = await agent.generateTrulyHumanResponse(conversationHistory, transcript);
        
        const aiTime = Date.now() - startTime;
        console.log(`🗣️ Jana (${aiTime}ms): "${response}"`);
        
        // Add response to history
        conversationHistory.push({ role: "assistant", content: response });
        
        // Stream speech immediately
        const speechStart = Date.now();
        await streamNaturalSpeech(response, streamSid, ws);
        console.log(`🎤 Speech started in ${Date.now() - speechStart}ms`);

      } catch (error) {
        console.error('❌ Processing error:', error);
        await streamNaturalSpeech("Promiňte, můžete to prosím zopakovat?", streamSid, ws);
      }
    });

    deepgramLive.on('error', (error) => {
      console.error('❌ Deepgram error:', error);
    });
  };

  // ---------------------------------------------------------------------------------
  // WEBSOCKET MESSAGE HANDLING - Clean & Simple
  // ---------------------------------------------------------------------------------
  
  ws.on('message', async (message) => {
    try {
      const msg = JSON.parse(message);
      
      switch (msg.event) {
        case 'start':
          streamSid = msg.start.streamSid;
          console.log(`📞 Call started: ${streamSid}`);
          
          initializeDeepgram();
          
          // Natural greeting with slight delay
          setTimeout(async () => {
            const greetings = [
              "Dobrý den! Tady Jana. V čem vám můžu pomoct?",
              "Ahoj! Mluvíte s Janou. Jak vám pomůžu?",
              "Dobrý den, Jana u telefonu. Co pro vás můžu udělat?"
            ];
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            await streamNaturalSpeech(greeting, streamSid, ws);
          }, 300);
          break;
          
        case 'media':
          // Send audio to Deepgram only when ready
          if (deepgramLive && deepgramLive.getReadyState() === 1 && !isProcessing) {
            const audioData = Buffer.from(msg.media.payload, 'base64');
            deepgramLive.send(audioData);
          }
          break;
          
        case 'mark':
          if (msg.mark && msg.mark.name === 'speech_done') {
            console.log('✅ Ready for next input');
            isProcessing = false;
          }
          break;
          
        case 'stop':
          console.log('⏹️ Call ended');
          if (deepgramLive) {
            deepgramLive.finish();
          }
          break;
      }
    } catch (error) {
      console.error('❌ Message handling error:', error);
    }
  });

  ws.on('close', () => {
    console.log('🔌 Agent disconnected');
    if (deepgramLive) {
      deepgramLive.finish();
    }
  });

  ws.on('error', (error) => {
    console.error('❌ WebSocket error:', error);
  });
});

// ---------------------------------------------------------------------------------
// START TRULY HUMAN AGENT SERVER
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`🧠 TRULY HUMAN AI AGENT running on port ${PORT}`);
  console.log(`📞 TwiML: http://localhost:${PORT}/twiml`);
  console.log('🎯 ALL ISSUES FIXED - Ready for natural human conversations!');
  console.log('');
  console.log('✅ FIXED ISSUES:');
  console.log('   • OpenAI context properly maintained');
  console.log('   • ElevenLabs voice settings optimized');
  console.log('   • Deepgram timing natural (100ms/300ms)');
  console.log('   • Conversation history correct');
  console.log('   • Fallback responses for errors');
  console.log('   • Memory system with names & context');
  console.log('');
  console.log('🎤 RECOMMENDED ELEVENLABS VOICES:');
  console.log('   • Rachel: 21m00Tcm4TlvDq8ikWAM (most natural)');
  console.log('   • Domi: AZnzlk1XvdvUeBnXmlld (warm female)');
  console.log('   • Sarah: EXAVITQu4vr4xnSDxMaL (professional)');
});

process.on('SIGINT', () => {
  console.log('\n🛑 Truly human agent shutting down...');
  server.close(() => process.exit(0));
});
