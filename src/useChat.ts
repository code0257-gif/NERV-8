import { GoogleGenAI, Type } from "@google/genai";
import { useState, useEffect } from 'react';
import { db, auth } from './firebase';
import { collection, addDoc, onSnapshot, query, orderBy, limit, serverTimestamp } from 'firebase/firestore';

export function useChat(onCommand: (action: string, params: any) => void, devices: any[] = []) {
  const [messages, setMessages] = useState<any[]>([]);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    if (!auth.currentUser) return;

    const messagesRef = collection(db, `users/${auth.currentUser.uid}/messages`);
    const q = query(messagesRef, orderBy('createdAt', 'asc'), limit(50));

    const unsub = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => unsub();
  }, [auth.currentUser]);

  const sendMessage = async (text: string) => {
    if (!auth.currentUser || !text.trim()) return;

    const messagesRef = collection(db, `users/${auth.currentUser.uid}/messages`);
    
    // Add user message
    await addDoc(messagesRef, {
      text,
      sender: 'user',
      createdAt: serverTimestamp(),
    });

    setIsTyping(true);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
      
      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: text,
        config: {
          systemInstruction: `You are NERV 8, a high-tech AI assistant. 
          You can control devices across a user's network.
          Available tools:
          - open_url(url): Opens a website or app URL.
          - set_alarm(time, label): Sets an alarm.
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
                  properties: { url: { type: Type.STRING } },
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
        }
      });

      const responseText = result.text || "Command processed.";
      
      // Handle function calls if any
      if (result.functionCalls) {
        for (const call of result.functionCalls) {
          onCommand(call.name, call.args);
        }
      }

      // Add AI response
      await addDoc(messagesRef, {
        text: responseText,
        sender: 'ai',
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      console.error("Chat error:", error);
      await addDoc(messagesRef, {
        text: "SYSTEM ERROR: FAILED TO PROCESS REQUEST",
        sender: 'ai',
        createdAt: serverTimestamp(),
      });
    } finally {
      setIsTyping(false);
    }
  };

  return { messages, sendMessage, isTyping };
}
