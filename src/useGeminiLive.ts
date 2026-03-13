import { GoogleGenAI, Modality, LiveServerMessage, Type } from "@google/genai";
import { useState, useCallback, useRef, useEffect } from "react";

export function useGeminiLive(onCommand: (action: string, params: any) => void, devices: any[] = []) {
  const [isConnected, setIsConnected] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isAlwaysListening, setIsAlwaysListening] = useState(false);
  const sessionRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recognitionRef = useRef<any>(null);

  const playAudio = (base64: string) => {
    const audio = new Audio(`data:audio/wav;base64,${base64}`);
    audio.play().catch(e => console.error("Audio play failed", e));
  };

  const connect = useCallback(async () => {
    if (sessionRef.current) return sessionRef.current;

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
    
    const session = await ai.live.connect({
      model: "gemini-2.5-flash-native-audio-preview-09-2025",
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: `You are NERV 8, a high-tech AI assistant. 
        You can control devices across a user's network.
        Available tools:
        - open_url(url): Opens a website or app URL.
        - set_alarm(time, label): Sets an alarm.
        - send_email(to, subject, body): Sends an email.
        - broadcast_command(targetDeviceId, action, params): Sends a command to another device.
        
        CURRENT NETWORK DEVICES:
        ${devices.map(d => `- Name: ${d.name}, ID: ${d.id}, Type: ${d.type}`).join('\n')}
        
        If the user asks to do something on another device, use broadcast_command with the correct targetDeviceId.
        If the user asks to do something on THIS device, use the specific tool (e.g. open_url).
        Be concise, professional, and slightly futuristic.`,
        tools: [{
          functionDeclarations: [
            {
              name: "open_url",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  url: { type: Type.STRING }
                },
                required: ["url"]
              }
            },
            {
              name: "set_alarm",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  time: { type: Type.STRING },
                  label: { type: Type.STRING }
                },
                required: ["time"]
              }
            },
            {
              name: "broadcast_command",
              parameters: {
                type: Type.OBJECT,
                properties: {
                  targetDeviceId: { type: Type.STRING },
                  action: { type: Type.STRING },
                  params: { type: Type.OBJECT }
                },
                required: ["targetDeviceId", "action"]
              }
            }
          ]
        }]
      },
      callbacks: {
        onopen: () => setIsConnected(true),
        onclose: () => {
          setIsConnected(false);
          sessionRef.current = null;
        },
        onmessage: async (msg: LiveServerMessage) => {
          if (msg.serverContent?.modelTurn?.parts) {
            for (const part of msg.serverContent.modelTurn.parts) {
              if (part.inlineData) {
                playAudio(part.inlineData.data);
              }
            }
          }
          
          if (msg.toolCall) {
            for (const call of msg.toolCall.functionCalls) {
              onCommand(call.name, call.args);
            }
          }
        }
      }
    });

    sessionRef.current = session;
    return session;
  }, [onCommand, devices]);

  const startAudioStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!sessionRef.current || (!isRecording && !isAlwaysListening)) return;
        
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7FFF;
        }
        
        const base64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData.buffer)));
        sessionRef.current.sendRealtimeInput({
          media: { data: base64Data, mimeType: 'audio/pcm;rate=16000' }
        });
      };

      source.connect(processor);
      processor.connect(audioContext.destination);
    } catch (err) {
      console.error("Failed to start audio stream", err);
    }
  };

  const stopAudioStream = () => {
    streamRef.current?.getTracks().forEach(track => track.stop());
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
  };

  // Wake word detection using Web Speech API
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('')
        .toLowerCase();

      if (transcript.includes('nerv') || transcript.includes('nerve')) {
        console.log("Wake word detected!");
        if (!isRecording) {
          startRecording();
          // Auto-stop after 5 seconds of silence or after command
          setTimeout(() => stopRecording(), 5000);
        }
      }
    };

    recognition.onend = () => {
      if (isAlwaysListening) recognition.start();
    };

    recognitionRef.current = recognition;

    if (isAlwaysListening) {
      recognition.start();
    } else {
      recognition.stop();
    }

    return () => recognition.stop();
  }, [isAlwaysListening]);

  const startRecording = async () => {
    if (!sessionRef.current) await connect();
    if (!streamRef.current) await startAudioStream();
    setIsRecording(true);
  };

  const stopRecording = () => {
    setIsRecording(false);
  };

  const toggleAlwaysListening = () => {
    setIsAlwaysListening(prev => !prev);
  };

  return { 
    isConnected, 
    isRecording, 
    isAlwaysListening,
    startRecording, 
    stopRecording, 
    connect,
    toggleAlwaysListening
  };
}
