# 5 : Prompt builder + LLM call will go here
# Uses Groq API (free) running Llama 3.3 70B
# Get your free key at: https://console.groq.com

def build_prompt(question: str, context_chunks: list[str]) -> str:
    """Combine retrieved chunks and user question into a prompt."""
    raise NotImplementedError("Coming on Day 5!")


def ask_llm(prompt: str) -> str:
    """
    Send prompt to Llama 3.3 70B via Groq and return the answer.
    Groq free tier: 14,400 requests/day — plenty for development.
    """
    raise NotImplementedError("Coming on Day 5!")
