"""
llm.py — Prompt builder + Groq LLM call

Takes retrieved chunks from ChromaDB and a user question,
builds a RAG prompt, sends it to Llama 3.3 70B via Groq,
and returns the grounded answer.
"""

import os
import requests 
from dotenv import load_dotenv

load_dotenv()

# ─────────────────────────────────────────────────────────────────────────────
# MODEL CONFIG
# ─────────────────────────────────────────────────────────────────────────────

MODEL       = "llama-3.3-70b-versatile"   # Groq free tier model
MAX_TOKENS  = 1024                         # max tokens in the answer
TEMPERATURE = 0.2                          # low = factual, high = creative


# ─────────────────────────────────────────────────────────────────────────────
# PROMPT BUILDER
# ─────────────────────────────────────────────────────────────────────────────

def build_prompt(question: str, context_chunks: list[str]) -> list[dict]:
    """
    Build a RAG prompt as a list of chat messages.

    Structure:
      - system: tells the LLM its role and strict grounding rules
      - user:   the retrieved context chunks + the question

    Args:
        question:       the user's question
        context_chunks: relevant text chunks retrieved from ChromaDB

    Returns:
        List of message dicts: [{"role": ..., "content": ...}, ...]
    """
    if not question or not question.strip():
        raise ValueError("Question cannot be empty.")
    if not context_chunks:
        raise ValueError("No context chunks provided.")

    # Number each chunk so the LLM can reference them
    context_text = "\n\n---\n\n".join(
        f"[Chunk {i + 1}]\n{chunk.strip()}"
        for i, chunk in enumerate(context_chunks)
    )

    system_message = (
        "You are DocuMind AI. Answer questions strictly from the provided context.\n\n"
        "RULES:\n"
        "1. Answer in 2-3 short sentences maximum\n"
        "2. If answer not in context, say: 'Not found in document.'\n"
        "3. Never mention chunk numbers or 'based on context'\n"
        "4. Never make up facts\n"
        "5. Be direct - no explanations about what you can/can't do\n\n"
        "EXAMPLE GOOD ANSWER: 'Barack Obama was the 44th US President, born in 1961.'\n"
        "EXAMPLE BAD ANSWER: 'Based on Chunk 3, I can see that Barack Obama...'"
    )

    user_message = (
        f"Here is the relevant content from the document:\n\n"
        f"{context_text}\n\n"
        f"---\n\n"
        f"Question: {question.strip()}\n\n"
        f"Answer based only on the context above:"
    )

    return [
        {"role": "system", "content": system_message},
        {"role": "user",   "content": user_message},
    ]


# ─────────────────────────────────────────────────────────────────────────────
# LLM CALLER
# ─────────────────────────────────────────────────────────────────────────────

def ask_llm(messages: list[dict]) -> str:
    """
    Send messages to Llama 3.3 70B via Groq and return the answer string.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY is not set. "
            "Add it to your .env file. "
            "Get a free key at https://console.groq.com"
        )

    url = "https://api.groq.com/openai/v1/chat/completions"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    data = {
        "model": MODEL,
        "messages": messages,
        "max_tokens": MAX_TOKENS,
        "temperature": TEMPERATURE
    }

    try:
        response = requests.post(url, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"].strip()
    except Exception as e:
        raise RuntimeError(f"Groq API call failed: {e}")


# ─────────────────────────────────────────────────────────────────────────────
# COMBINED — single function used by /ask endpoint
# ─────────────────────────────────────────────────────────────────────────────

def answer_question(question: str, context_chunks: list[str]) -> dict:
    """
    Full RAG answer step: build prompt → call LLM → return result dict.

    Args:
        question:       the user's question
        context_chunks: relevant text chunks from ChromaDB search

    Returns:
        {
            "question":      the original question,
            "answer":        the LLM answer,
            "model":         model name used,
            "chunks_used":   how many chunks were in the context,
            "context_chars": total characters of context sent to LLM,
        }
    """
    messages = build_prompt(question, context_chunks)
    answer   = ask_llm(messages)

    return {
        "question":      question,
        "answer":        answer,
        "model":         MODEL,
        "chunks_used":   len(context_chunks),
        "context_chars": sum(len(c) for c in context_chunks),
    }
 
