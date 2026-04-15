"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  Bot,
  Send,
  X,
  MessageSquare,
  Loader2,
  Sparkles,
  Minimize2,
  Maximize2,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAiChat } from "./useAiMutations";
import { ChatMessage } from "@/types";

interface AIChatWidgetProps {
  scanId?: string;
}

export function AIChatWidget({ scanId }: AIChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const { mutate: sendMessageApi, isPending: isLoading } = useAiChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const sendMessage = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const userMessage: ChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    sendMessageApi(
      { message: trimmed, history: messages, scanId },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: "model", content: data.reply },
          ]);
        },
        onError: () => {
          setMessages((prev) => [
            ...prev,
            {
              role: "model",
              content: "Sorry, I encountered an error. Please try again.",
            },
          ]);
        },
      }
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  const suggestedQuestions = scanId
    ? [
        "What are the most critical issues?",
        "How do I fix the top vulnerability?",
        "Summarize this scan for my manager",
        "What should I prioritize first?",
      ]
    : [
        "What's my overall security posture?",
        "Which assets need scanning?",
        "What are OWASP Top 10?",
        "How do I improve my security score?",
      ];

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground "
      >
        <MessageSquare className="h-6 w-6" />
        <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold">
          AI
        </span>
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col overflow-hidden rounded-xl border border-border/50 bg-background/95 backdrop-blur-xl shadow-2xl shadow-black/20 transition-all duration-300",
        isExpanded
          ? "bottom-4 right-4 left-4 top-4 sm:left-auto sm:top-4 sm:w-[560px]"
          : "bottom-4 right-4 left-4 h-[calc(100vh-140px)] max-h-[560px] sm:left-auto sm:bottom-6 sm:right-6 sm:w-[400px] sm:h-[560px]",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/50 bg-muted/30 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              VaultScan AI
            </h3>
            <p className="text-[10px] text-muted-foreground">
              Security Assistant
              {scanId && " - Scan Context"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={clearChat}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              title="Clear chat"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
          >
            {isExpanded ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50 hover:text-destructive transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center gap-4 pt-8">
            <div className="flex h-16 w-16 items-center justify-center bg-primary/10 border border-primary/20">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <h4 className="text-sm font-medium text-foreground">
                How can I help you?
              </h4>
              <p className="mt-1 text-xs text-muted-foreground">
                Ask me about vulnerabilities, security best practices, or your
                scan results.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-2 w-full mt-2">
              {suggestedQuestions.map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  className="rounded-xl border border-border/40 bg-muted/10 px-3 py-2.5 text-left text-xs text-muted-foreground hover:bg-muted/30 hover:border-border/60 transition-all font-medium"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-2.5",
                msg.role === "user" ? "flex-row-reverse" : "",
              )}
            >
              {msg.role === "model" && (
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] px-3.5 py-2.5 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-md"
                    : "glass-card border border-border/50 bg-muted/20 text-foreground rounded-tl-md",
                )}
              >
                {msg.role === "model" ? (
                  <div
                    className="prose prose-invert prose-sm max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0.5 [&_code]:bg-muted [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded-md [&_pre]:bg-muted/50 [&_pre]:border [&_pre]:border-border/50 [&_pre]:p-3 [&_pre]:rounded-lg text-foreground/90 font-medium"
                    dangerouslySetInnerHTML={{
                      __html: formatMarkdown(msg.content),
                    }}
                  />
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/20">
              <Bot className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="glass-card bg-muted/20 border border-border/50 px-4 py-3">
              <div className="flex items-center gap-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground font-medium">
                  Thinking...
                </span>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border/50 bg-muted/10 p-3">
        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about security..."
            rows={1}
            className="flex-1 resize-none rounded-xl border border-border/50 bg-background/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30 transition-all custom-scrollbar"
            style={{ maxHeight: "120px" }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement;
              target.style.height = "auto";
              target.style.height = Math.min(target.scrollHeight, 120) + "px";
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
              input.trim() && !isLoading
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-primary/40 hover:scale-105"
                : "bg-muted/50 text-muted-foreground cursor-not-allowed",
            )}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Simple markdown formatting
function formatMarkdown(text: string): string {
  return (
    text
      // Code blocks
      .replace(
        /```(\w+)?\n([\s\S]*?)```/g,
        '<pre><code class="language-$1">$2</code></pre>',
      )
      // Inline code
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      // Bold
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      // Italic
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold mt-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-sm font-bold mt-2">$2</h2>')
      // Unordered lists
      .replace(/^[-*] (.+)$/gm, "<li>$1</li>")
      .replace(/(<li>.*<\/li>\n?)+/g, "<ul>$&</ul>")
      // Ordered lists
      .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
      // Line breaks
      .replace(/\n/g, "<br>")
  );
}
