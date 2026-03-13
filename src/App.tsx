import React, { useState, useEffect, useRef } from 'react';
import { auth } from './firebase';
import { GoogleAuthProvider, signInWithPopup, onAuthStateChanged, User } from 'firebase/auth';
import { useDeviceSync } from './useDeviceSync';
import { useGeminiLive } from './useGeminiLive';
import { useChat } from './useChat';
import { 
  Mic, MicOff, Monitor, Smartphone, Globe, 
  Bell, Mail, Power, Activity, Cpu, Shield,
  Terminal, Settings, LogOut, Command as CommandIcon,
  MessageSquare, Send, User as UserIcon, Bot
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [logs, setLogs] = useState<string[]>(["NERV 8 SYSTEM INITIALIZED", "WAITING FOR AUTHENTICATION..."]);
  const [activeTab, setActiveTab] = useState<'logs' | 'chat'>('chat');
  const [chatInput, setChatInput] = useState("");
  const [pendingRemoteCommand, setPendingRemoteCommand] = useState<any>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
      if (u) addLog(`USER ${u.displayName?.toUpperCase()} AUTHENTICATED`);
    });
  }, []);

  const addLog = (msg: string) => {
    setLogs(prev => [msg, ...prev].slice(0, 20));
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Login failed", error);
      addLog("AUTHENTICATION FAILED");
    }
  };

  const { deviceId, devices, lastCommand, sendCommand, completeCommand } = useDeviceSync();

  const handleCommand = (action: string, params: any) => {
    addLog(`EXECUTING: ${action.toUpperCase()}`);
    if (action === 'open_url') {
      const win = window.open(params.url, '_blank');
      if (!win) {
        addLog("POPUP BLOCKED: PLEASE ALLOW POPUPS");
        // If blocked, we can show a manual link in the logs or a notification
        setPendingRemoteCommand({ action, params });
      }
    } else if (action === 'set_alarm') {
      addLog(`ALARM SET FOR ${params.time}: ${params.label}`);
    } else if (action === 'broadcast_command') {
      sendCommand(params.targetDeviceId, params.action, params.params);
    }
  };

  const { isConnected, isRecording, isAlwaysListening, startRecording, stopRecording, connect, toggleAlwaysListening } = useGeminiLive(handleCommand, devices);
  const { messages, sendMessage, isTyping } = useChat(handleCommand, devices);

  useEffect(() => {
    if (lastCommand) {
      addLog(`REMOTE COMMAND RECEIVED: ${lastCommand.action.toUpperCase()}`);
      
      if (lastCommand.action === 'open_url') {
        // For remote open_url, we MUST show a notification because window.open will be blocked
        setPendingRemoteCommand(lastCommand);
      } else {
        handleCommand(lastCommand.action, lastCommand.params);
      }
      completeCommand(lastCommand.docId);
    }
  }, [lastCommand]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const onSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput);
    setChatInput("");
  };

  if (!isAuthReady) return null;

  if (!user) {
    return (
      <div className="min-h-screen bg-[#050505] text-[#E6E6E6] flex items-center justify-center font-mono">
        <div className="p-8 border border-[#141414] bg-[#0a0a0a] rounded-lg shadow-2xl max-w-md w-full text-center">
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 rounded-full border-2 border-[#FF4444] flex items-center justify-center animate-pulse">
              <Shield className="w-10 h-10 text-[#FF4444]" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tighter mb-2">NERV 8</h1>
          <p className="text-xs text-[#8E9299] mb-8 uppercase tracking-widest">Security Protocol Required</p>
          <button 
            onClick={handleLogin}
            className="w-full py-3 bg-[#FF4444] text-black font-bold rounded hover:bg-[#FF6666] transition-colors flex items-center justify-center gap-2"
          >
            <Power className="w-4 h-4" />
            INITIATE LOGIN
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-[#E6E6E6] font-mono selection:bg-[#FF4444] selection:text-black">
      {/* Header */}
      <header className="border-b border-[#141414] p-4 flex justify-between items-center bg-[#0a0a0a]">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-[#8E9299] leading-none">SYSTEM STATUS</span>
            <span className="text-sm font-bold text-[#00FF00] flex items-center gap-1">
              <Activity className="w-3 h-3" /> OPERATIONAL
            </span>
          </div>
          <div className="h-8 w-px bg-[#141414]" />
          <div className="flex flex-col">
            <span className="text-xs text-[#8E9299] leading-none">DEVICE ID</span>
            <span className="text-sm font-bold text-[#FF4444]">{deviceId.toUpperCase()}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
          <div className="text-right">
            <div className="text-xs text-[#8E9299] leading-none">USER_NODE</div>
            <div className="text-sm font-bold">{user.displayName?.toUpperCase()}</div>
          </div>
          <button 
            onClick={() => auth.signOut()}
            className="p-2 hover:bg-[#141414] rounded transition-colors text-[#8E9299] hover:text-[#FF4444]"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-[1600px] mx-auto">
        {/* Pending Command Notification */}
        <AnimatePresence>
          {pendingRemoteCommand && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 w-full max-w-md"
            >
              <div className="bg-[#141414] border-2 border-[#FF4444] p-4 rounded-lg shadow-[0_0_30px_rgba(255,68,68,0.2)] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-[#FF4444]/20 rounded">
                    <CommandIcon className="w-5 h-5 text-[#FF4444]" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-[#8E9299] uppercase tracking-widest">Incoming Command</div>
                    <div className="text-xs font-bold text-[#E6E6E6]">
                      {pendingRemoteCommand.action === 'open_url' ? `OPEN: ${pendingRemoteCommand.params.url}` : pendingRemoteCommand.action.toUpperCase()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => setPendingRemoteCommand(null)}
                    className="px-3 py-1.5 text-[10px] font-bold text-[#8E9299] hover:text-[#E6E6E6]"
                  >
                    DISMISS
                  </button>
                  <button 
                    onClick={() => {
                      if (pendingRemoteCommand.action === 'open_url') {
                        window.open(pendingRemoteCommand.params.url, '_blank');
                      } else {
                        handleCommand(pendingRemoteCommand.action, pendingRemoteCommand.params);
                      }
                      setPendingRemoteCommand(null);
                    }}
                    className="px-4 py-1.5 bg-[#FF4444] text-black text-[10px] font-bold rounded hover:bg-[#FF6666]"
                  >
                    EXECUTE
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Left Panel: System Stats & Devices */}
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-[#0a0a0a] border border-[#141414] rounded-lg p-4">
            <h2 className="text-xs font-bold text-[#8E9299] mb-4 flex items-center gap-2">
              <Cpu className="w-3 h-3" /> HARDWARE_NODES
            </h2>
            <div className="space-y-3">
              {devices.map(device => (
                <div key={device.id} className={cn(
                  "p-3 rounded border border-transparent transition-all",
                  device.id === deviceId ? "bg-[#141414] border-[#FF4444]/30" : "hover:bg-[#141414]/50"
                )}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold truncate max-w-[120px]">{device.name}</span>
                    {device.type === 'mobile' ? <Smartphone className="w-3 h-3 text-[#8E9299]" /> : <Monitor className="w-3 h-3 text-[#8E9299]" />}
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#00FF00] animate-pulse" />
                    <span className="text-[10px] text-[#8E9299]">{device.id.toUpperCase()}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="bg-[#0a0a0a] border border-[#141414] rounded-lg p-4">
            <h2 className="text-xs font-bold text-[#8E9299] mb-4 flex items-center gap-2">
              <Activity className="w-3 h-3" /> SYSTEM_METRICS
            </h2>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span>CPU_LOAD</span>
                  <span>24%</span>
                </div>
                <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF4444] w-[24%]" />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span>MEM_USAGE</span>
                  <span>1.2GB</span>
                </div>
                <div className="h-1 bg-[#141414] rounded-full overflow-hidden">
                  <div className="h-full bg-[#FF4444] w-[45%]" />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* Center Panel: Voice Assistant */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-[#0a0a0a] border border-[#141414] rounded-lg p-8 flex flex-col items-center justify-center min-h-[400px] relative overflow-hidden">
            {/* Background Grid Effect */}
            <div className="absolute inset-0 opacity-5 pointer-events-none" 
                 style={{ backgroundImage: 'radial-gradient(#FF4444 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
            
            <div className="relative z-10 flex flex-col items-center">
              <motion.div 
                animate={{ 
                  scale: isRecording ? [1, 1.1, 1] : 1,
                  rotate: isRecording ? [0, 5, -5, 0] : 0
                }}
                transition={{ repeat: Infinity, duration: 2 }}
                className={cn(
                  "w-32 h-32 rounded-full flex items-center justify-center mb-8 transition-all duration-500",
                  isRecording ? "bg-[#FF4444] shadow-[0_0_50px_rgba(255,68,68,0.3)]" : "bg-[#141414] border-2 border-[#141414]"
                )}
              >
                {isRecording ? <Mic className="w-12 h-12 text-black" /> : <MicOff className="w-12 h-12 text-[#8E9299]" />}
              </motion.div>

              <h3 className="text-xl font-bold tracking-widest mb-2">NERV 8</h3>
              <p className="text-xs text-[#8E9299] uppercase tracking-[0.3em] mb-8">
                {isRecording ? "Listening..." : isConnected ? "System Ready" : "Connecting..."}
              </p>

              <div className="flex gap-4">
                {!isConnected ? (
                  <button 
                    onClick={connect}
                    className="px-6 py-2 border border-[#FF4444] text-[#FF4444] text-xs font-bold hover:bg-[#FF4444] hover:text-black transition-all"
                  >
                    INITIALIZE LINK
                  </button>
                ) : (
                  <div className="flex flex-col items-center gap-4">
                    <button 
                      onMouseDown={startRecording}
                      onMouseUp={stopRecording}
                      className={cn(
                        "px-8 py-3 rounded-full text-xs font-bold transition-all flex items-center gap-2",
                        isRecording ? "bg-[#FF4444] text-black" : "bg-white text-black hover:bg-[#E6E6E6]"
                      )}
                    >
                      {isRecording ? "RELEASE TO SEND" : "HOLD TO SPEAK"}
                    </button>
                    
                    <button 
                      onClick={toggleAlwaysListening}
                      className={cn(
                        "text-[10px] font-bold tracking-widest flex items-center gap-2 px-4 py-2 rounded border transition-all",
                        isAlwaysListening ? "border-[#FF4444] text-[#FF4444] bg-[#FF4444]/10" : "border-[#141414] text-[#8E9299] hover:border-[#8E9299]"
                      )}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isAlwaysListening ? "bg-[#FF4444] animate-pulse" : "bg-[#8E9299]"
                      )} />
                      ALWAYS_LISTENING: {isAlwaysListening ? "ACTIVE" : "OFF"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Visualizer Mockup */}
            <div className="absolute bottom-0 left-0 right-0 h-24 flex items-end justify-center gap-1 px-4 opacity-20">
              {Array.from({ length: 40 }).map((_, i) => (
                <motion.div
                  key={i}
                  animate={{ height: isRecording ? [10, Math.random() * 60 + 10, 10] : 4 }}
                  transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.05 }}
                  className="w-1 bg-[#FF4444] rounded-t"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <button onClick={() => handleCommand('open_url', { url: 'https://gmail.com' })} className="bg-[#0a0a0a] border border-[#141414] p-4 rounded-lg hover:border-[#FF4444]/50 transition-all group">
              <Mail className="w-5 h-5 mb-2 text-[#8E9299] group-hover:text-[#FF4444]" />
              <div className="text-[10px] font-bold text-[#8E9299] uppercase">Gmail</div>
            </button>
            <button onClick={() => handleCommand('open_url', { url: 'https://google.com' })} className="bg-[#0a0a0a] border border-[#141414] p-4 rounded-lg hover:border-[#FF4444]/50 transition-all group">
              <Globe className="w-5 h-5 mb-2 text-[#8E9299] group-hover:text-[#FF4444]" />
              <div className="text-[10px] font-bold text-[#8E9299] uppercase">Web</div>
            </button>
            <button onClick={() => addLog("ALARM INTERFACE OPENED")} className="bg-[#0a0a0a] border border-[#141414] p-4 rounded-lg hover:border-[#FF4444]/50 transition-all group">
              <Bell className="w-5 h-5 mb-2 text-[#8E9299] group-hover:text-[#FF4444]" />
              <div className="text-[10px] font-bold text-[#8E9299] uppercase">Alarms</div>
            </button>
          </div>
        </div>

        {/* Right Panel: Terminal Logs / Chat */}
        <div className="lg:col-span-3 space-y-6">
          <section className="bg-[#0a0a0a] border border-[#141414] rounded-lg h-[600px] flex flex-col overflow-hidden">
            <div className="flex border-b border-[#141414]">
              <button 
                onClick={() => setActiveTab('chat')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-bold tracking-widest transition-all flex items-center justify-center gap-2",
                  activeTab === 'chat' ? "bg-[#141414] text-[#FF4444]" : "text-[#8E9299] hover:text-[#E6E6E6]"
                )}
              >
                <MessageSquare className="w-3 h-3" /> CHAT_INTERFACE
              </button>
              <button 
                onClick={() => setActiveTab('logs')}
                className={cn(
                  "flex-1 py-3 text-[10px] font-bold tracking-widest transition-all flex items-center justify-center gap-2",
                  activeTab === 'logs' ? "bg-[#141414] text-[#FF4444]" : "text-[#8E9299] hover:text-[#E6E6E6]"
                )}
              >
                <Terminal className="w-3 h-3" /> SYSTEM_LOGS
              </button>
            </div>

            <div className="flex-1 overflow-hidden flex flex-col p-4">
              {activeTab === 'logs' ? (
                <div className="flex-1 overflow-y-auto font-mono text-[10px] space-y-1 custom-scrollbar">
                  <AnimatePresence initial={false}>
                    {logs.map((log, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex gap-2"
                      >
                        <span className="text-[#FF4444] shrink-0">[{new Date().toLocaleTimeString([], { hour12: false })}]</span>
                        <span className={cn(
                          log.includes('FAILED') ? "text-[#FF4444]" : 
                          log.includes('EXECUTING') ? "text-[#00FF00]" : 
                          "text-[#8E9299]"
                        )}>
                          {log}
                        </span>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
                    {messages.map((msg, i) => (
                      <div key={msg.id || i} className={cn(
                        "flex flex-col",
                        msg.sender === 'user' ? "items-end" : "items-start"
                      )}>
                        <div className="flex items-center gap-1 mb-1">
                          {msg.sender === 'user' ? (
                            <>
                              <span className="text-[8px] text-[#8E9299]">USER</span>
                              <UserIcon className="w-2 h-2 text-[#8E9299]" />
                            </>
                          ) : (
                            <>
                              <Bot className="w-2 h-2 text-[#FF4444]" />
                              <span className="text-[8px] text-[#FF4444]">NERV_8</span>
                            </>
                          )}
                        </div>
                        <div className={cn(
                          "max-w-[90%] p-2 text-[11px] rounded",
                          msg.sender === 'user' ? "bg-[#141414] text-[#E6E6E6]" : "bg-[#FF4444]/10 border border-[#FF4444]/20 text-[#FF4444]"
                        )}>
                          {msg.text}
                        </div>
                      </div>
                    ))}
                    {isTyping && (
                      <div className="flex items-center gap-2 text-[#FF4444] animate-pulse">
                        <Bot className="w-3 h-3" />
                        <span className="text-[10px]">THINKING...</span>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  
                  <form onSubmit={onSendChat} className="mt-4 flex gap-2">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="ENTER COMMAND..."
                      className="flex-1 bg-[#050505] border border-[#141414] rounded px-3 py-2 text-[11px] focus:outline-none focus:border-[#FF4444] transition-colors"
                    />
                    <button 
                      type="submit"
                      disabled={isTyping}
                      className="p-2 bg-[#FF4444] text-black rounded hover:bg-[#FF6666] transition-colors disabled:opacity-50"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </form>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>

      {/* Footer Status Bar */}
      <footer className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-[#141414] px-4 py-1 flex justify-between items-center text-[9px] text-[#8E9299] font-bold">
        <div className="flex gap-4">
          <span>LATENCY: 42ms</span>
          <span>ENCRYPTION: AES-256</span>
          <span>LINK: STABLE</span>
        </div>
        <div className="flex gap-4">
          <span>NERV_OS v8.0.4</span>
          <span>© 2026 GEHIRN CORP</span>
        </div>
      </footer>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #050505;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #141414;
          border-radius: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #FF4444;
        }
      `}</style>
    </div>
  );
}
