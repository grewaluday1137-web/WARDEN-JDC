import { useState, useRef, useEffect } from 'react';
import './GemmaChat.css';

const LOCAL_AI_URL = 'http://127.0.0.1:8080/v1/chat/completions';

export default function GemmaChat({ alerts }) {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState('checking'); // 'checking', 'online', 'offline'
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your tactical AI assistant. I am currently initializing the local Gemma model...' }
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  // Check health on mount
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const resp = await fetch('http://127.0.0.1:8080/health');
        if (resp.ok) {
          setStatus('online');
          setMessages(prev => {
            if (prev.length === 1 && prev[0].content.includes('initializing')) {
              return [{ role: 'assistant', content: 'Gemma model is now ONLINE and ready for tactical consultation. How can I help you today?' }];
            }
            return prev;
          });
        }
        else setStatus('offline');
      } catch (e) {
        setStatus('offline');
      }
    };
    checkHealth();
    const interval = setInterval(checkHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isTyping) return;

    const userText = input.trim();
    setInput('');
    
    const newMessages = [...messages, { role: 'user', content: userText }];
    setMessages(newMessages);
    setIsTyping(true);

    // Provide context of current active alerts
    const activeAlerts = alerts.filter(a => a.status !== 'resolved');
    const systemPrompt = `You are a tactical advisor for emergency first responders.
Current active incidents: ${JSON.stringify(activeAlerts, null, 2)}
Keep your answers brief and highly actionable.`;

    try {
      const response = await fetch(LOCAL_AI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gemma-4-e2b',
          messages: [
            { role: 'system', content: systemPrompt },
            ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ],
          temperature: 0.3,
        }),
      });

      if (!response.ok) throw new Error('Network response was not ok');

      const data = await response.json();
      const aiContent = data.choices[0].message.content;

      setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠️ Connection to local Gemma model failed.' }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={`gemma-chat ${isOpen ? 'gemma-chat--open' : ''}`}>
      <div className="gemma-chat__header" onClick={() => setIsOpen(!isOpen)}>
        <div className="gemma-chat__header-title">
          <span className="gemma-chat__icon">🤖</span>
          Gemma Tactical Assistant
          <div className="gemma-chat__status-container">
            <div className={`gemma-chat__status-dot gemma-chat__status-dot--${status}`} />
            <span className="gemma-chat__status-text">{status.toUpperCase()}</span>
          </div>
        </div>
        <button className="gemma-chat__toggle-btn">
          {isOpen ? '▼' : '▲'}
        </button>
      </div>

      {isOpen && (
        <div className="gemma-chat__body">
          <div className="gemma-chat__messages">
            {messages.map((msg, idx) => (
              <div key={idx} className={`gemma-chat__message gemma-chat__message--${msg.role}`}>
                <div className="gemma-chat__message-bubble">
                  {msg.content}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="gemma-chat__message gemma-chat__message--assistant">
                <div className="gemma-chat__message-bubble gemma-chat__typing">
                  <span className="dot"></span><span className="dot"></span><span className="dot"></span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
          
          <form className="gemma-chat__input-area" onSubmit={handleSubmit}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Gemma about current incidents..."
              className="gemma-chat__input"
              disabled={isTyping}
            />
            <button type="submit" className="gemma-chat__send-btn" disabled={isTyping || !input.trim()}>
              ➤
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
