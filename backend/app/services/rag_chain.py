"""
services/rag_chain.py - The core RAG pipeline using LangChain LCEL.

RAG PIPELINE FLOW:
  1. User question → embed query
  2. Query embedding → FAISS semantic search → top-K chunks
  3. Chunks + chat history → prompt template
  4. Prompt → LLM (streaming or batch)
  5. LLM response → returned with source citations

LCEL (LangChain Expression Language):
  Uses the pipe operator (|) to compose chains declaratively.
  Each step is a Runnable — composable, streamable, and traceable.
"""

from langchain_openai import ChatOpenAI
from langchain_core.output_parsers import StrOutputParser
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.messages import AIMessage
from langchain_core.outputs import ChatGeneration, ChatResult
from typing import AsyncGenerator, Any
from app.config import get_settings
from app.services.embedder import get_embedder
from app.database.vector_store import get_vector_store
from app.database.chat_history import get_recent_history, save_message
from app.prompts.rag_prompt import RAG_PROMPT, build_context_string
from app.utils.logger import get_logger

logger = get_logger(__name__)
settings = get_settings()


def _is_valid_openai_key() -> bool:
    key = settings.OPENAI_API_KEY
    return bool(key and key.startswith("sk-") and "demo" not in key and len(key) > 20)


class _LocalContextLLM(BaseChatModel):
    """
    Intelligent fallback LLM that analyzes retrieved context and produces
    professional, structured answers without any external API call.
    """

    @property
    def _llm_type(self) -> str:
        return "local_context"

    def _generate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        answer = self._build_answer(messages)
        return ChatResult(generations=[ChatGeneration(message=AIMessage(content=answer))])

    async def _agenerate(self, messages, stop=None, run_manager=None, **kwargs) -> ChatResult:
        return self._generate(messages, stop, run_manager, **kwargs)

    def _build_answer(self, messages) -> str:
        system_content = ""
        question = ""
        for msg in messages:
            if hasattr(msg, "type"):
                if msg.type == "system":
                    system_content = msg.content
                elif msg.type == "human":
                    question = msg.content

        # Extract context block
        context_marker = "DOCUMENT CONTEXT:"
        if context_marker in system_content:
            context = system_content.split(context_marker, 1)[1].strip()
        else:
            context = system_content

        if not context or "No relevant context" in context:
            return "The uploaded documents don't contain enough information to answer this question."

        # Parse chunks: each starts with [N] Source: filename | Page X
        import re
        chunks = re.split(r'\[\d+\]\s+Source:', context)
        parsed = []
        for chunk in chunks:
            if not chunk.strip():
                continue
            lines = chunk.strip().split('\n', 1)
            source_line = lines[0].strip()  # e.g. "report.pdf | Page 3"
            text = lines[1].strip().strip('"') if len(lines) > 1 else ""
            # Extract filename and page
            parts = source_line.split('|')
            filename = parts[0].strip() if parts else "document"
            page = parts[1].strip().replace('Page ', 'p.') if len(parts) > 1 else ""
            if text:
                parsed.append({"filename": filename, "page": page, "text": text})

        if not parsed:
            return "The uploaded documents don't contain enough information to answer this question."

        q_lower = question.lower()
        all_text = " ".join(p["text"] for p in parsed)
        citation = f"[{parsed[0]['filename']}, {parsed[0]['page']}]" if parsed else ""

        # ── Summarize ────────────────────────────────────────────────────────
        if any(w in q_lower for w in ["summarize", "summary", "overview", "brief", "main points", "gist"]):
            return self._summarize(parsed)

        # ── Key findings / highlights ─────────────────────────────────────
        if any(w in q_lower for w in ["key findings", "findings", "highlights", "insights", "takeaways"]):
            return self._key_findings(parsed)

        # ── List / recommendations ────────────────────────────────────────
        if any(w in q_lower for w in ["list", "recommend", "steps", "how to", "ways", "methods", "tips"]):
            return self._list_answer(parsed, question)

        # ── Explain / methodology ─────────────────────────────────────────
        if any(w in q_lower for w in ["explain", "methodology", "how does", "what is", "describe", "define"]):
            return self._explain(parsed, question)

        # ── Default: direct answer ────────────────────────────────────────
        return self._direct_answer(parsed, question)

    def _summarize(self, parsed: list[dict]) -> str:
        sections = []
        # Group by source file
        from collections import defaultdict
        by_file: dict = defaultdict(list)
        for p in parsed:
            by_file[p["filename"]].append(p)

        sections.append("## Summary\n")
        for filename, chunks in by_file.items():
            combined = " ".join(c["text"] for c in chunks)
            sentences = [s.strip() for s in combined.replace('\n', ' ').split('.') if len(s.strip()) > 30]
            key_sentences = sentences[:5]
            if key_sentences:
                sections.append(f"**{filename}**\n")
                for s in key_sentences:
                    sections.append(f"- {s}. [{filename}, {chunks[0]['page']}]")
                sections.append("")
        return "\n".join(sections).strip()

    def _key_findings(self, parsed: list[dict]) -> str:
        combined = " ".join(p["text"] for p in parsed)
        sentences = [s.strip() for s in combined.replace('\n', ' ').split('.') if len(s.strip()) > 25]
        findings = sentences[:6]
        if not findings:
            return "No key findings could be extracted from the document."
        lines = ["## Key Findings\n"]
        for i, f in enumerate(findings, 1):
            src = parsed[min(i - 1, len(parsed) - 1)]
            lines.append(f"**{i}.** {f}. [{src['filename']}, {src['page']}]")
        return "\n".join(lines)

    def _list_answer(self, parsed: list[dict], question: str) -> str:
        combined = " ".join(p["text"] for p in parsed)
        sentences = [s.strip() for s in combined.replace('\n', ' ').split('.') if len(s.strip()) > 20]
        items = sentences[:7]
        if not items:
            return "The document does not contain a clear list related to your question."
        src = parsed[0]
        lines = [f"Based on the document, here are the relevant points:\n"]
        for item in items:
            lines.append(f"- {item}. [{src['filename']}, {src['page']}]")
        return "\n".join(lines)

    def _explain(self, parsed: list[dict], question: str) -> str:
        combined = " ".join(p["text"] for p in parsed)
        sentences = [s.strip() for s in combined.replace('\n', ' ').split('.') if len(s.strip()) > 20]
        explanation = '. '.join(sentences[:5])
        src = parsed[0]
        if not explanation:
            return "The document does not contain a clear explanation for this topic."
        return f"{explanation}.\n\n[{src['filename']}, {src['page']}]"

    def _direct_answer(self, parsed: list[dict], question: str) -> str:
        # Find the most relevant chunk by keyword overlap
        q_words = set(question.lower().split())
        best = max(parsed, key=lambda p: len(q_words & set(p["text"].lower().split())))
        sentences = [s.strip() for s in best["text"].replace('\n', ' ').split('.') if len(s.strip()) > 15]
        answer = '. '.join(sentences[:4])
        if not answer:
            return "The uploaded documents don't contain enough information to answer this question."
        return f"{answer}.\n\n[{best['filename']}, {best['page']}]"


def _get_llm(streaming: bool = False) -> BaseChatModel:
    if _is_valid_openai_key():
        return ChatOpenAI(
            model=settings.OPENAI_CHAT_MODEL,
            api_key=settings.OPENAI_API_KEY,
            temperature=0.1,
            streaming=streaming,
            max_tokens=1500,
        )
    logger.warning("No valid OpenAI API key — using local context LLM")
    return _LocalContextLLM()


def retrieve_chunks(question: str, document_ids: list[str] | None = None) -> list[dict]:
    """
    Embeds the question and retrieves the top-K most relevant chunks from FAISS.
    This is the 'R' in RAG — Retrieval.
    """
    embedder = get_embedder()
    query_vector = embedder.embed_query(question)

    store = get_vector_store(dimension=embedder.dimension)
    chunks = store.search(
        query_vector=query_vector,
        top_k=settings.TOP_K,
        document_ids=document_ids if document_ids else None,
    )
    logger.info(f"Retrieved {len(chunks)} chunks for question: '{question[:60]}...'")
    return chunks


async def chat(
    question: str,
    session_id: str = "default",
    document_ids: list[str] | None = None,
) -> dict:
    """
    Non-streaming RAG chat. Returns full answer + sources.
    Used when the client doesn't support SSE streaming.
    """
    # Step 1: Retrieve relevant chunks
    chunks = retrieve_chunks(question, document_ids)
    context = build_context_string(chunks)

    # Step 2: Load conversation history
    history = get_recent_history(session_id)

    # Step 3: Build and invoke the chain
    llm = _get_llm(streaming=False)
    chain = RAG_PROMPT | llm | StrOutputParser()

    answer = await chain.ainvoke({
        "context": context,
        "chat_history": history,
        "question": question,
    })

    # Step 4: Persist messages to history
    save_message(session_id, "user", question)
    save_message(session_id, "assistant", answer)

    logger.info(f"Chat completed for session={session_id}")
    return {"answer": answer, "sources": chunks, "session_id": session_id}


async def chat_stream(
    question: str,
    session_id: str = "default",
    document_ids: list[str] | None = None,
) -> AsyncGenerator[str, None]:
    """
    Streaming RAG chat using Server-Sent Events (SSE).

    Yields:
        "data: <token>\n\n"  — individual tokens as they arrive from the LLM
        "data: [SOURCES]<json>\n\n" — source citations after the answer
        "data: [DONE]\n\n"   — signals end of stream to the frontend

    WHY STREAMING?
    Without streaming, the user waits 5-15 seconds for the full response.
    With streaming, the first token appears in ~500ms, creating a ChatGPT-like UX.
    """
    import json

    # Step 1: Retrieve relevant chunks (fast, synchronous)
    chunks = retrieve_chunks(question, document_ids)
    context = build_context_string(chunks)
    history = get_recent_history(session_id)

    # Step 2: Save user message immediately
    save_message(session_id, "user", question)

    # Step 3: Stream tokens from LLM
    llm = _get_llm(streaming=_is_valid_openai_key())
    chain = RAG_PROMPT | llm | StrOutputParser()

    full_answer = ""
    if _is_valid_openai_key():
        async for token in chain.astream({
            "context": context,
            "chat_history": history,
            "question": question,
        }):
            full_answer += token
            safe_token = token.replace("\n", "\\n")
            yield f"data: {safe_token}\n\n"
    else:
        # Local LLM — get full answer at once then stream word by word for UX
        import asyncio
        full_answer = await chain.ainvoke({
            "context": context,
            "chat_history": history,
            "question": question,
        })
        for word in full_answer.split(" "):
            token = word + " "
            yield f"data: {token.replace(chr(10), chr(92) + 'n')}\n\n"
            await asyncio.sleep(0.02)  # simulate streaming

    # Step 4: Send source citations as a special SSE event
    sources_payload = json.dumps([
        {
            "document_id": c["document_id"],
            "filename": c["filename"],
            "page_number": c["page_number"],
            "chunk_index": c["chunk_index"],
            "content": c["text"][:300],   # truncate for payload size
            "score": round(c["score"], 4),
        }
        for c in chunks
    ])
    yield f"data: [SOURCES]{sources_payload}\n\n"

    # Step 5: Save assistant response and signal done
    save_message(session_id, "assistant", full_answer)
    yield "data: [DONE]\n\n"
    logger.info(f"Stream completed for session={session_id}")
