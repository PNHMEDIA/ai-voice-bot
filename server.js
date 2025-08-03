// =================================================================================
// Server-Side Code for a Full Real-Time AI Conversational Bot
// =================================================================================
// This version integrates Deepgram for Speech-to-Text and OpenAI for language
// understanding to create a fully interactive AI assistant.
// It now uses a direct `fetch` call to the ElevenLabs API for improved reliability.

// ---------------------------------------------------------------------------------
// 1. Initialization and Configuration
// ---------------------------------------------------------------------------------

require('dotenv').config();
const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk');
const OpenAI = require('openai');
// We no longer need the ElevenLabs library, but keep it in package.json for now.

// --- Retrieve API Keys and Configuration ---
const PORT = process.env.PORT || 8080;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;
const ELEVENLABS_VOICE_ID = process.env.ELEVENLABS_VOICE_ID;

// --- Validate Essential Keys ---
if (!DEEPGRAM_API_KEY || !OPENAI_API_KEY || !ELEVENLABS_API_KEY || !ELEVENLABS_VOICE_ID) {
  console.error("FATAL ERROR: Missing one or more required API keys. Please check your .env file.");
  process.exit(1);
}

// --- Initialize External Services ---
const deepgram = createClient(DEEPGRAM_API_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const app = express();
const server = http.createServer(app);

// ---------------------------------------------------------------------------------
// 2. TwiML Endpoint for Twilio Call Handling
// ---------------------------------------------------------------------------------

app.post('/twiml', (req, res) => {
  const host = req.get('host');
  const websocketUrl = `wss://${host}`;
  const twiml = `
    <Response>
      <Connect>
        <Stream url="${websocketUrl}" />
      </Connect>
    </Response>
  `;
  res.type('text/xml');
  res.send(twiml);
});

// ---------------------------------------------------------------------------------
// 3. WebSocket Server for Real-Time AI Conversation
// ---------------------------------------------------------------------------------

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('A new WebSocket connection has been established.');
  let deepgramLive;
  let streamSid;
  let conversationHistory = [{ role: "system", content: "You are a helpful and conversational AI assistant speaking in Czech. Your name is Jana. Be concise and friendly. The current date is August 3, 2025." }];

  // --- Function to stream text to ElevenLabs and then to Twilio ---
  const streamTextToSpeech = async (text) => {
    if (!text || !streamSid) return;
    console.log(`AI Speaking: "${text}"`);
    
    // Direct API call to ElevenLabs using fetch
    const elevenLabsUrl = `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID}/stream`;
    const headers = {
      "Content-Type": "application/json",
      "xi-api-key": ELEVENLABS_API_KEY,
    };
    const body = JSON.stringify({
      text: text,
      model_id: "eleven_multilingual_v2",
      output_format: "ulaw_8000" // CRUCIAL: Request audio in the format Twilio needs
    });

    try {
      const response = await fetch(elevenLabsUrl, { method: 'POST', headers: headers, body: body });
      if (!response.ok) {
        throw new Error(`ElevenLabs API returned an error: ${response.status} ${response.statusText}`);
      }
      
      // The response body is a stream. We read it in chunks.
      for await (const chunk of response.body) {
        const audioBase64 = chunk.toString('base64');
        const mediaMessage = {
          event: "media",
          streamSid: streamSid,
          media: { payload: audioBase64 },
        };
        ws.send(JSON.stringify(mediaMessage));
      }
      
      // Send a mark message to indicate the end of the bot's speech
      ws.send(JSON.stringify({ event: "mark", streamSid: streamSid, mark: { name: "bot_finished_speaking" }}));
    } catch (error) {
      console.error("Error during Text-to-Speech streaming:", error);
    }
  };

  // --- DEBUGGING: Temporarily disable Deepgram to isolate the speaking function ---
  // deepgramLive = deepgram.listen.live({
  //   model: 'nova-2',
  //   language: 'cs', // Set language to Czech
  //   smart_format: true,
  //   interim_results: false, // We only want final transcripts
  // });

  // deepgramLive.on('open', () => console.log('Deepgram connection opened.'));
  // deepgramLive.on('error', (error) => console.error('Deepgram error:', error));
  
  // deepgramLive.on('transcript', async (data) => {
  //   const transcript = data.channel.alternatives[0].transcript;
  //   if (transcript) {
  //     console.log(`User said: "${transcript}"`);
  //     conversationHistory.push({ role: "user", content: transcript });

  //     try {
  //       const completion = await openai.chat.completions.create({
  //         model: "gpt-4o",
  //         messages: conversationHistory,
  //       });

  //       const aiResponse = completion.choices[0].message.content;
  //       conversationHistory.push({ role: "assistant", content: aiResponse });
  //       await streamTextToSpeech(aiResponse);

  //     } catch (error) {
  //       console.error("Error getting response from OpenAI:", error);
  //     }
  //   }
  // });

  // --- Handle Messages from Twilio ---
  ws.on('message', async (message) => {
    const msg = JSON.parse(message);
    switch (msg.event) {
      case 'start':
        streamSid = msg.start.streamSid;
        console.log(`Twilio media stream started (SID: ${streamSid})`);
        await streamTextToSpeech("Dobrý den! U telefonu Jana, jak vám mohu pomoci?");
        break;
      case 'media':
        // Forwarding to Deepgram is disabled for this test
        // if (deepgramLive && deepgramLive.getReadyState() === 1) {
        //   deepgramLive.send(Buffer.from(msg.media.payload, 'base64'));
        // }
        break;
      case 'stop':
        console.log('Twilio media stream stopped.');
        // if (deepgramLive) {
        //   deepgramLive.finish();
        // }
        break;
    }
  });

  ws.on('close', () => {
    console.log('WebSocket connection closed.');
    // if (deepgramLive) {
    //   deepgramLive.finish();
    // }
  });
});

// ---------------------------------------------------------------------------------
// 4. Start the Server
// ---------------------------------------------------------------------------------

server.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
  console.log("Full AI Conversational Bot is running.");
});
