// Phase data extracted from the curriculum
window.PHASE_COLORS = ["teal-deep", "teal", "purple", "pink", "emerald", "amber", "rust", "mustard", "indigo"];
window.ROADMAP = [
  {
    id: 1,
    title: "Python Foundations",
    short: "Python + Async Engineering",
    color: "teal-deep",
    weeks: "Weeks 1–3",
    weeksDetail: "3 weeks · 7 modules",
    difficulty: 2,
    summary: "Every agent framework runs on Python. Skip this and everything later breaks in mysterious ways.",
    endState: "You can build a FastAPI endpoint that calls three different LLMs in parallel, times out the slow one, and logs the result without blocking the response.",
    sections: [
      { n: "1.1", title: "Generative AI vs AI Agents vs Agentic AI", items: ["Generative AI — single prompt in, content out; no actions, no memory", "AI Agents — an LLM given tools and a goal that acts in a loop", "Agentic AI — autonomous planning, memory, and multi-agent collaboration", "Where each fits, and why this roadmap builds toward agentic systems"] },
      { n: "1.2", title: "Core Python", items: ["Variables, types, control flow", "Functions, *args/**kwargs, decorators", "List & dict comprehensions", "Generator expressions", "Type hints (you'll need these for Pydantic later)"] },
      { n: "1.3", title: "Object-Oriented Python", items: ["Classes, __init__, instance vs class methods", "Inheritance, encapsulation, polymorphism", "Dataclasses", "Pydantic models — every agent framework uses them for tool schemas"] },
      { n: "1.4", title: "Working with HTTP APIs", items: ["The requests library", "HTTP verbs, headers, status codes", "Authentication (Bearer tokens, API keys)", "Rate limits, retries, exponential backoff with tenacity"] },
      { n: "1.5", title: "Async Programming", items: ["asyncio fundamentals — event loop, coroutines", "async/await syntax", "asyncio.gather for parallel LLM calls", "asyncio.wait_for for timeout protection", "asyncio.create_task for fire-and-forget logging"] },
      { n: "1.6", title: "FastAPI", note: "We will cover this during the projects.", items: ["First /chat endpoint", "Pydantic request/response models", "Dependency injection", "Automatic OpenAPI docs", "Running with uvicorn"] },
      { n: "1.7", title: "Database Connectivity", note: "We will cover this during the projects.", items: ["psycopg2 for raw PostgreSQL", "SQLAlchemy ORM basics", "Connection pooling and why it matters under load", "Raw SQL when the ORM gets in the way"] }
    ]
  },
  {
    id: 2,
    title: "The Mental Model of an LLM",
    short: "LLM Mental Model",
    color: "teal",
    weeks: "Week 4",
    weeksDetail: "1 week · 5 modules",
    difficulty: 1,
    summary: "Conceptual phase. Almost no code. Where the brain-in-a-windowless-room analogy lives, and where most \"why is my agent broken\" questions get answered six months later.",
    endState: "You can explain to a non-technical PM why ChatGPT made up a fact, and tell a hiring panel which model to pick for which job — backed by benchmarks, not vibes.",
    sections: [
      { n: "2.1", title: "What an LLM actually is", items: ["Trained on a fixed snapshot", "Knowledge cutoff dates and what they imply", "Probabilistic generation, not retrieval", "Why the same prompt gives different outputs"] },
      { n: "2.2", title: "How an LLM thinks", items: ["BPE tokenization — why \"hello\" is 1 token but \"antidisestablishmentarianism\" is 6", "Context windows — what fits, what gets silently truncated", "Sampling parameters: temperature, top-p, top-k — when to set what", "Transformer at 30,000 feet — attention preserves position, no math, no multi-head diagrams", "Why long context degrades (\"lost in the middle\")"] },
      { n: "2.3", title: "Reasoning models vs base models", items: ["The 2025 split: o1 / o3, Claude 3.7 thinking, Gemini 2.5 thinking, DeepSeek R1, Qwen QwQ", "What \"thinking tokens\" actually are and why they're billed", "When reasoning models are worth the latency and cost", "Reasoning effort knobs (low / medium / high) and how to budget them", "When a base model + good prompting beats a thinking model"] },
      { n: "2.4", title: "Reading model evals & benchmarks", items: ["The benchmarks worth knowing — MMLU, GSM8K, HumanEval, SWE-bench, GPQA, MMMU, BFCL (function calling)", "Why benchmarks lie — contamination, prompt sensitivity, eval gaming", "How to read a leaderboard skeptically (LMArena, Artificial Analysis, Vellum, Aider)", "Building your own micro-eval for the task you actually care about"] },
      { n: "2.5", title: "How to choose the models for your task", items: ["GPT family, Claude family, Gemini, Llama, Mistral, DeepSeek, Qwen", "Cost vs quality vs speed vs context-length tradeoffs", "When model choice matters vs when it really doesn't"] }
    ]
  },
  {
    id: 3,
    title: "Prompt Engineering & API Access",
    short: "Prompt Engineering",
    color: "purple",
    weeks: "Weeks 5–7",
    weeksDetail: "3 weeks · 6 modules",
    difficulty: 2,
    summary: "The pivot from \"ChatGPT user\" to \"engineer who controls LLMs.\"",
    endState: "You can take a flaky prompt that works \"sometimes\" and systematically make it reliable — and cut its cost in half with caching while you're at it.",
    sections: [
      { n: "3.1", title: "UI vs API - Calling LLM's via API", items: ["Why the chat UI and the API give different output — hidden system prompts & silent tools, and why production runs on the API", "Calling LLMs via the OpenAI & Anthropic SDKs", "Message format — system / user / assistant turns", "Streaming responses", "Structured output — JSON mode, tool-call schemas, XML tags"] },
      { n: "3.2", title: "Prompt Engineering", items: ["Prompt anatomy — system prompt vs user turn vs assistant prefill", "Role & persona assignment; positive framing over negative constraints", "Structuring prompts — Markdown vs XML, and when each wins", "Zero-shot vs few-shot with curated examples", "COSTAR framework (Context, Objective, Style, Tone, Audience, Response) + iterative refinement loop"] },
      { n: "3.3", title: "Context Engineering", items: ["Context engineering vs prompt engineering — supplying the right info, not just better wording", "What goes in the window — retrieved docs, tool outputs, memory, system state", "Token budgeting & ordering — avoiding \"lost in the middle\"", "Compression, summarization, and selective inclusion to stay in budget"] },
      { n: "3.4", title: "Applied prompt patterns", items: ["Extraction (entities, dates, relationships)", "Classification (intent, sentiment, routing)", "Transformation (summarize, translate, reformat)", "Generation (reports, SQL, code)", "Decomposition (break complex queries into sub-prompts)"] },
      { n: "3.5", title: "Advanced reasoning techniques", items: ["Chain of Thought — \"think step by step\"", "Self-Consistency — sample multiple paths, majority vote", "Self-Refine — generate, critique, refine loop", "Least-to-Most — decompose hard problems into ordered sub-problems", "Tree of Thought (research-flavoured; mention but don't drill)"] },
      { n: "3.6", title: "Prompt management & cost in production", items: ["Versioning prompts in code vs as managed resources", "A/B testing prompt variants", "AWS Bedrock Prompt Management for the lifecycle without code deploys", "Prompt caching — Anthropic cache_control and OpenAI's automatic cached input pricing (5–10× cost cuts on long system prompts)", "DSPy — programmatic prompt optimisation when you want the framework to tune your prompts for you (mention; depth is optional)"] }
    ]
  },
  {
    id: 4,
    title: "RAG + Evaluation",
    short: "Ingestion Pipeline + RAG",
    color: "pink",
    weeks: "Weeks 8–12",
    weeksDetail: "5 weeks · 9 modules",
    difficulty: 4,
    capstone: 1,
    summary: "The longest phase. RAG looks simple in tutorials and is brutal in production.",
    endState: "You can build a RAG system, measure why it's wrong, and fix it with data instead of vibes.",
    sections: [
      { n: "4.1", title: "Why RAG exists", items: ["LLMs can't see your private data", "The brain-in-a-windowless-room reaches its limit", "Use cases: internal docs, company policies, recent data"] },
      { n: "4.2", title: "Chunking strategies", items: ["Fixed-width chunking and why it breaks", "Semantic chunking by structure", "Overlap windows", "Parent-child chunking", "Late chunking — embed first, chunk later — preserves context across boundaries", "Chunk size vs retrieval quality tradeoff"] },
      { n: "4.3", title: "RAG pipeline — ingestion, retrieval, embeddings", items: ["The two halves: indexing (parse → chunk → embed → store) and retrieval (embed query → similarity search → generate)", "Parsing and loading documents, then chunking from scratch — no LangChain, so you see what the one-liner hides", "Embedding models — all-MiniLM-L6-v2 (384-dim, free) vs OpenAI text-embedding-3 (1536-dim, paid); dimensions vs quality vs storage cost", "Storing chunks + vectors + metadata (source file) in ChromaDB, and why metadata is what makes answers citable", "Cosine similarity and top-k retrieval — scoring the query against every chunk, and how k=3 vs k=10 changes the answer", "Grounded generation — stuffing retrieved chunks into the prompt, a system prompt that forces \"I don't have enough context\", temperature ~0.2"] },
      { n: "4.4", title: "Agentic RAG", items: ["Why naive RAG breaks — one-shot retrieval, no query rewriting, wrong-k failures, no idea when it's wrong", "Retrieval as a tool — the `finish_reason: tool_calls` branch, letting the model decide *whether* and *what* to search", "Query planning and rewriting — decomposing multi-part questions, multi-hop retrieval across documents", "Self-correcting retrieval — grade the retrieved chunks, re-query when relevance is low (Corrective RAG, Self-RAG)", "Routing — choosing the right collection, index, or tool per query instead of one global vector store", "Loop control — max retrieval steps, latency and token budgets, and falling back to \"I don't know\" instead of looping forever"] },
      { n: "4.5", title: "Chunk enrichment", items: ["PII detection and redaction", "NER for entities", "Key-phrase extraction", "Metadata for hybrid search"] },
      { n: "4.6", title: "Vector databases", items: ["Pinecone, Weaviate, pgvector", "Chroma for local dev", "S3 Vector Buckets, OpenSearch", "HNSW vs IVF indexes", "Decision matrix: managed (Pinecone) vs self-hosted (Weaviate, Qdrant) vs in-process (Chroma, FAISS) vs already-in-your-stack (pgvector)"] },
      { n: "4.7", title: "Hybrid retrieval & next-gen retrievers", items: ["Vector search + BM25 keyword", "Reranking with cross-encoders (Cohere Rerank, BGE)", "Metadata filtering", "Query expansion", "Late-interaction retrievers — ColBERT (text), ColPali (multimodal/PDF pages as images) — when they beat dense retrieval and what they cost"] },
      { n: "4.8", title: "Graph-augmented RAG", items: ["Neo4j basics", "Cypher query language", "When graph relationships beat pure vector search", "Multi-hop queries"] },
      { n: "4.9", title: "RAG evaluation — the part most courses skip", items: ["LLM-as-judge: RAG Triad — Faithfulness, Context Relevance, Answer Relevance", "Deterministic retrieval metrics: Precision@k, Recall@k, F1, Hit Rate@k, MRR, NDCG@k", "Tooling: Ragas (the de-facto eval framework), MLflow for run logging, LangSmith for tracing", "Golden datasets: Q&A pairs with expected chunks, regression testing on every code change"] }
    ]
  },
  {
    id: 5,
    title: "Tools, MCP, and Single Agents",
    short: "Tools, MCP & Single Agents",
    color: "emerald",
    weeks: "Weeks 13–16",
    weeksDetail: "4 weeks · 8 modules",
    difficulty: 4,
    summary: "The brain gets hands and legs.",
    endState: "You can build a single agent that searches the web, reads internal docs, queries a DB, and emails you a summary — and stops if it tries to do something dumb.",
    sections: [
      { n: "5.1", title: "Function calling / tool use", items: ["Tool schemas (JSON Schema, Pydantic)", "How the LLM decides which tool to call", "Parsing tool-call responses", "Handling tool errors gracefully"] },
      { n: "5.2", title: "Tool design principles", items: ["One tool, one job", "Clear docstrings — the LLM reads them", "Return structured data, not free text", "Fallbacks inside tools, not in the agent"] },
      { n: "5.3", title: "MCP — Model Context Protocol", items: ["What MCP is and why it exists (universal adapter for tools)", "MCP servers vs MCP clients", "Using existing MCP servers (filesystem, GitHub, Slack)", "Building your own MCP server", "stdio vs HTTP transports", "MCP is moving fast — bookmark modelcontextprotocol.io and re-read the spec every few months; the registry, auth model, and resource semantics are still evolving"] },
      { n: "5.4", title: "The ReAct pattern", items: ["Reasoning + Acting loop", "Thought → action → observation → thought", "Why \"thinking\" models exist", "When to force ReAct vs let the model decide"] },
      { n: "5.5", title: "LangChain agents", items: ["create_agent — model + tools + middleware + store", "@tool(parse_docstring=True) for auto schemas", "Parallel tool execution with asyncio.gather", "Structured outputs via Pydantic"] },
      { n: "5.6", title: "Human in the loop", items: ["HumanInTheLoopMiddleware for sensitive operations", "Checkpointers and InMemorySaver", "Resume flows after human approval", "When to pause (DB writes, payments, emails)"] },
      { n: "5.7", title: "Tool security", items: ["Retrieval Sanitiser — strip injection patterns from tool results", "Read-only DB enforcement", "Max retries per tool", "Timeouts on every external call"] },
      { n: "5.8", title: "Computer use & app SDKs — agents with eyes and a mouse", items: ["Anthropic Computer Use — agent takes screenshots and drives a desktop/browser", "OpenAI Operator / Apps SDK — agent runs inside ChatGPT or controls a browser tab", "Browser-automation agents (Playwright + LLM, browser-use, Stagehand)", "When this is the right tool vs API integration", "Sandboxing, audit trails, and \"are you sure?\" gates — these agents can do real damage"] }
    ]
  },
  {
    id: 6,
    title: "Memory & Context Engineering",
    short: "Memory + Context Engineering",
    color: "amber",
    weeks: "Weeks 17–19",
    weeksDetail: "3 weeks · 7 modules",
    difficulty: 4,
    difficultyNote: "Advanced — but the highest-leverage skill in the whole curriculum.",
    summary: "The hardest conceptual phase. Easy to do badly, expensive when you do. Worth every hour of attention.",
    endState: "You can explain why your agent forgot what you said three turns ago, and fix it with the right memory layer instead of throwing more tokens at it.",
    sections: [
      { n: "6.1", title: "The context window as working memory", items: ["Why agents \"forget\" mid-conversation", "Token budgeting per section", "The lost-in-the-middle problem", "Recency bias"] },
      { n: "6.2", title: "Context structure — SYSTEM / CONTEXT / USER separation", items: ["What goes where", "@dynamic_prompt patterns", "Structural separation as a security defence against prompt injection", "Token budgets per section (e.g. SYSTEM=instructions, CONTEXT=retrieved data, ~2000 tokens each)"] },
      { n: "6.3", title: "Short-term memory — session history", items: ["Sliding window of last N turns", "Message-pair preservation (don't split user from assistant)", "When to keep tool calls in history vs strip them"] },
      { n: "6.4", title: "Semantic caching", items: ["FAISS IndexFlatIP for sub-millisecond cosine search", "Similarity thresholds (0.97 high-stakes, 0.88 general Q&A)", "Cache HIT skips everything downstream", "Daemon-thread writes so cache never blocks response"] },
      { n: "6.5", title: "Episodic memory", items: ["LangChain's InMemoryStore", "LLM tags answers as EPISODIC: YES/NO so the model decides what's worth remembering", "Episodic hits enrich CONTEXT only — tools and LLM still run"] },
      { n: "6.6", title: "Context compression", items: ["Trigger threshold (>3000 tokens)", "Keep last 10 messages verbatim", "LLM summarises the rest into a single compressed entry", "When compression destroys information"] },
      { n: "6.7", title: "Long-term memory", items: ["User profiles, preferences, facts to persist", "Vector stores vs structured stores", "Managed memory layers — mem0 (open-source) and Zep (managed) — when to skip building this yourself", "When memory becomes a privacy problem (GDPR, right-to-be-forgotten flows)"] }
    ]
  },
  {
    id: 7,
    title: "Multi-Agent Orchestration",
    short: "Multi-Agent Orchestration",
    color: "rust",
    weeks: "Weeks 20–22",
    weeksDetail: "3 weeks · 8 modules",
    difficulty: 5,
    capstone: 2,
    summary: "When one agent isn't enough.",
    endState: "You can design a multi-step agent workflow on a whiteboard, build it in LangGraph, and debug it when one node loops infinitely.",
    sections: [
      { n: "7.1", title: "When to go multi-agent (and when not to)", items: ["Single-agent-with-tools beats multi-agent for ~80% of tasks", "Multi-agent earns its weight when steps need different prompts, tools, or specialised reasoning", "The Tableau→QuickSight conversion case as a worked example"] },
      { n: "7.2", title: "LangGraph fundamentals", items: ["Nodes, edges, state", "StateGraph and reducers", "Conditional edges and routing", "Cycles and termination conditions"] },
      { n: "7.3", title: "Common patterns", items: ["Supervisor + workers", "Sequential pipeline", "Parallel fan-out / fan-in", "Plan-and-execute", "Reflection loops"] },
      { n: "7.4", title: "Agent-as-tool — the lightweight alternative", items: ["Wrap a sub-agent behind a normal @tool interface", "Parent agent calls it like any other function — no graph, no state plumbing", "When this beats LangGraph (clear hierarchy, no shared state, deterministic flow)", "Composing specialist agents (researcher, summariser, critic) without orchestration overhead"] },
      { n: "7.5", title: "State management", items: ["Typed state with Pydantic", "What to put in state vs context", "Checkpointers for resumability (MemorySaver, SqliteSaver, PostgresSaver)"] },
      { n: "7.6", title: "A2A — Agent-to-Agent Protocol", items: ["Agent discovery and capability cards", "Cross-framework delegation", "When A2A beats just calling another function"] },
      { n: "7.7", title: "Frameworks compared (briefly)", items: ["LangGraph (most mature)", "CrewAI (simpler, opinionated)", "AutoGen (Microsoft)", "Pydantic AI (typed, FastAPI-flavoured ergonomics)", "OpenAI Swarm / its successor — minimal handoff-style orchestration", "Custom orchestration with raw asyncio", "Pick one and stick with it"] },
      { n: "7.8", title: "Debugging multi-agent systems", items: ["LangSmith tracing", "Why your agents are talking past each other", "Cycles that won't terminate", "Cost explosions"] }
    ]
  },
  {
    id: 8,
    title: "Guardrails & LLMOps",
    short: "Guardrails + LLMOps",
    color: "mustard",
    weeks: "Weeks 23–24",
    weeksDetail: "2 weeks · 4 modules",
    difficulty: 3,
    summary: "You know what to build. Now make it not embarrass you in production — measure failure, catch it before users do, and prove the agent is improving release-over-release.",
    endState: "You can put a number on how often your agent fails, and ship it anyway with confidence.",
    sections: [
      { n: "8.1", title: "Three-layer guardrail architecture", items: ["Input Guardrails (gateway, <1ms, deterministic): prompt-injection regex, PII redaction, out-of-domain rejection, toxic filter — code-based, never LLM", "Output Guardrails (LLM-judge OK): faithfulness, contradiction check, medical/legal disclaimers when confidence < threshold, hard-fail to safe fallback", "Action Guardrails (inside tools, pure functions): max retries, max tool calls per request, query validation, read-only DB, top_k caps"] },
      { n: "8.2", title: "AWS Bedrock Guardrails", items: ["Contextual grounding", "Automated reasoning checks", "Harmful content filtering", "Topic blocking", "When managed guardrails are enough vs custom"] },
      { n: "8.3", title: "LLMOps — observability", items: ["LangSmith / LangFuse for traces", "Token cost dashboards", "Latency percentiles (p50, p95, p99)", "Failure rate by tool, by route, by model"] },
      { n: "8.4", title: "LLMOps — evaluation in production", items: ["Golden dataset regression tests in CI", "A/B testing prompt and model changes", "Feedback loops from user thumbs-up/down", "Drift detection on retrieval quality"] }
    ]
  },
  {
    id: 9,
    title: "Cloud Infrastructure & Deployment",
    short: "Cloud + Deployment",
    color: "indigo",
    weeks: "Weeks 25–26",
    weeksDetail: "2 weeks · 6 modules",
    difficulty: 3,
    capstone: 3,
    summary: "The final mile. Minimum AWS to make everything earlier deployable, plus how to actually put an agent in production and keep costs sane.",
    endState: "You can take any system you built in earlier phases, dockerize it, deploy to ECS Fargate behind API Gateway, manage secrets, stream tokens to a chat UI, load-test it, and watch the cost dashboard move only when it should.",
    sections: [
      { n: "9.1", title: "Storage & data", items: ["S3 — durable object storage, document lakes", "RDS PostgreSQL — managed relational DB for agent state", "DynamoDB — KV state for ingestion pipelines"] },
      { n: "9.2", title: "Compute", items: ["Lambda — serverless event-driven flows", "ECS Fargate — serverless containers for long-running agents", "ECR — container registry"] },
      { n: "9.3", title: "Networking & access", items: ["VPC, subnets, security groups (just enough not to break)", "IAM roles and policies", "API Gateway for exposing endpoints"] },
      { n: "9.4", title: "AI-specific services (and other clouds)", items: ["AWS Bedrock — managed foundation models", "AWS AgentCore — production agent infrastructure", "Bedrock embeddings", "Equivalents on other clouds: GCP Vertex AI (Model Garden, Agent Builder) and Azure AI Foundry (model catalog, prompt flow) — same primitives, different SKUs"] },
      { n: "9.5", title: "Deployment & realtime delivery", items: ["Dockerizing FastAPI agents", "ECS Fargate task definitions", "API Gateway + ALB routing", "Secrets management with AWS Secrets Manager", "Environment promotion (dev → staging → prod)", "Streaming responses to chat UIs — SSE for one-way token streaming, WebSockets when you also need client → server messages mid-stream"] },
      { n: "9.6", title: "Cost & capacity control", items: ["Semantic cache HIT rate as a KPI", "Model routing — cheap model for simple queries, expensive for complex", "Prompt compression", "Max-tokens caps", "Load testing with locust or k6 — agents fall over under concurrency long before the LLM does; rate-limit at the gateway, not the model"] }
    ]
  }
];

window.CAPSTONES = [
  {
    n: 1,
    title: "Distributed Document Ingestion + RAG Pipeline",
    phase: "Built during Phase 4 · Weeks 10–12",
    domain: "Unstructured document Q&A (legal, pharma, technical docs)",
    build: [
      "PDF ingestion: Docling layout detection → semantic chunking → PII redaction → entity extraction → embeddings → Pinecone + Neo4j",
      "Distributed async workers on ECS Fargate processing thousands of PDFs concurrently",
      "DynamoDB state tracking per document (queued / processing / done / failed)",
      "Hybrid retrieval (vector + BM25 + graph) with reranking",
      "Evaluation harness with golden dataset, Precision@k / Recall@k / RAG Triad",
      "FastAPI Q&A endpoint with citation-backed answers"
    ],
    stack: ["Docling", "Pinecone", "Neo4j", "ECS Fargate", "DynamoDB", "S3", "Bedrock embeddings", "LangSmith"],
    proves: "You can build production RAG, not a Streamlit demo."
  },
  {
    n: 2,
    title: "Multi-Agent Natural Language → SQL on E-commerce Data",
    phase: "Built during Phase 7 · Weeks 21–22",
    domain: "E-commerce analytics for non-technical users",
    build: [
      "Multi-agent: Planner → SQL Writer → Validator → Executor → Explainer",
      "Schema-aware context injection per query (only relevant tables sent to writer)",
      "LangGraph orchestration with conditional routing and retry loops",
      "Read-only DB enforcement, query timeout, max-row caps",
      "Streamlit frontend, FastAPI backend, RDS PostgreSQL with realistic data",
      "Benchmarked on a golden NLQ test set, target 85%+ accuracy"
    ],
    stack: ["LangChain", "LangGraph", "LangSmith", "AgentCore", "RDS PostgreSQL", "FastAPI", "Streamlit", "Bedrock"],
    proves: "You can orchestrate multiple specialised agents safely against real production data."
  },
  {
    n: 3,
    title: "Clinical Trials Knowledge Base",
    phase: "Built during Phases 8–9 · Weeks 23–26",
    domain: "Life sciences AI (substitute legal, finance, or your industry)",
    build: [
      "Real ClinicalTrials.gov dataset ingestion (or your domain equivalent)",
      "Hybrid knowledge layer: Pinecone for unstructured PDFs + Neo4j for trial-drug-condition relationships",
      "Multi-hop relationship queries (\"what other trials used drug X for condition Y?\")",
      "Full three-layer guardrails — disclaimer auto-injection, contradiction checks, action limits",
      "Evidence-backed answers — every claim cites the source chunk",
      "Deployed on AWS with monitoring, regression tests in CI, semantic cache, cost dashboard"
    ],
    stack: ["LangChain", "LangGraph", "Neo4j + Cypher", "Pinecone", "Bedrock + AgentCore + Lambda", "S3", "LangSmith", "MLflow"],
    proves: "You can ship an agent into a regulated domain without it killing anyone (or your career)."
  }
];

window.OUT_OF_SCOPE = [
  {
    title: "Fine-tuning foundation models",
    why: "RAG, prompting, and tool use solve 95% of business problems faster, cheaper, and with no infra overhead. Fine-tuning earns its weight only when you have a narrow domain, lots of clean labelled data, and prompting has hit a wall — which almost never happens before you've shipped your first agent. Learn it after this roadmap, not during.",
    pointer: "Start with LoRA + a 7B open model (Llama, Mistral, Qwen) on a single A10/L4 once you have a real motivating use case."
  },
  {
    title: "Voice agents",
    why: "A whole sub-discipline — STT, TTS, turn-taking, latency budgets, barge-in. Worth its own track, not a side note. You can graft it on top of any agent you build in this roadmap.",
    pointer: "OpenAI Realtime API, Deepgram + ElevenLabs + LiveKit, or pipecat — pick after you've shipped one text agent."
  },
  {
    title: "ML fundamentals (gradient descent, backprop, transformers from scratch)",
    why: "Lovely to know. Not required to be an excellent agent engineer in 2026. The Karpathy series is there when you're curious — don't let it block you from shipping.",
    pointer: "Andrej Karpathy's \"Neural Networks: Zero to Hero\" + the \"Let's build GPT\" video, on weekends."
  },
  {
    title: "Frontend frameworks (Next.js, React, Tailwind)",
    why: "You need enough to ship a Streamlit or basic chat UI for capstones. Beyond that, partner with a frontend engineer or a design system. Don't get lost in framework wars.",
    pointer: "Streamlit for internal tools, Vercel AI SDK + Next.js when you need a real product UI."
  }
];

// Default materials slot per phase (admin or data.js can fill Drive URLs)
window.ROADMAP.forEach((p) => {
  if (!p.materials) {
    p.materials = {
      driveFolderUrl: null,
      driveZipUrl: null,
      label: p.title ? `${p.title} — materials` : 'Phase materials',
    };
  }
});

window.NEXT_STEPS = [
  {
    label: "Portfolio",
    title: "Three repos, three READMEs, one demo video each",
    body: "The capstones are your portfolio. For each one: a clean GitHub repo with a README that explains the problem, the architecture, the trade-offs, and the eval numbers; a 90-second Loom walking through it; one screenshot of the trace UI showing it actually working."
  },
  {
    label: "LinkedIn",
    title: "Headline that says what you can ship",
    body: "Don't write \"AI Engineer\" in your headline — write \"AI Engineer · production RAG, multi-agent systems, AWS Bedrock + LangGraph · shipping in regulated domains.\" Specific gets interviews. Generic gets ignored."
  },
  {
    label: "60-second pitch",
    title: "What to say in the first interview round",
    body: "\"I spent six months building three production-grade AI systems end-to-end: a distributed RAG pipeline that ingests thousands of PDFs, a multi-agent NL→SQL system with read-only enforcement, and a clinical-trials knowledge base with three-layer guardrails. I can show you the traces, the eval numbers, and the cost dashboard for any of them.\" That's the whole pitch. Numbers and artefacts beat adjectives."
  },
  {
    label: "Keep learning",
    title: "What to read once you're shipping",
    body: "Anthropic's \"Building effective agents\" essay, the Latent Space podcast, the LangChain blog, Eugene Yan's writing on production ML, and the original papers when something keeps confusing you (Self-RAG, RAG-as-judge, ReAct). Skim, don't drown."
  }
];

// Generative & Agentic AI Engineering course curriculum (paid course, distinct from the
// free public ROADMAP above). 15 modules, 73 submodules, 144 lessons — from Course_Curriculum_v2.pdf.
// Module order swapped vs the source PDF: RAG before MCP, Evaluation before Multi-Agent Orchestration.
window.COURSE_CURRICULUM = [
  {
    n: "01",
    title: "Python Fundamentals",
    tagline: "The Python you actually need before touching an LLM — from Colab setup to file handling.",
    project: "Command your Python basics: data structures, control flow, functions & file I/O",
    tools: ["Python", "Google Colab"],
    submodules: [
      { n: "1.1", secs: 790, title: "Google Colab Tutorial: Step-by-Step Guide for Beginners", lessons: ["Google Colab Tutorial: Step-by-Step Guide for Beginners"] },
      { n: "1.2", secs: 552, title: "Keywords, Identifiers & Comments", lessons: ["Keywords, Identifiers & Comments"] },
      { n: "1.3", secs: 750, title: "Indentation, Statements & Variables", lessons: ["Indentation, Statements & Variables"] },
      { n: "1.4", secs: 489, title: "Data Types vs Data Structures Explained", lessons: ["Data Types vs Data Structures Explained"] },
      { n: "1.5", secs: 1014, title: "Numeric Data Types & Strings", lessons: ["Numeric Data Types & Strings"] },
      { n: "1.6", secs: 984, title: "Lists in Python: Methods & Manipulation", lessons: ["Lists in Python: Methods & Manipulation"] },
      { n: "1.7", secs: 629, title: "Tuples in Python: Mastering Immutable Data Structures", lessons: ["Tuples in Python: Mastering Immutable Data Structures"] },
      { n: "1.8", secs: 702, title: "Sets in Python: Methods & Manipulations", lessons: ["Sets in Python: Methods & Manipulations"] },
      { n: "1.9", secs: 670, title: "Dictionaries in Python: Methods & Manipulation", lessons: ["Dictionaries in Python: Methods & Manipulation"] },
      { n: "1.10", secs: 429, title: "Type Casting in Python (Very Easy)", lessons: ["Type Casting in Python (Very Easy)"] },
      { n: "1.11", secs: 564, title: "Operators in Python — Part 1", lessons: ["Operators in Python — Part 1"] },
      { n: "1.12", secs: 671, title: "Bitwise Operators in Python & 2's Complement", lessons: ["Bitwise Operators in Python & 2's Complement"] },
      { n: "1.13", secs: 618, title: "If-Else Statement Tutorial in Python", lessons: ["If-Else Statement Tutorial in Python"] },
      { n: "1.14", secs: 659, title: "While Loops in Python: How to Avoid Infinite Loops", lessons: ["While Loops in Python: How to Avoid Infinite Loops"] },
      { n: "1.15", secs: 1103, title: "Python For Loop Tutorial: Real-Life Examples", lessons: ["Python For Loop Tutorial: Real-Life Examples"] },
      { n: "1.16", secs: 492, title: "Break vs Continue vs Pass Statement in Python", lessons: ["Break vs Continue vs Pass Statement in Python"] },
      { n: "1.17", secs: 1539, title: "Functions in Python", lessons: ["Functions in Python"] },
      { n: "1.18", secs: 1241, title: "Arguments vs Parameters in Functions (args vs kwargs)", lessons: ["Arguments vs Parameters in Functions (args vs kwargs)"] },
      { n: "1.19", secs: 1590, title: "Map, Reduce & Filter in Python: Inbuilt vs User-Defined", lessons: ["Map, Reduce & Filter in Python: Inbuilt vs User-Defined"] },
      { n: "1.20", secs: 1292, title: "Recursive Functions & Lambda Functions in Python", lessons: ["Recursive Functions & Lambda Functions in Python"] },
      { n: "1.21", secs: 1466, title: "Exception Handling in Python: try / except / finally", lessons: ["Exception Handling in Python: try / except / finally"] },
      { n: "1.22", secs: 1210, title: "File Handling in Python: Reading & Writing to Files", lessons: ["File Handling in Python: Reading & Writing to Files"] },
      { n: "1.23", secs: 1458, title: "NumPy Arrays Part 1", lessons: ["NumPy Arrays Part 1"] },
      { n: "1.24", secs: 1250, title: "NumPy Arrays Part 2", lessons: ["NumPy Arrays Part 2"] },
      { n: "1.25", secs: 1794, title: "NumPy Arrays Part 3", lessons: ["NumPy Arrays Part 3"] },
      { n: "1.26", secs: 1504, title: "Pandas Part 1", lessons: ["Pandas Part 1"] },
      { n: "1.27", secs: 1322, title: "Pandas Part 2", lessons: ["Pandas Part 2"] },
      { n: "1.28", secs: 890, title: "Pandas Part 3", lessons: ["Pandas Part 3"] },
      { n: "1.29", secs: 957, title: "Pandas Part 4", lessons: ["Pandas Part 4"] },
      { n: "1.30", secs: 1113, title: "Pandas Part 5", lessons: ["Pandas Part 5"] },
      { n: "1.31", secs: 1394, title: "Pandas Part 6", lessons: ["Pandas Part 6"] },
      { n: "1.32", secs: 1190, title: "Pandas Part 7", lessons: ["Pandas Part 7"] }
    ]
  },
  {
    n: "02",
    title: "Advanced Python",
    tagline: "The Python that agent frameworks are actually written in — OOP, APIs, and your first LangChain build.",
    project: "Your own mini LangChain, built from scratch and installable as a package",
    tools: ["Python OOP", "Dataclasses", "requests", "OpenAI & Groq APIs", "LangChain"],
    submodules: [
      { n: "2.1", secs: 253, title: "Module Overview & Capstone Project", lessons: ["Module Overview & Capstone Project"] },
      { n: "2.2", secs: 614, title: "Python OOP - Why OOP Concepts Matter", lessons: ["Python OOP - Why OOP Concepts Matter"] },
      { n: "2.3", secs: 1407, title: "Python OOP - Classes and Instances", lessons: ["Python OOP - Classes and Instances"] },
      { n: "2.4", secs: 412, title: "Python OOP - slots", lessons: ["Python OOP - slots"] },
      { n: "2.5", secs: 1231, title: "Python OOP - Class Variables and Instance Variables", lessons: ["Python OOP - Class Variables and Instance Variables"] },
      { n: "2.6", secs: 518, title: "Python OOP - Need for Class Methods and Static Methods", lessons: ["Python OOP - Need for Class Methods and Static Methods"] },
      { n: "2.7", secs: 987, title: "Python OOP - Class Methods vs Static Methods", lessons: ["Python OOP - Class Methods vs Static Methods"] },
      { n: "2.8", secs: 1171, title: "Python OOP - Dunder Methods", lessons: ["Python OOP - Dunder Methods"] },
      { n: "2.9", secs: 184, title: "Python OOP - Why We Need Inheritance", lessons: ["Python OOP - Why We Need Inheritance"] },
      { n: "2.10", secs: 1045, title: "Python OOP - Class Inheritance in Detail", lessons: ["Python OOP - Class Inheritance in Detail"] },
      { n: "2.11", secs: 808, title: "Python OOP - Method Overriding and Polymorphism", lessons: ["Python OOP - Method Overriding and Polymorphism"] },
      { n: "2.12", secs: 840, title: "Python OOP - Property Decorator, Getter, Setter, and Deleter", lessons: ["Python OOP - Property Decorator, Getter, Setter, and Deleter"] },
      { n: "2.13", secs: 803, title: "Python OOP - Data Classes", lessons: ["Python OOP - Data Classes"] },
      { n: "2.14", secs: 828, title: "JSON — JavaScript Object Notation", lessons: ["JSON — JavaScript Object Notation"] },
      { n: "2.15", secs: 1586, title: "JSON in Code", lessons: ["JSON in Code"] },
      { n: "2.16", secs: 1225, title: "API Theory Explained", lessons: ["API Theory Explained"] },
      { n: "2.17", secs: 493, title: "How to Create a Groq API Key", lessons: ["How to Create a Groq API Key"] },
      { n: "2.18", secs: 568, title: "Creating and Saving an OpenAI API Key", lessons: ["Creating and Saving an OpenAI API Key"] },
      { n: "2.19", secs: 1385, title: "Communicating with APIs via Requests, OpenAI, and Groq", lessons: ["Communicating with APIs via Requests, OpenAI, and Groq"] },
      { n: "2.20", secs: 860, title: "Power of LangChain Framework", lessons: ["Power of LangChain Framework"] },
      { n: "2.21", secs: 2373, title: "Capstone - Building Your Own LangChain Project from Scratch", lessons: ["Capstone - Building Your Own LangChain Project from Scratch"] },
      { n: "2.22", secs: 253, title: "Loading Your Mini LangChain as a Package", lessons: ["Loading Your Mini LangChain as a Package"] }
    ]
  },
  {
    n: "03",
    title: "NLP Basics, Intuition-First",
    tagline: "Understand what text becomes before an LLM ever sees it.",
    project: "Semantic search over your own notes",
    tools: ["Tokens", "Embeddings", "Vector similarity", "Transformers"],
    submodules: [
      { n: "3.1", secs: 1473, title: "How Machines Understand Language", lessons: ["How Machines Understand Language"] },
      { n: "3.2", secs: 1315, title: "Tokenization", lessons: ["Tokenization"] },
      { n: "3.3", secs: 1279, title: "Tokenization Code", lessons: ["Tokenization Code"] },
      { n: "3.4", secs: 670, title: "Bag Of Words", lessons: ["Bag Of Words"] },
      { n: "3.5", secs: 956, title: "BOW Code", lessons: ["BOW Code"] },
      { n: "3.6", secs: 1265, title: "Cosine Similarity", lessons: ["Cosine Similarity"] },
      { n: "3.7", secs: 762, title: "Cosine Similarity Code", lessons: ["Cosine Similarity Code"] },
      { n: "3.8", secs: 1307, title: "TF-IDF Theory", lessons: ["TF-IDF Theory"] },
      { n: "3.9", secs: 846, title: "TF-IDF Code", lessons: ["TF-IDF Code"] },
      { n: "3.10", secs: 1918, title: "Word2Vec and Avg Word2Vec", lessons: ["Word2Vec and Avg Word2Vec"] },
      { n: "3.11", secs: 911, title: "Word2Vec Code", lessons: ["Word2Vec Code"] },
      { n: "3.12", secs: 2553, title: "Transformers Architecture", lessons: ["Transformers Architecture"] },
      { n: "3.13", secs: 1233, title: "Open Source vs Closed Source Embedding Models", lessons: ["Open Source vs Closed Source Embedding Models"] },
      { n: "3.14", secs: 568, title: "OpenAI API Key Creation Process", lessons: ["OpenAI API Key Creation Process"] },
      { n: "3.15", secs: 313, title: "Creating Voyage API Key", lessons: ["Creating Voyage API Key"] },
      { n: "3.16", secs: 1460, title: "Capstone Project: Semantic Search building", lessons: ["Capstone Project: Semantic Search building"] },
      { n: "3.17", secs: 758, title: "Cost vs Quality vs Infra Tradeoff", lessons: ["Cost vs Quality vs Infra Tradeoff"] }
    ]
  },
  {
    n: "04",
    title: "LLM Internals and LangChain",
    tagline: "Pick and control the right model for a job — and predict its cost.",
    project: "A cost-aware LLM client: multi-turn chat, controlled output, the right model per job",
    tools: ["OpenAI API", "Anthropic API", "LangChain"],
    submodules: [
      { n: "4.1", secs: 439, title: "How LLMs Are Built — The Four-Phase Lifecycle", lessons: ["How LLMs Are Built — The Four-Phase Lifecycle"] },
      { n: "4.2", secs: 1194, title: "LLM Pre-Training — Data Collection, Tokens, and Base Models", lessons: ["LLM Pre-Training — Data Collection, Tokens, and Base Models"] },
      { n: "4.3", secs: 219, title: "Supervised Fine-Tuning — Building Instruction-Following Models", lessons: ["Supervised Fine-Tuning — Building Instruction-Following Models"] },
      { n: "4.4", secs: 249, title: "RLHF — Aligning LLMs with Human Preferences", lessons: ["RLHF — Aligning LLMs with Human Preferences"] },
      { n: "4.5", secs: 396, title: "LLM Inference — Hallucinations, Knowledge Cutoffs, and Core Terms", lessons: ["LLM Inference — Hallucinations, Knowledge Cutoffs, and Core Terms"] },
      { n: "4.6", secs: 784, title: "Context Windows — Limits, Long Conversations, and Hallucinations", lessons: ["Context Windows — Limits, Long Conversations, and Hallucinations"] },
      { n: "4.7", secs: 446, title: "Context Engineering — Managing Context for Better LLM Performance", lessons: ["Context Engineering — Managing Context for Better LLM Performance"] },
      { n: "4.8", secs: 1011, title: "Reading LLM API Responses — OpenAI, Anthropic, and JSON", lessons: ["Reading LLM API Responses — OpenAI, Anthropic, and JSON"] },
      { n: "4.9", secs: 1432, title: "Controlling LLM Output — Multi-Turn Chats, Temperature, and Max Tokens", lessons: ["Controlling LLM Output — Multi-Turn Chats, Temperature, and Max Tokens"] },
      { n: "4.10", secs: 1205, title: "Reasoning vs Instruct Models — Choosing the Right LLM", lessons: ["Reasoning vs Instruct Models — Choosing the Right LLM"] },
      { n: "4.11", secs: 1251, title: "LLM API Cost Optimization — Reasoning Effort and Model Choice", lessons: ["LLM API Cost Optimization — Reasoning Effort and Model Choice"] },
      { n: "4.12", secs: 1631, title: "Evaluating LLMs — Benchmarks, Arenas, and Real-World Testing", lessons: ["Evaluating LLMs — Benchmarks, Arenas, and Real-World Testing"] },
      { n: "4.13", secs: 1655, title: "Choosing an LLM — Cost, Quality, Speed, and Deployment Trade-offs", lessons: ["Choosing an LLM — Cost, Quality, Speed, and Deployment Trade-offs"] },
      { n: "4.14", secs: 636, title: "The LangChain Ecosystem — Components, Tooling, and Use Cases", lessons: ["The LangChain Ecosystem — Components, Tooling, and Use Cases"] },
      { n: "4.15", secs: 3723, title: "LangChain — Working with Invoke, Stream, Batch, Reasoning", lessons: ["LangChain — Working with Invoke, Stream, Batch, Reasoning"] },
      { n: "4.16", secs: 1346, title: "Capstone Project — Building a Multi-Model Chatbot: Problem Overview", lessons: ["Capstone Project — Building a Multi-Model Chatbot: Problem Overview"] },
      { n: "4.17", secs: 3548, title: "Capstone Project — Building It Live", lessons: ["Capstone Project — Building It Live"] }
    ]
  },
  {
    n: "05",
    title: "Prompt Engineering",
    tagline: "Reliably get the behavior you want — the skill every agent call depends on.",
    project: "A pattern library of prompts you'll reuse in every agent call",
    tools: ["Prompt patterns", "Structured output"],
    submodules: [
      { n: "5.1", title: "Welcome & What This Module Unlocks", lessons: ["Welcome & What This Module Unlocks"] },
      { n: "5.2", title: "Why Prompt Engineering Exists", lessons: ["Why Prompt Engineering Exists"] },
      { n: "5.3", title: "The 5-Part Skeleton: Overview & Why It Works", lessons: ["The 5-Part Skeleton: Overview & Why It Works"] },
      { n: "5.4", title: "Part 1 · Role: Who the Model Should Be", lessons: ["Part 1 · Role: Who the Model Should Be"] },
      { n: "5.5", title: "Part 2 · Instruction: Saying Exactly What to Do", lessons: ["Part 2 · Instruction: Saying Exactly What to Do"] },
      { n: "5.6", title: "Part 3 · Context & Input", lessons: ["Part 3 · Context & Input"] },
      { n: "5.7", title: "Part 4 · Output Format", lessons: ["Part 4 · Output Format"] },
      { n: "5.8", title: "Prompt Templates & LCEL", lessons: ["Prompt Templates & LCEL"] },
      { n: "5.9", title: "Zero-Shot vs Few-Shot", lessons: ["Zero-Shot vs Few-Shot"] },
      { n: "5.10", title: "Chain-of-Thought & Reasoning Prompting", lessons: ["Chain-of-Thought & Reasoning Prompting"] },
      { n: "5.11", title: "Structured Output With Pydantic", lessons: ["Structured Output With Pydantic"] },
      { n: "5.12", title: "Meta-Prompting", lessons: ["Meta-Prompting"] },
      { n: "5.13", title: "Multimodal Prompting: Images In (Optional)", lessons: ["Multimodal Prompting: Images In (Optional)"] },
      { n: "5.14", title: "Capstone Upgrade I: Persona Editor & Template Picker", lessons: ["Capstone Upgrade I: Persona Editor & Template Picker"] },
      { n: "5.15", title: "Prompt Versioning & Externalization", lessons: ["Prompt Versioning & Externalization"] },
      { n: "5.16", title: "Testing Prompts: A Lightweight Eval Loop", lessons: ["Testing Prompts: A Lightweight Eval Loop"] },
      { n: "5.17", title: "Prompt Caching", lessons: ["Prompt Caching"] },
      { n: "5.18", title: "Robust Structured Output", lessons: ["Robust Structured Output"] },
      { n: "5.19", title: "Observability Preview: Tracing With LangSmith", lessons: ["Observability Preview: Tracing With LangSmith"] },
      { n: "5.20", title: "Capstone Upgrade II + Recap & Look Ahead", lessons: ["Capstone Upgrade II + Recap & Look Ahead"] }
    ]
  },
  {
    n: "06",
    title: "Foundations of Agentic Systems",
    tagline: "Understand the agent loop deeply — because you built it by hand.",
    project: "Atlas gets a ReAct brain, live tools, and self-correction",
    tools: ["ReAct", "Tool calling", "Plan-and-Solve"],
    submodules: [
      { n: "6.1", title: "Kickoff: From Prompts to Agents", lessons: ["Kickoff: From Prompts to Agents"] },
      { n: "6.2", title: "What Is an Agent? Autonomy Levels", lessons: ["What Is an Agent? Autonomy Levels"] },
      { n: "6.3", title: "The Agent Loop: Think → Act → Observe", lessons: ["The Agent Loop: Think → Act → Observe"] },
      { n: "6.4", title: "ReAct in Plain English", lessons: ["ReAct in Plain English"] },
      { n: "6.5", title: "Build a Bare-Metal Agent Loop (No Framework)", lessons: ["Build a Bare-Metal Agent Loop (No Framework)"] },
      { n: "6.6", title: "Why the Model Needs Tools", lessons: ["Why the Model Needs Tools"] },
      { n: "6.7", title: "Function Calling 101", lessons: ["Function Calling 101"] },
      { n: "6.8", title: "Your First Tool, End to End", lessons: ["Your First Tool, End to End"] },
      { n: "6.9", title: "Multiple Tools & Tool Choice", lessons: ["Multiple Tools & Tool Choice"] },
      { n: "6.10", title: "Reliable Tool Inputs with Pydantic", lessons: ["Reliable Tool Inputs with Pydantic"] },
      { n: "6.11", title: "Calling a Real API as a Tool", lessons: ["Calling a Real API as a Tool"] },
      { n: "6.12", title: "When Tools Fail: Errors, Retries & Self-Correction", lessons: ["When Tools Fail: Errors, Retries & Self-Correction"] },
      { n: "6.13", title: "Tool Sandboxing: Running Actions Safely", lessons: ["Tool Sandboxing: Running Actions Safely"] },
      { n: "6.14", title: "Cognitive Pattern: Plan-and-Solve", lessons: ["Cognitive Pattern: Plan-and-Solve"] },
      { n: "6.15", title: "Cognitive Pattern: Self-Reflection Loop", lessons: ["Cognitive Pattern: Self-Reflection Loop"] },
      { n: "6.16", title: "Why Tools Alone Fall Short → The Case for MCP", lessons: ["Why Tools Alone Fall Short → The Case for MCP"] },
      { n: "6.17", title: "Capstone Upgrade: A Tool-Using Support Agent", lessons: ["Capstone Upgrade: A Tool-Using Support Agent"] },
      { n: "6.18", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "07",
    title: "RAG — Retrieval-Augmented Generation",
    tagline: "Answer from your own documents — grounded and cited, not from memory.",
    project: "Document intelligence for Atlas — grounded, cited answers",
    tools: ["Vector DBs", "Chunking", "Reranking", "Graph RAG"],
    submodules: [
      { n: "7.1", title: "Kickoff: Why LLMs Need Your Data", lessons: ["Kickoff: Why LLMs Need Your Data"] },
      { n: "7.2", title: "The RAG Mental Model", lessons: ["The RAG Mental Model"] },
      { n: "7.3", title: "Chunking: Splitting Docs Without Losing Meaning", lessons: ["Chunking: Splitting Docs Without Losing Meaning"] },
      { n: "7.4", title: "Embeddings & Vector Stores, Wired Up", lessons: ["Embeddings & Vector Stores, Wired Up"] },
      { n: "7.5", title: "Build Naive RAG End-to-End", lessons: ["Build Naive RAG End-to-End"] },
      { n: "7.6", title: "Where Naive RAG Breaks", lessons: ["Where Naive RAG Breaks"] },
      { n: "7.7", title: "Better Retrieval: Hybrid Search & Metadata Filters", lessons: ["Better Retrieval: Hybrid Search & Metadata Filters"] },
      { n: "7.8", title: "Reranking: Putting the Best Chunk First", lessons: ["Reranking: Putting the Best Chunk First"] },
      { n: "7.9", title: "Query Transformation", lessons: ["Query Transformation"] },
      { n: "7.10", title: "Build Advanced RAG End-to-End", lessons: ["Build Advanced RAG End-to-End"] },
      { n: "7.11", title: "Graph RAG", lessons: ["Graph RAG"] },
      { n: "7.12", title: "Agentic RAG", lessons: ["Agentic RAG"] },
      { n: "7.13", title: "Multimodal RAG", lessons: ["Multimodal RAG"] },
      { n: "7.14", title: "Golden Datasets for RAG", lessons: ["Golden Datasets for RAG"] },
      { n: "7.15", title: "RAG Evaluation Metrics", lessons: ["RAG Evaluation Metrics"] },
      { n: "7.16", title: "Automating Evals: RAGAS + LLM-as-Judge", lessons: ["Automating Evals: RAGAS + LLM-as-Judge"] },
      { n: "7.17", title: "Tracing a RAG Pipeline", lessons: ["Tracing a RAG Pipeline"] },
      { n: "7.18", title: "Latency & Cost Breakdown", lessons: ["Latency & Cost Breakdown"] },
      { n: "7.19", title: "Caching for RAG", lessons: ["Caching for RAG"] },
      { n: "7.20", title: "Access Control: Document-Level Permissions", lessons: ["Access Control: Document-Level Permissions"] },
      { n: "7.21", title: "Role-Based Approvals & Guardrails", lessons: ["Role-Based Approvals & Guardrails"] },
      { n: "7.22", title: "Keeping the Index Fresh", lessons: ["Keeping the Index Fresh"] },
      { n: "7.23", title: "Capstone Upgrade: Production-Grade RAG for the Agent", lessons: ["Capstone Upgrade: Production-Grade RAG for the Agent"] },
      { n: "7.24", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "08",
    title: "MCP — Model Context Protocol",
    tagline: "Connect your agent to anything through one universal standard.",
    project: "An MCP server from scratch + a Gmail & Calendar MCP for Atlas",
    tools: ["MCP", "Gmail API", "Calendar API"],
    submodules: [
      { n: "8.1", title: "Kickoff: The Integration Mess Before MCP", lessons: ["Kickoff: The Integration Mess Before MCP"] },
      { n: "8.2", title: "What Is MCP? The “USB-C for Tools” Model", lessons: ["What Is MCP? The “USB-C for Tools” Model"] },
      { n: "8.3", title: "MCP Architecture: Hosts, Clients & Servers", lessons: ["MCP Architecture: Hosts, Clients & Servers"] },
      { n: "8.4", title: "MCP Primitives: Tools, Resources & Prompts", lessons: ["MCP Primitives: Tools, Resources & Prompts"] },
      { n: "8.5", title: "Transport: stdio vs HTTP/SSE", lessons: ["Transport: stdio vs HTTP/SSE"] },
      { n: "8.6", title: "Build Your First MCP Server", lessons: ["Build Your First MCP Server"] },
      { n: "8.7", title: "Add Resources & Prompts", lessons: ["Add Resources & Prompts"] },
      { n: "8.8", title: "Connect a Client to Your Server", lessons: ["Connect a Client to Your Server"] },
      { n: "8.9", title: "Debugging with the MCP Inspector", lessons: ["Debugging with the MCP Inspector"] },
      { n: "8.10", title: "Build an MCP for Gmail", lessons: ["Build an MCP for Gmail"] },
      { n: "8.11", title: "Build an MCP for Google Calendar", lessons: ["Build an MCP for Google Calendar"] },
      { n: "8.12", title: "OAuth for Google MCPs", lessons: ["OAuth for Google MCPs"] },
      { n: "8.13", title: "Plugging In Third-Party MCP Servers", lessons: ["Plugging In Third-Party MCP Servers"] },
      { n: "8.14", title: "Where MCP Falls Short", lessons: ["Where MCP Falls Short"] },
      { n: "8.15", title: "Securing an MCP Server", lessons: ["Securing an MCP Server"] },
      { n: "8.16", title: "Capstone Upgrade: An MCP Toolbelt for the Agent", lessons: ["Capstone Upgrade: An MCP Toolbelt for the Agent"] },
      { n: "8.17", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "09",
    title: "Memory & Optimization",
    tagline: "Remember across sessions without blowing the context window.",
    project: "Atlas remembers your preferences across sessions — on a token budget",
    tools: ["Vector memory", "Context engineering", "Token budgeting"],
    submodules: [
      { n: "9.1", title: "Kickoff: Why Agents Forget (and Why It Hurts)", lessons: ["Kickoff: Why Agents Forget (and Why It Hurts)"] },
      { n: "9.2", title: "Short-Term Memory & the Context Window", lessons: ["Short-Term Memory & the Context Window"] },
      { n: "9.3", title: "Conversation Buffers", lessons: ["Conversation Buffers"] },
      { n: "9.4", title: "Summarization Memory", lessons: ["Summarization Memory"] },
      { n: "9.5", title: "Long-Term Memory with Vector DBs", lessons: ["Long-Term Memory with Vector DBs"] },
      { n: "9.6", title: "User Profiling & Personalization", lessons: ["User Profiling & Personalization"] },
      { n: "9.7", title: "Episodic vs Semantic Memory", lessons: ["Episodic vs Semantic Memory"] },
      { n: "9.8", title: "Retrieving Memories: When to Recall What", lessons: ["Retrieving Memories: When to Recall What"] },
      { n: "9.9", title: "Token Budgeting", lessons: ["Token Budgeting"] },
      { n: "9.10", title: "Context Optimization", lessons: ["Context Optimization"] },
      { n: "9.11", title: "Context Engineering & Loop Engineering", lessons: ["Context Engineering & Loop Engineering"] },
      { n: "9.12", title: "Capstone Upgrade: Give the Agent Durable Memory", lessons: ["Capstone Upgrade: Give the Agent Durable Memory"] },
      { n: "9.13", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "10",
    title: "State Machines & DAGs (LangGraph)",
    tagline: "Control an agent's flow deterministically — and pause for a human.",
    project: "Atlas re-architected on LangGraph with approval checkpoints",
    tools: ["LangGraph", "State machines", "Human-in-the-loop"],
    submodules: [
      { n: "10.1", title: "Kickoff: When the Agent Loop Becomes Spaghetti", lessons: ["Kickoff: When the Agent Loop Becomes Spaghetti"] },
      { n: "10.2", title: "State as a Single Source of Truth", lessons: ["State as a Single Source of Truth"] },
      { n: "10.3", title: "Nodes, Edges & the Graph Model", lessons: ["Nodes, Edges & the Graph Model"] },
      { n: "10.4", title: "Your First LangGraph", lessons: ["Your First LangGraph"] },
      { n: "10.5", title: "Defining & Updating State", lessons: ["Defining & Updating State"] },
      { n: "10.6", title: "Conditional Edges", lessons: ["Conditional Edges"] },
      { n: "10.7", title: "Deterministic Routing", lessons: ["Deterministic Routing"] },
      { n: "10.8", title: "Cycles & Controlled Loops", lessons: ["Cycles & Controlled Loops"] },
      { n: "10.9", title: "Persistence & Checkpointing", lessons: ["Persistence & Checkpointing"] },
      { n: "10.10", title: "Human-in-the-Loop: Interrupts & Approvals", lessons: ["Human-in-the-Loop: Interrupts & Approvals"] },
      { n: "10.11", title: "Streaming Graph State to a UI", lessons: ["Streaming Graph State to a UI"] },
      { n: "10.12", title: "Capstone Upgrade: Rebuild the Agent as a Graph", lessons: ["Capstone Upgrade: Rebuild the Agent as a Graph"] },
      { n: "10.13", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "11",
    title: "Evaluation",
    tagline: "Prove your agent works and catch regressions before users do.",
    project: "A regression suite that blocks bad Atlas changes",
    tools: ["LLM-as-Judge", "Eval datasets", "Trajectory benchmarks"],
    submodules: [
      { n: "11.1", title: "Kickoff: You Can't Improve What You Can't Measure", lessons: ["Kickoff: You Can't Improve What You Can't Measure"] },
      { n: "11.2", title: "Why Agents Are Hard to Evaluate", lessons: ["Why Agents Are Hard to Evaluate"] },
      { n: "11.3", title: "Building an Eval Dataset (Golden Set)", lessons: ["Building an Eval Dataset (Golden Set)"] },
      { n: "11.4", title: "Success-Rate / Outcome Evaluation", lessons: ["Success-Rate / Outcome Evaluation"] },
      { n: "11.5", title: "Trajectory Evaluation", lessons: ["Trajectory Evaluation"] },
      { n: "11.6", title: "LLM-as-Judge", lessons: ["LLM-as-Judge"] },
      { n: "11.7", title: "Component vs End-to-End Evals", lessons: ["Component vs End-to-End Evals"] },
      { n: "11.8", title: "Regression Suites in CI", lessons: ["Regression Suites in CI"] },
      { n: "11.9", title: "Capstone Upgrade: An Eval Harness for the Agent", lessons: ["Capstone Upgrade: An Eval Harness for the Agent"] },
      { n: "11.10", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "12",
    title: "Multi-Agent Orchestration",
    tagline: "Make specialized agents collaborate without burning $400 in a loop.",
    project: "Atlas becomes a researcher + writer + critic team",
    tools: ["LangGraph", "OpenAI Agents SDK", "CrewAI"],
    submodules: [
      { n: "12.1", title: "Kickoff: When One Agent Isn't Enough", lessons: ["Kickoff: When One Agent Isn't Enough"] },
      { n: "12.2", title: "Specialized Agents: Roles & Responsibilities", lessons: ["Specialized Agents: Roles & Responsibilities"] },
      { n: "12.3", title: "Pattern: Supervisor / Hierarchical", lessons: ["Pattern: Supervisor / Hierarchical"] },
      { n: "12.4", title: "Pattern: Peer-to-Peer / Network", lessons: ["Pattern: Peer-to-Peer / Network"] },
      { n: "12.5", title: "Handoffs: Passing Control Between Agents", lessons: ["Handoffs: Passing Control Between Agents"] },
      { n: "12.6", title: "Communication: Shared State vs Message Passing (A2A / M2M)", lessons: ["Communication: Shared State vs Message Passing (A2A / M2M)"] },
      { n: "12.7", title: "Build a Supervisor Team in LangGraph", lessons: ["Build a Supervisor Team in LangGraph"] },
      { n: "12.8", title: "Framework Tour: LangGraph vs OpenAI Agents SDK vs CrewAI", lessons: ["Framework Tour: LangGraph vs OpenAI Agents SDK vs CrewAI"] },
      { n: "12.9", title: "Failure Modes: Loops, Deadlocks & Runaway Cost", lessons: ["Failure Modes: Loops, Deadlocks & Runaway Cost"] },
      { n: "12.10", title: "Capstone Upgrade: Split the Agent Into a Team", lessons: ["Capstone Upgrade: Split the Agent Into a Team"] },
      { n: "12.11", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "13",
    title: "Security & Guardrails",
    tagline: "Survive malicious users and handle sensitive data safely.",
    project: "Atlas locked down — guardrails, least privilege, PII redaction",
    tools: ["Guardrails", "Prompt-injection defense", "Sandboxing"],
    submodules: [
      { n: "13.1", title: "Kickoff: An Agent Is an Attack Surface", lessons: ["Kickoff: An Agent Is an Attack Surface"] },
      { n: "13.2", title: "Input Guardrails", lessons: ["Input Guardrails"] },
      { n: "13.3", title: "Output Guardrails", lessons: ["Output Guardrails"] },
      { n: "13.4", title: "Tool Guardrails", lessons: ["Tool Guardrails"] },
      { n: "13.5", title: "Human-in-the-Loop Approval Gates", lessons: ["Human-in-the-Loop Approval Gates"] },
      { n: "13.6", title: "Prompt Injection: How to Break Agents", lessons: ["Prompt Injection: How to Break Agents"] },
      { n: "13.7", title: "Defending Against Injection", lessons: ["Defending Against Injection"] },
      { n: "13.8", title: "Sandboxing & Least Privilege", lessons: ["Sandboxing & Least Privilege"] },
      { n: "13.9", title: "Secrets Management", lessons: ["Secrets Management"] },
      { n: "13.10", title: "PII Detection & Redaction", lessons: ["PII Detection & Redaction"] },
      { n: "13.11", title: "Capstone Upgrade: Harden the Agent", lessons: ["Capstone Upgrade: Harden the Agent"] },
      { n: "13.12", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "14",
    title: "Deployment (incl. FastAPI)",
    tagline: "Real users can use your agent over the internet.",
    project: "Atlas live on the internet with a chat UI",
    tools: ["FastAPI", "Docker", "Async", "CI/CD"],
    submodules: [
      { n: "14.1", title: "Kickoff: From Notebook to Service", lessons: ["Kickoff: From Notebook to Service"] },
      { n: "14.2", title: "Serving an Agent with FastAPI", lessons: ["Serving an Agent with FastAPI"] },
      { n: "14.3", title: "Streaming Responses over HTTP (SSE)", lessons: ["Streaming Responses over HTTP (SSE)"] },
      { n: "14.4", title: "Async for Agents", lessons: ["Async for Agents"] },
      { n: "14.5", title: "Containerizing with Docker", lessons: ["Containerizing with Docker"] },
      { n: "14.6", title: "Config & Secrets in Production", lessons: ["Config & Secrets in Production"] },
      { n: "14.7", title: "CI/CD: Ship on Every Push", lessons: ["CI/CD: Ship on Every Push"] },
      { n: "14.8", title: "Deploying to the Cloud", lessons: ["Deploying to the Cloud"] },
      { n: "14.9", title: "Reliability: Retries, Timeouts & Queues", lessons: ["Reliability: Retries, Timeouts & Queues"] },
      { n: "14.10", title: "Scaling: Workers, Concurrency & Rate Limits", lessons: ["Scaling: Workers, Concurrency & Rate Limits"] },
      { n: "14.11", title: "Capstone Upgrade: Deploy the Agent as an API", lessons: ["Capstone Upgrade: Deploy the Agent as an API"] },
      { n: "14.12", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "15",
    title: "Monitoring & Operations",
    tagline: "See what your live agent is doing, what it costs, and how to improve it.",
    project: "A cost & quality dashboard for live Atlas",
    tools: ["Langfuse", "LangSmith", "Tracing"],
    submodules: [
      { n: "15.1", title: "Kickoff: Flying Blind in Production", lessons: ["Kickoff: Flying Blind in Production"] },
      { n: "15.2", title: "Tracing an Agent, Step by Step", lessons: ["Tracing an Agent, Step by Step"] },
      { n: "15.3", title: "Observability with LangSmith", lessons: ["Observability with LangSmith"] },
      { n: "15.4", title: "Observability with Langfuse", lessons: ["Observability with Langfuse"] },
      { n: "15.5", title: "Logging & Structured Events", lessons: ["Logging & Structured Events"] },
      { n: "15.6", title: "Token & Cost Dashboards", lessons: ["Token & Cost Dashboards"] },
      { n: "15.7", title: "Latency & Performance Monitoring", lessons: ["Latency & Performance Monitoring"] },
      { n: "15.8", title: "Alerting on Failures & Regressions", lessons: ["Alerting on Failures & Regressions"] },
      { n: "15.9", title: "Feedback Loops & Continuous Improvement", lessons: ["Feedback Loops & Continuous Improvement"] },
      { n: "15.10", title: "Capstone Upgrade: Instrument the Deployed Agent", lessons: ["Capstone Upgrade: Instrument the Deployed Agent"] },
      { n: "15.11", title: "Recap & Look Ahead", lessons: ["Recap & Look Ahead"] }
    ]
  },
  {
    n: "16",
    title: "Capstone Projects & Portfolio",
    tagline: "Ship and monitor your OWN agentic product — portfolio-ready.",
    project: "Your own agentic product — built, deployed, monitored",
    tools: ["Full production stack", "Portfolio", "Interview prep"],
    submodules: [
      { n: "16.1", title: "Kickoff: Turning Skills Into a Portfolio", lessons: ["Kickoff: Turning Skills Into a Portfolio"] },
      { n: "16.2", title: "Choosing & Scoping Your Capstone", lessons: ["Choosing & Scoping Your Capstone"] },
      { n: "16.3", title: "Capstone A — Customer-Support Agent: Design", lessons: ["Capstone A — Customer-Support Agent: Design"] },
      { n: "16.4", title: "Capstone A — Build It Live", lessons: ["Capstone A — Build It Live"] },
      { n: "16.5", title: "Capstone B — Coding / Dev Agent: Design", lessons: ["Capstone B — Coding / Dev Agent: Design"] },
      { n: "16.6", title: "Capstone B — Build It Live", lessons: ["Capstone B — Build It Live"] },
      { n: "16.7", title: "Capstone C — Personal-Finance Agent: Design", lessons: ["Capstone C — Personal-Finance Agent: Design"] },
      { n: "16.8", title: "Capstone C — Build It Live", lessons: ["Capstone C — Build It Live"] },
      { n: "16.9", title: "Bonus — Voice-to-Voice Agent", lessons: ["Bonus — Voice-to-Voice Agent"] },
      { n: "16.10", title: "Portfolio & GitHub Polish", lessons: ["Portfolio & GitHub Polish"] },
      { n: "16.11", title: "Resume & Interview Prep", lessons: ["Resume & Interview Prep"] },
      { n: "16.12", title: "Course Wrap & What's Next", lessons: ["Course Wrap & What's Next"] }
    ]
  }
];

// ── Lesson runtimes for the curriculum section ───────────────────────────
// Recorded lessons carry real runtimes (`secs:` on each submodule). Upcoming
// lessons return null until their recordings are complete, so the UI can omit
// both lesson runtimes and module totals instead of inventing placeholder time.
window.COURSE_DURATION = (function () {
  function lessonSecs(sm) {
    return Number.isFinite(sm.secs) && sm.secs > 0 ? sm.secs : null;
  }
  function moduleSecs(mod) {
    if (Number.isFinite(mod.mins) && mod.mins > 0) return mod.mins * 60;
    const lessonTimes = (mod.submodules || []).map(lessonSecs);
    return lessonTimes.length && lessonTimes.every((secs) => secs != null)
      ? lessonTimes.reduce((total, secs) => total + secs, 0)
      : null;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return {
    lessonSecs,
    moduleSecs,
    // 08:21, or 1:02:03 once a lesson runs past the hour
    clock: (s) => {
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      const sec = pad(Math.round(s % 60));
      return h ? `${h}:${pad(m)}:${sec}` : `${pad(m)}:${sec}`;
    },
    // 3h 05m
    long: (s) => {
      const h = Math.floor(s / 3600), m = Math.round((s % 3600) / 60);
      return h ? `${h}h ${pad(m)}m` : `${m}m`;
    },
  };
})();

window.COURSE_INFO = {
  title: "Generative & Agentic AI Engineering",
  flagshipName: "Agentic AI at Production Level",
  // ponytail: derived from COURSE_CURRICULUM above so they can't go stale when modules are added
  moduleCount: window.COURSE_CURRICULUM.length,
  submoduleCount: window.COURSE_CURRICULUM.reduce((a, m) => a + m.submodules.length, 0),
  lessonCount: window.COURSE_CURRICULUM.reduce((a, m) => a + m.submodules.reduce((b, s) => b + (s.lessons || []).length, 0), 0),
  price: "Will reveal soon", // ponytail: string passes through priceFmt as-is; restore a number to show ₹ again
  // Curriculum header CTA — put the PDF's URL here and the "Download Syllabus"
  // button appears. Empty string = button hidden.
  syllabusUrl: "",
  // Flagship-card fact grid (label/value pairs)
  facts: [
    { k: "Format", v: "Self-paced" },
    { k: "Access", v: "2 years + all updates" },
    { k: "Level", v: "Starter → advanced" },
    { k: "Prereqs", v: "Start from scratch — no experience needed" },
    { k: "Projects", v: "Hands-on production builds" },
    { k: "Certificate", v: "Verified on completion" }
  ],
  // Short includes list on the flagship card's price panel
  includes: [
    "Weekly live sessions on the latest topics",
    "Session recordings available for 2 years",
    "Private WhatsApp community",
    "Production-ready starter templates & code reviews"
  ],
  // Pricing-card feature list
  pricingIncludes: [
    `All ${window.COURSE_CURRICULUM.length} modules, fully self-paced`,
    "Production-ready starter templates & code",
    "Private community & code reviews",
    "Verified certificate on completion",
    "Mock interviews & resume prep assistance",
    "2 years of access, including all updates in that window"
  ]
};

// "Projects you will build" cards for the Courses tab.
window.COURSE_PROJECTS = [
  {
    num: "01",
    title: "Mini LangChain From Scratch",
    desc: "Build the core building blocks behind LangChain — model loading, chat-model abstractions, provider integrations, and APIs.",
    tags: ["Python OOPs", "Abstractions", "Model Providers", "Streaming", "APIs"],
    lightImage: "uploads/Project1-light_mode.png",
    darkImage: "uploads/project1-dark-mode.png",
  },
  {
    num: "02",
    title: "Semantic Search Over Your Documents",
    desc: "Use embedding models and cosine similarity to build a semantic search engine over your own documents — from chunking to top-K results.",
    tags: ["Embeddings", "Semantic Search", "Cosine Similarity", "Vector Store", "Python"],
    lightImage: "uploads/project2_light_mode.png",
    darkImage: "uploads/project2_dark_mode.png",
  },
  {
    num: "03",
    title: "Multi-Model Chatbot With Full Control",
    desc: "Build a powerful chatbot that lets users switch providers and tune temperature, reasoning, and streaming with LangChain and Streamlit.",
    tags: ["LangChain", "Multi-Model", "Custom Parameters", "Streaming", "Streamlit", "Python"],
    lightImage: "uploads/project3_light_mode.png",
    darkImage: "uploads/project3_dark_mode.png",
  },
  {
    num: "04",
    title: "Upgrade Your Chatbot With Advanced Prompting",
    desc: "Add prompt templates, versioning, LCEL chains, conversation history, and prompt caching for faster, more reliable responses.",
    tags: ["Prompt Templates", "Prompt Versioning", "LCEL", "Conversation History", "Prompt Caching", "Python"],
    lightImage: "uploads/project4_light_mode.png",
    darkImage: "uploads/project4_dark_mode.png",
  },
  {
    num: "05",
    title: "Upgrade Your Chatbot With Agentic Power",
    desc: "Add an agentic loop with Plan-Act-Observe-Reflect, powerful tools, self-correction, retry limits, and a plan-and-solve strategy.",
    tags: ["Agentic Loop", "Tools", "Web Search", "Email Reader", "APIs", "Self-Correction", "Retry & Limits", "Plan & Solve", "Python"],
    lightImage: "uploads/project5_light_mode.png",
    darkImage: "uploads/project5_dark_mode.png",
  },
  {
    num: "06",
    title: "Advanced RAG System",
    desc: "Build a production-ready RAG system with advanced indexing, hybrid search, reranking, low-latency design, evaluations, and RBAC.",
    tags: ["Indexing Pipeline", "Hybrid Search", "Reranking", "Metadata Filtering", "Low Latency", "Evaluations", "RBAC", "Production Ready", "Python"],
    lightImage: "uploads/project6_light_mode.png",
    darkImage: "uploads/project6_dark_mode.png",
  },
  {
    num: "07",
    title: "Build MCP Server for Google Services & Integrate with Chatbot",
    desc: "Build an MCP server from scratch for Google Calendar, Gmail, Google Drive, and more, then integrate it with a LangChain chatbot.",
    tags: ["MCP", "MCP from Scratch", "Google Calendar", "Gmail", "Google Drive", "OAuth 2.0", "LangChain Agent", "Secure & Scalable", "Python"],
    lightImage: "uploads/project7_light_mode.png",
    darkImage: "uploads/project7_dark_mode.png",
  },
  {
    num: "08",
    title: "Memory-Powered Personalized Chatbot",
    desc: "Add short-term, summary, long-term, profile, and episodic memory with intelligent recall for smarter, personalized conversations.",
    tags: ["Conversation Buffer", "Summarization", "Vector DB", "User Profiles", "Episodic Memory", "Memory Router", "Personalization", "Python"],
    lightImage: "uploads/project8_light_mode.png",
    darkImage: "uploads/project8_dark_mode.png",
  },
  {
    num: "09",
    title: "LangGraph Multi-Agent System",
    desc: "Build planner, researcher, coder, and reviewer agents that collaborate through A2A and M2M protocols with shared tools and memory.",
    tags: ["LangGraph", "Multi-Agent", "A2A Protocol", "M2M Protocol", "Shared Memory", "Scalable", "Production Ready"],
    lightImage: "uploads/project9_light_mode.png",
    darkImage: "uploads/project9_dark_mode.png",
  }
];

// Courses tab FAQ.
window.COURSE_FAQ = [
  { q: "Is this course beginner-friendly?", a: "Yes, completely. You can join with zero coding or AI background — we start from absolute scratch, including Python, and build up step by step until you're shipping production-grade agents. Every module is built on the previous one, so you're never dropped into a topic without the foundation for it. After every video there's a quick quiz, so you'll know immediately whether a concept landed or you just nodded along. And you're never stuck alone — post a doubt and we clear it within 24 hours." },
  { q: "I already watch your YouTube videos. How is this course different?", a: "My YouTube channel and the free 26-week roadmap will always stay free, and they're great for understanding concepts. But YouTube is one-way — I can't check whether you actually built anything, clear your doubts, or hold you to a sequence, which is why most people jump between videos and get stuck at the \"I understand it but can't build it\" stage. The course fixes exactly that: one structured path with quizzes, assignments, capstone projects, and one real product you keep upgrading from the first module to the last. Add doubt support within 24 hours, weekly live sessions, and biweekly updates. Simply put, YouTube tells you what to learn; the course makes sure you actually build it." },
  { q: "How much does the course cost?", a: "We haven't announced the price yet — we'll be revealing it in the first week of August. What I can tell you now: we're deliberately keeping it affordable compared to market alternatives, because I want serious students to be able to join, not just those with deep pockets. Whatever the number is, it covers everything — all modules, quizzes, assignments, capstones, doubt support within 24 hours, weekly live sessions, mock interviews, resume prep, and biweekly updates. And if you want to start today without spending anything, the free 26-week roadmap on this site is always open." },
  { q: "Can anyone join, or are there prerequisites?", a: "None. You don't need Python, an AI background, a CS degree, or work experience — the course starts from absolute scratch and takes you all the way to production level. Python itself is taught inside the course, so \"I don't know coding\" is not a reason to wait. I've mentored students from every branch, non-IT folks, and working professionals switching tracks, and the path works the same for all of them. The only thing I can't supply is discipline — bring daily consistency, and everything else is covered inside." },
  { q: "What exactly do I get inside the course?", a: "The biggest one is the structure: every module is built on top of the previous module, so the course flows as one continuous journey, and you carry one real product through it, upgrading it as your skills grow. After every video there's a quiz to check you actually understood rather than just watched. Every module has multiple assignments designed like real engineering tasks — concrete inputs, a clear deliverable, and \"done when\" criteria. Across the course you'll complete 3 capstone projects and 2 personal projects, so you finish with working systems you can demo in an interview, not empty repos. Around all of this sits the support layer: doubts cleared within 24 hours, weekly live sessions, mock interviews, resume prep, and biweekly updates." },
  { q: "I'm a working professional with experience. Is this still useful for me?", a: "Very much — a large chunk of my mentees are working professionals, and the course is built with high-demand roles like Forward Deployed Engineer (FDE) in mind. The gap I keep seeing with experienced folks: they can code and they've played with ChatGPT, but they've never taken an agent to production. That last mile — evaluation, observability, guardrails, memory, cost control, deployment — is exactly what companies are hiring for, and it's what most tutorials skip. The course spends serious time there instead of stopping at \"build a chatbot in 10 minutes\" demos. If you already ship software, this is the fastest route from \"I use AI tools\" to \"I build AI systems.\"" },
  { q: "Do I need prior AI/ML experience?", a: "No — you don't need to have trained a single ML model to become a strong agentic AI engineer. Classical ML, the math-heavy model-training track, is a different lane from what we do here. This course is about engineering with large language models: prompting them properly, giving them tools and memory, grounding them with RAG, and shipping all of it reliably. We build your LLM mental model from scratch in the early modules, so words like \"token\" and \"context window\" stop being intimidating very quickly. If you do have ML experience it won't hurt, but curiosity and consistency matter far more here than any background." },
  { q: "Will I get the code and resources?", a: "Yes — everything we build on screen, you get. Every lesson ships with its complete code, so you're never pausing a video to retype things from my editor. Assignments, notes, and resource guides are collected in one place instead of scattered across video descriptions, and since the course is updated biweekly, the code stays current too. One request though: don't just download and hoard. Run the code, break it, rebuild it — that's where the real learning happens." },
  { q: "What happens when I get stuck? How are doubts cleared?", a: "Post your doubt and we'll clear it within 24 hours — that's the promise. On top of that, we run weekly live doubt-clearing sessions where we take up the trickier questions, share screens, and debug together. You're also learning alongside a community working through the same modules, so you're never stuck alone at 1 AM wondering if you're the only one confused. One suggestion: spend 15–20 minutes genuinely trying to solve it yourself first, then ask with what you tried — that struggle is where debugging skill gets built." },
  { q: "Do I get a certificate?", a: "Yes, you'll receive a certificate once you complete the course. But I tell this to every student honestly: the certificate is not what gets you hired. Recruiters care about what you can build and how you explain it — your capstones, your GitHub, your ability to reason about why an agent failed and how you fixed it. The certificate is proof you finished something end to end, which does say something about your consistency. Just don't join for the certificate — join for the skills, and treat the certificate as the receipt." },
  { q: "Will this course get me a job?", a: "Honest answer, not the marketing one: nobody can guarantee you a job, and you should be suspicious of anyone who does. What I can tell you is that the skills in this course — RAG, agents, MCP, evaluation, deployment — are exactly what the market is hiring for right now, and there's a real shortage of people who can do this work at a production level. We also prepare you for the hiring process itself: mock interviews so the real one isn't your first attempt, and resume prep so your projects are presented the way recruiters actually read them. Your capstones and personal projects give you real, demo-able work to talk about instead of just \"I completed a course.\" The rest depends on you — my job is to make sure that when the interview comes, you're ready to crack it." },
  { q: "AI changes every week. Will the course stay updated?", a: "It has to be — AI moves at a pace where a six-month-old tutorial can already feel dated. So we update the course biweekly: refreshing lessons, swapping in current tools and model versions, and adding new content when something genuinely important lands, not for every shiny launch on social media. There's a balance I'm careful about, though: tools churn, but the underlying concepts — how agents reason, how RAG works, how you evaluate and deploy — transfer across whatever framework is trending. So the course is anchored in fundamentals that last, and the updates keep the tools and code you practice on current. You put in the learning once; the course keeps pace with the ecosystem for you." }
];

// Real student testimonials for the Courses tab. Leave empty until real
// quotes (with permission) exist — the section hides itself when empty.
// Shape: { quote, name, role }
window.COURSE_TESTIMONIALS = [];

// Hero + instructor copy for the Courses tab. Social links themselves live in
// V2_BRAND (v2.jsx); this only carries the marketing copy/stats.
window.COURSE_INSTRUCTOR = {
  // Instructor section.
  roleLine: "9+ years in AI/ML · Production agentic AI · 35K+ on YouTube",
  quote: "I show the agent working first, then explain the mental model — LLM, workflow, agent. Numbers and artefacts beat adjectives.",
  stats: [
    { num: "35K+", label: "Subscribers" },
    { num: "5,000+", label: "Mentored" },
    { num: "230K+", label: "Roadmap views" },
  ],
};
