"use client";

import { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";

type Message = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

export default function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    async function init() {
      const { data } = await supabase.auth.getUser();
      if (data.user) setUserId(data.user.id);
    }
    init();
  }, []);

  async function ensureConversation() {
    if (conversationId) return conversationId;
    if (!userId) return null;

    const { data, error } = await supabase
      .from("conversations")
      .insert({ user_id: userId })
      .select()
      .single();

    if (error) {
      console.error("Conversation creation error:", error);
      alert(`Could not start conversation: ${error.message}`);
      return null;
    }
    if (!data) return null;

    setConversationId(data.id);
    return data.id;
  }

  async function handleSend() {
    if (!input.trim() || !userId) return;
    setSending(true);

    const convoId = await ensureConversation();
    if (!convoId) {
      setSending(false);
      return;
    }

    const userMessage = input;
    setInput("");

    const { data: userMsgData, error: userMsgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: convoId,
        role: "user",
        content: userMessage,
      })
      .select()
      .single();

    if (userMsgError) {
      alert(`Error sending message: ${userMsgError.message}`);
      setSending(false);
      return;
    }

    if (userMsgData) {
      setMessages((prev) => [...prev, userMsgData as Message]);
    }

    const fakeReply = `(Placeholder mentor reply) I hear you said: "${userMessage}". Real AI responses will connect here later.`;

    const { data: assistantMsgData, error: assistantMsgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: convoId,
        role: "assistant",
        content: fakeReply,
      })
      .select()
      .single();

    if (assistantMsgError) {
      alert(`Error saving reply: ${assistantMsgError.message}`);
    } else if (assistantMsgData) {
      setMessages((prev) => [...prev, assistantMsgData as Message]);
    }

    setSending(false);
  }

  if (!userId) return null;

  return (
    <div
      style={{ position: "fixed", bottom: "20px", right: "20px", zIndex: 1000 }}
    >
      {isOpen ? (
        <div
          style={{
            width: "320px",
            height: "420px",
            background: "white",
            border: "1px solid #ccc",
            borderRadius: "12px",
            display: "flex",
            flexDirection: "column",
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
          }}
        >
          <div
            style={{
              padding: "12px",
              borderBottom: "1px solid #eee",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong>Lynks Mentor</strong>
            <button onClick={() => setIsOpen(false)}>✕</button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px" }}>
            {messages.length === 0 && (
              <p style={{ color: "#999", fontSize: "14px" }}>
                Ask me anything about your career path.
              </p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                style={{
                  marginBottom: "8px",
                  textAlign: msg.role === "user" ? "right" : "left",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    padding: "8px 12px",
                    borderRadius: "12px",
                    background: msg.role === "user" ? "#0070f3" : "#f0f0f0",
                    color: msg.role === "user" ? "white" : "black",
                    fontSize: "14px",
                    maxWidth: "80%",
                  }}
                >
                  {msg.content}
                </span>
              </div>
            ))}
          </div>

          <div
            style={{
              padding: "12px",
              borderTop: "1px solid #eee",
              display: "flex",
              gap: "8px",
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder="Type a message..."
              style={{ flex: 1, padding: "8px" }}
              disabled={sending}
            />
            <button onClick={handleSend} disabled={sending}>
              {sending ? "..." : "Send"}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "#0070f3",
            color: "white",
            border: "none",
            fontSize: "24px",
            cursor: "pointer",
            boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          }}
        >
          💬
        </button>
      )}
    </div>
  );
}
