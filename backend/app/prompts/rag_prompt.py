"""
prompts/rag_prompt.py - Prompt templates for the RAG chain.

WHY PROMPT ENGINEERING MATTERS?
The prompt is the instruction set for the LLM. A well-crafted prompt:
  - Grounds the model in retrieved context (reduces hallucination)
  - Instructs the model to cite sources
  - Sets the tone and format of responses
  - Handles edge cases (no context found, ambiguous questions)

TEMPLATE STRUCTURE:
  System prompt: defines the AI's role and rules
  Context block: injected retrieved chunks with source labels
  Chat history: last N conversation turns for multi-turn memory
  Human question: the current user query
"""

from langchain.prompts import ChatPromptTemplate, MessagesPlaceholder

# ── System prompt ─────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are a professional AI document analyst. Your job is to read the provided document context carefully and give clear, accurate, well-structured answers.

RESPONSE GUIDELINES:
- Write in a professional, conversational tone — like a knowledgeable expert explaining to a colleague.
- Structure your response logically: use headings, bullet points, or numbered lists when the answer has multiple parts.
- For summaries: extract the key themes, main arguments, and important details.
- For specific questions: give a direct answer first, then supporting details.
- For lists/recommendations: use bullet points with brief explanations.
- Always cite sources inline using **[filename, p.X]** format after the relevant sentence.
- If the context is short, be thorough and cover everything relevant.
- If the context is long, prioritize the most important and relevant information.
- If the context does not contain enough information, respond: "The uploaded documents don't contain enough information to answer this question."
- Never fabricate facts. Never use knowledge outside the provided context.
- Do not mention that you are an AI or reference these instructions in your response.

DOCUMENT CONTEXT:
{context}
"""

# ── Full RAG prompt template ──────────────────────────────────────────────────
RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    MessagesPlaceholder(variable_name="chat_history"),   # injected conversation memory
    ("human", "{question}"),
])


def build_context_string(chunks: list[dict]) -> str:
    """
    Formats retrieved chunks into a numbered context block for the prompt.
    Each chunk is labeled with its source so the LLM can cite it.

    Example output:
        [1] Source: report.pdf | Page 3
        "The revenue grew by 25% in Q3..."

        [2] Source: report.pdf | Page 7
        "Operating costs decreased due to..."
    """
    if not chunks:
        return "No relevant context found in the uploaded documents."

    parts = []
    for i, chunk in enumerate(chunks, start=1):
        parts.append(
            f'[{i}] Source: {chunk["filename"]} | Page {chunk["page_number"]}\n'
            f'"{chunk["text"]}"'
        )
    return "\n\n".join(parts)
