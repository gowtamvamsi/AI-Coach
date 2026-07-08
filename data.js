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
      { n: "4.2", title: "Embeddings", items: ["What an embedding actually is (vector in N-dim space)", "Cosine similarity, dot product, Euclidean distance", "Embedding models — Titan Multimodal, SentenceTransformer, OpenAI ada/text-embedding-3, Cohere", "Choosing dimensions vs cost"] },
      { n: "4.3", title: "Document ingestion pipeline", items: ["Layout identification with Docling (headers, paragraphs, tables, code blocks, formulas)", "Serialization to structured objects", "Why PyMuPDF alone fails on complex PDFs"] },
      { n: "4.4", title: "Chunking strategies", items: ["Fixed-width chunking and why it breaks", "Semantic chunking by structure", "Overlap windows", "Parent-child chunking", "Late chunking — embed first, chunk later — preserves context across boundaries", "Chunk size vs retrieval quality tradeoff"] },
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
    n: "00",
    title: "Build a Full Working Agent",
    tagline: "Ship a working agent on day one — before the fundamentals grind.",
    project: "Atlas v0 — a working agent in 40 lines, no frameworks",
    tools: ["Python", "LLM APIs"],
    submodules: [
      { n: "0.1", title: "What You'll Build: Meet Atlas, the Course's Running Agent", lessons: ["Meet Atlas: The AI Assistant You'll Build, Deploy & Monitor"] },
      { n: "0.2", title: "Build Your First Working Agent in 40 Lines (No Frameworks)", lessons: ["Build a Working AI Agent in 40 Lines (No Frameworks, No Magic)"] }
    ]
  },
  {
    n: "01",
    title: "NLP Basics, Intuition-First",
    tagline: "Understand what text becomes before an LLM ever sees it.",
    project: "Semantic search over your own notes",
    tools: ["Tokens", "Embeddings", "Vector similarity", "Transformers"],
    submodules: [
      { n: "1.1", title: "How Machines Learned to Understand Language (Deep Learning, No Math)", lessons: ["Deep Learning Explained Without a Single Equation"] },
      { n: "1.2", title: "Tokens: How AI Actually Reads Text", lessons: ["Tokens: Why AI Doesn't See Words the Way You Do"] },
      { n: "1.3", title: "Embeddings: Turning Meaning Into Numbers", lessons: ["Embeddings: How a Computer Learns That “King” and “Queen” Are Close"] },
      { n: "1.4", title: "Vector Similarity: Measuring How Close Two Meanings Are", lessons: ["Cosine Similarity: How Machines Measure That Two Things Mean the Same"] },
      { n: "1.5", title: "Neural Networks: What They Are & How They Learn", lessons: ["What Is a Neural Network? The Building Block of Modern AI", "Backpropagation & Gradient Descent: How a Network Actually Learns"] },
      { n: "1.6", title: "Transformers & Attention: How a Model Decides What Matters", lessons: ["Attention, Explained for Humans: How a Model Decides What Matters", "Self-Attention: How a Sentence Understands Itself"] },
      { n: "1.7", title: "Positional Encoding, NER & the Classic NLP Tasks You Still Need", lessons: ["Word Order, Names & the Classic NLP Tasks You Still Need in 2026"] },
      { n: "1.8", title: "Your First Build: Semantic Search Over Your Own Notes", lessons: ["Build It: Semantic Search Over Your Own Notes"] }
    ]
  },
  {
    n: "02",
    title: "LLMs: Internals, Parameters, Benchmarking & Cost",
    tagline: "Pick and control the right model for a job — and predict its cost.",
    project: "A provider-agnostic LLM client (cloud + local via Ollama)",
    tools: ["OpenAI SDK", "LangChain", "Ollama"],
    submodules: [
      { n: "2.1", title: "What an LLM Is: Training, Next-Token Prediction, Context & Limits", lessons: ["What Is an LLM, Really? A Short History & How They're Trained", "Next-Token Prediction, Explained From Scratch", "How to Communicate With LLMs Using an API Key", "What Is a Context Window? Why a Model Can Only “See” So Much at Once", "The Brain in a Windowless Room: Cutoffs, Hallucination & What LLMs Can't Know"] },
      { n: "2.2", title: "Controlling Model Output: Decoding Dials & Reasoning vs Base Models", lessons: ["Temperature, Top-p, Max Tokens, Stop Sequences & Frequency/Presence Penalties: The Dials That Change Everything", "Reasoning vs Base Models: When “Thinking” Models Actually Win"] },
      { n: "2.3", title: "Benchmarking LLMs: What the Numbers Really Mean", lessons: ["MMLU, Benchmarks & Lies: How to Actually Judge an LLM"] },
      { n: "2.4", title: "Choosing & Pricing an LLM (Incl. Open-Source Models)", lessons: ["Picking the Right LLM: Quality vs Speed vs Cost (The Real Tradeoff)", "Open-Source & Open-Weight Models: The Landscape & Running Them Locally"] },
      { n: "2.5", title: "Frameworks & a Provider-Agnostic Model Wrapper (LangChain + OpenAI SDK)", lessons: ["LangChain & OpenAI Frameworks: Do You Even Need One?", "LangChain Basics: Chains, Prompts & Models", "Build It: A Provider-Agnostic LLM Client (Cloud + Local via Ollama)", "Curated Resources to Keep Learning (Docs, Courses & Repositories)"] },
      { n: "2.6", title: "Responsible AI: Bias, Safety & India-Specific Models", lessons: ["Bias, Safety & What “Responsible AI” Means in Practice — incl. Sarvam AI for India-Specific Use-Cases"] }
    ]
  },
  {
    n: "03",
    title: "Prompt Engineering",
    tagline: "Reliably get the behavior you want — the skill every agent call depends on.",
    project: "A prompt toolkit you'll reuse in every agent call",
    tools: ["Chain-of-Thought", "Structured output", "Pydantic"],
    submodules: [
      { n: "3.1", title: "Core Prompting Techniques: From Prompt Anatomy to Meta-Prompting", lessons: ["Anatomy of a Prompt: Instruction, Context, Input & Format", "Interview-Style Prompting: Drawing the Best Answer Out of a Model", "Chain-of-Thought: Making a Model Show Its Work", "Structured Output: Forcing Clean JSON With Pydantic Schemas", "Asking an LLM to Write & Improve Its Own Prompts (Meta-Prompting)", "A Look Ahead: Context & Loop Engineering (Coming Later in the Course)"] }
    ]
  },
  {
    n: "04",
    title: "Foundations of Agentic Systems",
    tagline: "Understand the agent loop deeply — because you built it by hand.",
    project: "Atlas gets a ReAct brain, live tools, and self-correction",
    tools: ["ReAct", "Tool calling", "Plan-and-Solve"],
    submodules: [
      { n: "4.1", title: "What Is an Agent? Autonomy Levels, the Agent Loop & ReAct", lessons: ["From Rule-Based to Fully Autonomous: The 5 Levels of Agent Autonomy", "LLMs vs Agents vs Workflows: The Difference Nobody Explains Clearly", "The Agent Loop: Reason → Act → Observe → Repeat (ReAct)", "Build It: Give Atlas a ReAct Brain"] },
      { n: "4.2", title: "Giving an Agent Tools: Function Calling & Tool Use", lessons: ["Give Your LLM Hands: Tool Calling From Scratch (Include more examples)", "Build It: Atlas Gets Its First Tools (Live Search + Calculator)", "More Examples of Tool Use"] },
      { n: "4.3", title: "Real APIs, Tool Sandboxing & Self-Correction", lessons: ["Using an Actual API as a Tool", "Tool Sandboxing: Letting an AI Run Code Without Burning Your House Down", "When Tools Fail: Retries, Backoff & the Self-Correction Loop", "Hard-Stops & Max Steps: Stopping Runaway Self-Correction"] },
      { n: "4.4", title: "Why Tools Fall Short: An Intro to MCP", lessons: ["The Drawbacks of Tools & Why We Need MCP — The USB-C Port for AI Agents", "The Zomato Example: Plugging a Real API Into an Agent via MCP"] },
      { n: "4.5", title: "Cognitive Framework: Plan-and-Solve", lessons: ["Plan-and-Solve: Breaking a Hard Goal Into Steps an Agent Can Do", "Build It: Atlas Plans a Multi-Step Research Task"] },
      { n: "4.6", title: "Cognitive Framework: Self-Reflection Loop", lessons: ["Self-Reflection: How an Agent Catches Its Own Mistakes", "Build It: Atlas Critiques and Fixes Its Own Output"] }
    ]
  },
  {
    n: "05",
    title: "RAG — Retrieval-Augmented Generation",
    tagline: "Answer from your own documents — grounded and cited, not from memory.",
    project: "Document intelligence for Atlas — grounded, cited answers",
    tools: ["Vector DBs", "Chunking", "Reranking", "Graph RAG"],
    submodules: [
      { n: "5.1", title: "Naive RAG", lessons: ["RAG Architecture: The Anatomy of a Pipeline", "Chunking Strategies", "Vector Databases", "Retrieval"] },
      { n: "5.2", title: "Advanced RAG", lessons: ["Advanced RAG Architecture", "Search Algorithms: HNSW & IVF", "Retrieval Reranking", "LLM as a Judge", "HyDE: Hypothetical Document Embeddings", "FLARE: Forward-Looking Active Retrieval"] },
      { n: "5.3", title: "Graph RAG", lessons: ["Graph RAG: Reasoning Over Connected Knowledge", "Vectorless RAG"] },
      { n: "5.4", title: "Agentic RAG", lessons: ["Agentic RAG: Letting the Agent Decide When & What to Retrieve", "RAG as a Tool"] },
      { n: "5.5", title: "Multimodal RAG", lessons: ["Multimodal RAG: Retrieving Across Text, Images & More"] },
      { n: "5.6", title: "Evaluation", lessons: ["Is Your RAG Actually Good? Faithfulness & Relevance Metrics"] }
    ]
  },
  {
    n: "06",
    title: "MCP — Model Context Protocol",
    tagline: "Connect your agent to anything through one universal standard.",
    project: "An MCP server from scratch + a Gmail & Calendar MCP for Atlas",
    tools: ["MCP", "Gmail API", "Calendar API"],
    submodules: [
      { n: "6.1", title: "What Exactly Is an MCP — and Why We Need Them", lessons: ["The M×N Problem: Why MCP Exists", "Tools vs MCP vs Prompts: What Goes Where", "Host, Client & Server: The MCP Architecture"] },
      { n: "6.2", title: "Build Your Own MCP Server From Scratch", lessons: ["Build It: An MCP Server From Scratch (Host, Client & Server)"] },
      { n: "6.3", title: "Build an MCP for Google (Gmail & Calendar)", lessons: ["Build It: A Gmail & Calendar MCP for Atlas"] },
      { n: "6.4", title: "Plugging In Third-Party MCP Servers", lessons: ["How to Plug In & Use Third-Party MCP Servers"] },
      { n: "6.5", title: "Where MCP Falls Short: Context Bloat & Limitations", lessons: ["Too Many MCPs: How Context Bloat Confuses Your Agent", "MCP Limitations: Where the Protocol Falls Short"] },
      { n: "6.6", title: "Securing an MCP Server: Auth, Config & Secrets", lessons: ["Securing MCP: Auth, JSON Config & Environment Variables"] }
    ]
  },
  {
    n: "07",
    title: "Memory & Optimization",
    tagline: "Remember across sessions without blowing the context window.",
    project: "Atlas remembers your preferences across sessions — on a token budget",
    tools: ["Vector memory", "Context engineering", "Token budgeting"],
    submodules: [
      { n: "7.1", title: "Short-Term Memory & the Context Window", lessons: ["The Context Window: Why Your Agent Forgets Mid-Conversation", "Build It: Conversation Memory for Atlas"] },
      { n: "7.2", title: "Long-Term Memory (Vector DBs, Profiling)", lessons: ["Long-Term Memory: How Production Agents Remember You", "Build It: Atlas Remembers Your Preferences Across Sessions"] },
      { n: "7.3", title: "Episodic vs Semantic Memory", lessons: ["Episodic vs Semantic Memory: Specific Logs vs Learned Facts", "Build It: Atlas Recalls Past Research and Generalizes From It"] },
      { n: "7.4", title: "Context Optimization & Token Budgeting", lessons: ["Lost in the Middle: Why Long Context Degrades & How to Fight It", "Build It: Trim, Summarize & Budget Atlas's Context for Cost"] },
      { n: "7.5", title: "Context Engineering & Loop Engineering", lessons: ["Context Engineering: Designing Exactly What the Agent Sees", "Loop Engineering: Controlling How an Agent Iterates", "Build It: Apply Context & Loop Engineering to Atlas"] }
    ]
  },
  {
    n: "08",
    title: "State Machines & DAGs (LangGraph)",
    tagline: "Control an agent's flow deterministically — and pause for a human.",
    project: "Atlas re-architected on LangGraph with approval checkpoints",
    tools: ["LangGraph", "State machines", "Human-in-the-loop"],
    submodules: [
      { n: "8.1", title: "From Loops to State: Why Agents Need a Single Source of Truth", lessons: ["Why Loops Aren't Enough: State as the Single Source of Truth — and the Drawbacks of Context & Loop Engineering"] },
      { n: "8.2", title: "Modeling Agents as Graphs: Nodes, Edges & State in LangGraph", lessons: ["Agents as Graphs: The Mental Model Behind LangGraph", "Build It: Re-Architect Atlas on LangGraph"] },
      { n: "8.3", title: "Deterministic Routing: Letting Code Decide the Path", lessons: ["Conditional Routing: Letting Code Decide When the AI Shouldn't", "Build It: Add Smart Routing to Atlas"] },
      { n: "8.4", title: "Human-in-the-Loop: Pausing for Approval Before Risky Actions", lessons: ["Human-in-the-Loop: Pausing an Agent for Approval Before It Acts", "Build It: An Approval Checkpoint Before Atlas Takes Risky Actions"] }
    ]
  },
  {
    n: "09",
    title: "Evaluation",
    tagline: "Prove your agent works and catch regressions before users do.",
    project: "A regression suite that blocks bad Atlas changes",
    tools: ["LLM-as-Judge", "Eval datasets", "Trajectory benchmarks"],
    submodules: [
      { n: "9.1", title: "Why Agents Are Hard to Evaluate", lessons: ["Non-Deterministic Nightmares: Why You Can't Unit-Test an Agent"] },
      { n: "9.2", title: "Success-Rate Evaluation: Scoring Non-Deterministic Agents", lessons: ["Success Rate: Scoring an Agent That Answers Differently Every Time", "Build It: A Success-Rate Eval Harness for Atlas"] },
      { n: "9.3", title: "Trajectory Benchmarking: Did the Agent Take the Efficient Path?", lessons: ["Trajectory Benchmarking: Did the Agent Take the Efficient Path?", "Build It: Measure How Atlas Gets to the Answer, Not Just the Answer"] },
      { n: "9.4", title: "LLM-as-Judge, Eval Datasets & Regression Suites", lessons: ["LLM-as-Judge & Eval Datasets: Building a Test Set for Agents", "Build It: A Regression Suite That Blocks Bad Atlas Changes"] }
    ]
  },
  {
    n: "10",
    title: "Multi-Agent Orchestration",
    tagline: "Make specialized agents collaborate without burning $400 in a loop.",
    project: "Atlas becomes a researcher + writer + critic team",
    tools: ["LangGraph", "OpenAI Agents SDK", "CrewAI"],
    submodules: [
      { n: "10.1", title: "Specialized Agents: When a Team Beats One Generalist", lessons: ["One Genius vs a Team: When Multiple Agents Beat One"] },
      { n: "10.2", title: "Orchestration Patterns: Hierarchical vs Peer-to-Peer Teams", lessons: ["Hierarchical vs Peer-to-Peer: How Agent Teams Are Organized", "Build It: Turn Atlas Into a Researcher + Writer + Critic Team"] },
      { n: "10.3", title: "How Agents Communicate: Message Passing vs Shared Memory (A2A / M2M)", lessons: ["How Agents Talk: Message Passing vs Shared Memory (A2A / M2M)", "Build It: Wire Up Communication Between Atlas's Agents"] },
      { n: "10.4", title: "Choosing a Multi-Agent Framework: LangGraph vs OpenAI SDK vs CrewAI", lessons: ["LangGraph vs OpenAI Agents SDK vs CrewAI: When to Use Which", "Build It: The Same Atlas Team, Rebuilt in the OpenAI Agents SDK"] }
    ]
  },
  {
    n: "11",
    title: "Security & Guardrails",
    tagline: "Survive malicious users and handle sensitive data safely.",
    project: "Atlas locked down — guardrails, least privilege, PII redaction",
    tools: ["Guardrails", "Prompt-injection defense", "Sandboxing"],
    submodules: [
      { n: "11.1", title: "Input & Output Guardrails: The First Line of Defense", lessons: ["Input & Output Guardrails: The First Line of Defense", "Build It: Input & Output Guardrails for Atlas"] },
      { n: "11.2", title: "Tool Guardrails: Constraining What an Agent Can Do", lessons: ["Tool Guardrails: Constraining What an Agent Is Allowed to Do", "Build It: Guardrails Around Atlas's Tools"] },
      { n: "11.3", title: "Human-in-the-Loop Guardrails: Approval Gates for Risky Actions", lessons: ["Human-in-the-Loop Guardrails: Approval Gates for Risky Actions", "Build It: A Human Approval Guardrail for Atlas"] },
      { n: "11.4", title: "Prompt Injection: How to Break Agents", lessons: ["Prompt Injection: How One Sentence Hijacks Your Agent", "Breaking Agents: Jailbreaks, Adversarial Inputs & Red-Teaming"] },
      { n: "11.5", title: "Sandboxing & Least Privilege: Don't Hand Over the Master Key", lessons: ["Least Privilege for Agents: Don't Give the AI the Master Key", "Build It: Lock Down Atlas's Tools and Permissions"] },
      { n: "11.6", title: "Secrets, PII & Data Handling: What an Agent Must Never Leak", lessons: ["Secrets, PII & Compliance: What an Agent Must Never Leak", "Build It: Safe Secrets & PII Redaction in Atlas"] }
    ]
  },
  {
    n: "12",
    title: "Deployment (incl. FastAPI)",
    tagline: "Real users can use your agent over the internet.",
    project: "Atlas live on the internet with a chat UI",
    tools: ["FastAPI", "Docker", "Async", "CI/CD"],
    submodules: [
      { n: "12.1", title: "Serving an Agent as an API With FastAPI", lessons: ["From Notebook to API: Serving an Agent With FastAPI", "Build It: Wrap Atlas in a FastAPI Service"] },
      { n: "12.2", title: "Containerizing Your Agent With Docker", lessons: ["Docker for AI Apps: “It Works on My Machine” Is Not a Deploy", "Build It: Dockerize Atlas"] },
      { n: "12.3", title: "Async for Agents: Don't Let One Call Freeze Everything", lessons: ["Why Agents Need Async: One Hanging LLM Call Shouldn't Freeze Everything", "Build It: Make Atlas's API Async & Streaming"] },
      { n: "12.4", title: "Shipping to the Cloud With CI/CD", lessons: ["From Localhost to the Internet: Deploying Agents to the Cloud", "Build It: Deploy Atlas to the Cloud With CI/CD"] },
      { n: "12.5", title: "Reliability: Retries, Timeouts, Queues & Scaling", lessons: ["Reliability for Agents: Timeouts, Queues & Surviving Traffic", "Build It: A Chat UI + Reliability Layer for Atlas"] }
    ]
  },
  {
    n: "13",
    title: "Monitoring & Operations",
    tagline: "See what your live agent is doing, what it costs, and how to improve it.",
    project: "A cost & quality dashboard for live Atlas",
    tools: ["Langfuse", "LangSmith", "Tracing"],
    submodules: [
      { n: "13.1", title: "Tracing Every Step of a Live Agent", lessons: ["You Can't Fix What You Can't See: Tracing Every Agent Step", "Build It: Full-Trace Logging for Live Atlas"] },
      { n: "13.2", title: "Observability Tooling: Langfuse & LangSmith", lessons: ["Observability for Agents: Traces, Dashboards & Alerts", "Langfuse vs LangSmith: Choosing Your Observability Stack", "Build It: Instrument Atlas With Langfuse & LangSmith"] },
      { n: "13.3", title: "Token & Cost Optimization in Production", lessons: ["The 3 AM Bill: Cutting Agent Token Costs in Production", "Build It: A Cost & Quality Dashboard for Atlas"] },
      { n: "13.4", title: "Feedback Loops & Continuous Improvement", lessons: ["Closing the Loop: Turning Live Feedback Into a Better Agent", "Build It: A Feedback → Eval → Improve Loop for Atlas"] }
    ]
  },
  {
    n: "14",
    title: "Capstone Projects & Portfolio",
    tagline: "Ship and monitor your OWN agentic product — portfolio-ready.",
    project: "Your own agentic product — built, deployed, monitored",
    tools: ["Full production stack", "Portfolio", "Interview prep"],
    submodules: [
      { n: "14.1", title: "Choosing & Scoping Your Capstone", lessons: ["How to Scope an Agentic Project That Actually Ships"] },
      { n: "14.2", title: "Capstone A — Customer-Support Agent", lessons: ["Build, Deploy & Monitor a Support Agent End-to-End"] },
      { n: "14.3", title: "Capstone B — Coding / Dev Agent", lessons: ["Build, Deploy & Monitor a Coding Agent End-to-End"] },
      { n: "14.4", title: "Capstone C — Personal-Finance Agent", lessons: ["Build, Deploy & Monitor a Finance Agent End-to-End"] },
      { n: "14.5", title: "Portfolio, Resume & Interview Prep", lessons: ["From Project to Job: Portfolio, Resume & Agent-Engineer Interview Prep"] },
      { n: "14.6", title: "Bonus Capstone — Voice-to-Voice Agent", lessons: ["A Voice-to-Voice Atlas (STT → Agent → TTS)"] }
    ]
  }
];

window.COURSE_INFO = {
  title: "Generative & Agentic AI Engineering",
  moduleCount: 15,
  submoduleCount: 73,
  lessonCount: 144,
  badge: "Build-First Agentic AI Program",
  headline: "Become a Production-Ready Agentic AI Engineer",
  subheadline: "Build Atlas — a real AI assistant — from a 40-line agent to a deployed, monitored, multi-agent system.",
  proofChips: ["15 modules", "144 lessons", "4 capstones", "Mock interviews", "1-on-1 guidance", "Doubts cleared in 24h"],
  price: 29999,
  priceWas: 35000,
  priceNote: "Includes live support, assignments, capstones, resume review, and interview prep.",
  enrollUrl: "https://balajichippadacourse.edmingle.com/course/GenerativeAgenticAIEngineering-111299",
  pricingIncludes: [
    "Full course access — 15 modules, 144 lessons",
    "Assignments after every module",
    "4 capstone projects, deployed and monitored",
    "Mock interviews with structured feedback",
    "Resume review for AI engineering roles",
    "1-on-1 guidance sessions",
    "Doubts cleared within 24 hours",
    "Private community access"
  ]
};

// Curriculum phases for the Courses tab — module `n` values grouped into a
// guided roadmap. Colors come from the PHASE_COLORS palette (styles.css vars).
window.COURSE_PHASES = [
  { title: "Foundations", blurb: "Ship an agent on day one, then build the intuition — NLP, LLMs, and prompting.", modules: ["00", "01", "02", "03"], color: "teal-deep" },
  { title: "Agentic Systems", blurb: "The agent loop, tools, RAG, MCP, memory, and LangGraph — the core of the craft.", modules: ["04", "05", "06", "07", "08"], color: "purple" },
  { title: "Production Engineering", blurb: "Evaluation, multi-agent teams, security, deployment, and monitoring — real users, real traffic.", modules: ["09", "10", "11", "12", "13"], color: "rust" },
  { title: "Capstone & Portfolio", blurb: "Ship your own agentic product end-to-end and get interview-ready.", modules: ["14"], color: "emerald" }
];

// "Projects you will build" cards for the Courses tab.
window.COURSE_PROJECTS = [
  { title: "40-Line AI Agent", module: "00", desc: "A working agent with no frameworks and no magic — so you understand every line.", skills: ["Agent loop", "LLM APIs"] },
  { title: "Tool-Using Assistant", module: "04", desc: "Atlas gets a ReAct brain, live search, real APIs, and a self-correction loop.", skills: ["ReAct", "Tool calling"] },
  { title: "RAG Knowledge Agent", module: "05", desc: "Grounded, cited answers from your own documents — naive to agentic RAG.", skills: ["Vector DBs", "Reranking"] },
  { title: "Memory-Enabled Assistant", module: "07", desc: "Atlas remembers you across sessions without blowing the context window.", skills: ["Long-term memory", "Context engineering"] },
  { title: "LangGraph Workflow Agent", module: "08", desc: "Deterministic routing and human approval gates before risky actions.", skills: ["LangGraph", "Human-in-the-loop"] },
  { title: "Multi-Agent Research System", module: "10", desc: "A researcher + writer + critic team that collaborates without runaway cost.", skills: ["Orchestration", "A2A communication"] },
  { title: "Secure Production Agent", module: "11", desc: "Guardrails, prompt-injection defense, least privilege, and PII redaction.", skills: ["Guardrails", "Red-teaming"] },
  { title: "Deployed Capstone Product", module: "14", desc: "Your own agentic product — support, coding, finance, or voice — live and monitored.", skills: ["FastAPI + Docker", "Observability"] }
];

// "Tools you will use" chips for the Courses tab.
window.COURSE_TOOLS = [
  "Python", "OpenAI & Claude APIs", "LangChain", "LangGraph", "MCP", "RAG",
  "Vector databases", "Pydantic", "FastAPI", "Docker", "CI/CD", "Ollama",
  "CrewAI", "OpenAI Agents SDK", "Langfuse", "LangSmith", "Guardrails", "Cloud deployment"
];

// Courses tab FAQ. Refund / certificate / EMI entries intentionally absent
// until those policies are confirmed — add them here when they are.
window.COURSE_FAQ = [
  { q: "Is this course beginner-friendly?", a: "Yes — if you can write basic Python and use a terminal, you're ready. Module 0 has you shipping a working agent on day one, and Module 1 builds the NLP/LLM intuition from scratch, without heavy math." },
  { q: "Do I need prior AI/ML experience?", a: "No. The course starts with intuition-first foundations — tokens, embeddings, transformers — explained without equations, then moves to hands-on agent engineering." },
  { q: "Will I build real projects?", a: "The whole course is one continuous build. You evolve Atlas, a real AI assistant, through every module, and finish with capstone products — customer support, coding, finance, or voice agents — deployed and monitored." },
  { q: "What if I get stuck?", a: "Every doubt is answered within 24 hours, and you get 1-on-1 sessions whenever you need personal guidance or a plan for your next step." },
  { q: "Will this help me get a job?", a: "That's the goal of the final phase: portfolio-ready deployed projects, resume review, and mock interviews that simulate real agent-engineer rounds." },
  { q: "Is this theory or hands-on?", a: "Build-first, always. You build each system from scratch to understand it, then level up to the industry tools — LangChain, LangGraph, FastAPI, Docker, Langfuse, LangSmith." }
];
