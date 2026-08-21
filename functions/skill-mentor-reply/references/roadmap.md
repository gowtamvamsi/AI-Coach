# Reference: The Agentic AI Engineer Roadmap (2026)

Source: `balajichippada.com/roadmap`. Also open-source at `ch-balaji.github.io/ai-engineer-roadmap/`, with a full walkthrough video on YouTube (`@balajichippada`).

Use this to make roadmap CTAs **specific**. Never just say "follow my roadmap" — name the phase the student should start at, and say why.

**Read this alongside `course.md`, and keep the two straight.** The roadmap is the *map*: the phases, modules, topics, and the order to learn them in, plus prerequisites and some standalone explainers on YouTube. The paid course is where those topics are actually taught in depth, with assignments, capstones, a continuous agent build, industrial context, and mentorship. The roadmap is genuinely free and genuinely useful — but it is not a free version of the course, and no reply should imply that it is.

## The headline numbers

**26 weeks · 9 phases · 60 modules · 3 capstones.** Free, no paywall.

Positioning: "script kid to agent engineer." Every module grounded in real enterprise AI engineering, not demo work.

## The 9 phases

| # | Phase | Weeks | What it's for |
|---|-------|-------|---------------|
| 1 | Python + Async Engineering | 1–3 | Core + OOP Python, HTTP APIs, async, FastAPI, DB connectivity. "Every agent framework runs on Python. Skip this and everything later breaks in mysterious ways." |
| 2 | The Mental Model of an LLM | 4 | Conceptual, almost no code. What an LLM actually is, reasoning vs base models, reading evals, choosing a model for a task. |
| 3 | Prompt Engineering & API Access | 5–7 | The pivot from "ChatGPT user" to "engineer who controls LLMs." UI vs API, prompt + context engineering, structured output, prompt cost in production. |
| 4 | RAG + Evaluation | 8–12 | The longest phase. Embeddings, ingestion, chunking + enrichment, vector DBs, hybrid retrieval, graph RAG, and **RAG evaluation — the part most courses skip**. |
| 5 | Tools, MCP & Single Agents | 13–16 | "The brain gets hands and legs." Function calling, tool design, MCP, ReAct, human-in-the-loop, tool security, computer use. |
| 6 | Memory & Context Engineering | 17–19 | The hardest conceptual phase and the highest-leverage skill in the curriculum. Context window as working memory, short-term/episodic/long-term memory, semantic caching, compression. |
| 7 | Multi-Agent Orchestration | 20–22 | LangGraph, patterns, agent-as-tool, state, A2A, debugging. |
| 8 | Guardrails & LLMOps | 23–24 | Three-layer guardrails, Bedrock Guardrails, observability, production evaluation. |
| 9 | Cloud Infrastructure & Deployment | 25–26 | Minimum AWS to ship: S3, RDS Postgres, DynamoDB, compute, networking, deployment, cost control. |

## The 3 capstones (the portfolio)

These are the proof, and the answer to "what project should I build?"

1. **Distributed Document Ingestion + RAG Pipeline** (Phase 4, weeks 10–12). Docling → semantic chunking → PII redaction → embeddings → Pinecone + Neo4j; async workers on ECS Fargate; hybrid retrieval with reranking; eval harness with a golden dataset. *Proves you can build production RAG, not a Streamlit demo.*
2. **Multi-Agent Natural Language → SQL on E-commerce Data** (Phase 7, weeks 21–22). Planner → SQL Writer → Validator → Executor → Explainer, LangGraph routing, read-only DB enforcement, benchmarked on a golden NLQ set at 85%+ accuracy. *Proves you can orchestrate specialised agents safely against real data.*
3. **Clinical Trials Knowledge Base** (Phases 8–9, weeks 23–26). Pinecone + Neo4j hybrid knowledge layer, multi-hop queries, full three-layer guardrails, evidence-backed answers, deployed on AWS with monitoring and a cost dashboard. *Proves you can ship into a regulated domain.* (Substitute legal/finance/their industry.)

## Deliberately out of scope — and the reasons

Students constantly ask about these. The roadmap's answer is "not on the critical path," not "unimportant." Reuse these reasons verbatim in spirit:

- **Fine-tuning.** RAG, prompting, and tool use solve ~95% of business problems faster and cheaper. Fine-tuning earns its weight only with a narrow domain, clean labelled data, and prompting already hitting a wall. Learn it *after*, not during. (LoRA + a 7B open model when a real use case shows up.)
- **Voice agents.** A whole sub-discipline (STT, TTS, turn-taking, latency, barge-in). Graft it on after you've shipped one text agent.
- **ML fundamentals** (backprop, transformers from scratch). Lovely to know, not required to be an excellent agent engineer in 2026. Karpathy on weekends — don't let it block shipping.
- **Frontend frameworks.** Enough Streamlit or a basic chat UI is enough. Don't get lost in framework wars.

## Strong technical positions worth reusing in replies

- **Single-agent-with-tools beats multi-agent for ~80% of tasks.** Multi-agent earns its weight only when steps need different prompts, tools, or specialised reasoning.
- **Production runs on the API, not the chat UI.** Hidden system prompts and silent tools are why UI output differs from API output.
- **Evaluation is the differentiator.** "Measure why it's wrong and fix it with data instead of vibes." Most courses skip RAG eval; this is the hiring signal.
- **Memory/context engineering is the highest-leverage skill** in the whole curriculum, and the easiest to do badly.
- **Guardrails are three layers:** input (deterministic, code-based, never an LLM), output (LLM-judge acceptable), action (inside tools, pure functions — retry caps, read-only DB, top_k caps).
- **Python is non-negotiable.** Weak Python means everything later breaks mysteriously.

## After the roadmap — career advice already on the page

Reuse this when a student asks "how do I actually get hired?"

- **Portfolio:** the three capstones. Each gets a clean repo, a README covering problem / architecture / trade-offs / eval numbers, a 90-second Loom, and one screenshot of the trace UI proving it ran.
- **LinkedIn headline:** not "AI Engineer" — something like "AI Engineer · production RAG, multi-agent systems, AWS Bedrock + LangGraph · shipping in regulated domains." Specific gets interviews; generic gets ignored.
- **The 60-second interview pitch:** name the three systems, then offer the traces, the eval numbers, and the cost dashboard. Numbers and artefacts beat adjectives.
- **Keep learning:** Anthropic's "Building effective agents," Latent Space, the LangChain blog, Eugene Yan, and the original papers (Self-RAG, ReAct) when something keeps confusing you. Skim, don't drown.

## Other channels to mention when it fits

- YouTube: `@balajichippada` (35K+ subs; the roadmap walkthrough has 230K+ views)
- WhatsApp community: `chat.whatsapp.com/GASHZYf7wBA23nQvb39lIP`
- LinkedIn: `linkedin.com/in/balaji-chippada-0317/`

## How to cite the roadmap in a reply

Match the phase to the student's actual question. Examples:

- *"Should I learn SQL?"* → Phase 1 (module 1.7, database connectivity) and Capstone 2 is literally a multi-agent NL→SQL system. SQL isn't optional.
- *"What skills do I need?"* → the 9 phases, in order, top to bottom.
- *"Should I learn fine-tuning / build my own LLM?"* → the out-of-scope section, with the reason.
- *"What project should I build?"* → one of the three capstones, not another to-do app.
- *"I keep jumping between topics."* → the roadmap gives you a fixed next thing every single day; that's the whole point.
