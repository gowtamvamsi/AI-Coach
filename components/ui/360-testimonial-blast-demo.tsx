"use client";

import * as React from "react";
import { TestimonialBlast, TestimonialItem } from "./360-testimonial-blast";

const MOCK_TESTIMONIALS: TestimonialItem[] = [
  {
    text: "Balaji's masterclass completely changed how I approach AI systems. I went from writing scripts to shipping multi-agent pipelines in production within 6 weeks.",
    image: "https://randomuser.me/api/portraits/men/32.jpg",
    name: "Rahul Mehta",
    role: "Senior Engineer · Swiggy"
  },
  {
    text: "The Claude Code module alone was worth the entire fee. I've since automated 40% of my team's code review process.",
    image: "https://randomuser.me/api/portraits/women/68.jpg",
    name: "Sneha Iyer",
    role: "Engineering Lead · Razorpay"
  },
  {
    text: "I attended live and got my first agentic AI feature shipped to production 3 weeks later. The ROI was immediate and my manager noticed.",
    image: "https://randomuser.me/api/portraits/women/12.jpg",
    name: "Ananya Gupta",
    role: "Product Manager · CRED"
  },
  {
    text: "After this masterclass I landed a senior AI engineer role. The portfolio projects gave me something real and impressive to show interviewers.",
    image: "https://randomuser.me/api/portraits/women/33.jpg",
    name: "Divya Menon",
    role: "AI Engineer · Google"
  },
  {
    text: "The depth of the LLMOps and orchestration module is unmatched. We migrated our entire indexing pipeline to live multi-agent nodes.",
    image: "https://randomuser.me/api/portraits/men/45.jpg",
    name: "Kunal Sharma",
    role: "Software Engineer II · Microsoft"
  },
  {
    text: "The math and hands-on code examples for tool calling and semantic routing opened a whole new level of engineering capability for me.",
    image: "https://randomuser.me/api/portraits/women/44.jpg",
    name: "Priya Patel",
    role: "Senior ML Researcher · Meta"
  },
  {
    text: "This is the gold standard for AI engineering. It cuts through the hype and focuses on production-grade systems, latency, and costs.",
    image: "https://randomuser.me/api/portraits/men/72.jpg",
    name: "Vikram Malhotra",
    role: "Engineering Manager · Stripe"
  },
  {
    text: "We built an autonomous customer operations agent in 2 weeks using the principles taught here. Customer CSAT increased by 18%.",
    image: "https://randomuser.me/api/portraits/women/54.jpg",
    name: "Aditi Rao",
    role: "Tech Lead · Coinbase"
  },
  {
    text: "High-performance agentic flows are hard. This course gave me the debugging tools, logging strategies, and evaluations I needed.",
    image: "https://randomuser.me/api/portraits/men/22.jpg",
    name: "Siddharth Nair",
    role: "Systems Engineer · Netflix"
  },
  {
    text: "The interactive sessions are worth every rupee. Learning how to build customizable GUI frames for agent pipelines was a game changer.",
    image: "https://randomuser.me/api/portraits/men/81.jpg",
    name: "Rohan Das",
    role: "Senior Frontend Architect · Uber"
  },
  {
    text: "I spent months trying to piece together tutorials online. Balaji connects everything into a single, cohesive, enterprise-ready system.",
    image: "https://randomuser.me/api/portraits/women/29.jpg",
    name: "Tanvi Joshi",
    role: "Deep Learning Engineer · Nvidia"
  },
  {
    text: "From designing custom prompt layers to mastering memory systems, the course covers everything an ambitious designer-engineer needs.",
    image: "https://randomuser.me/api/portraits/women/62.jpg",
    name: "Neha Deshmukh",
    role: "Product Designer · Adobe"
  },
  {
    text: "If you are a senior engineer wanting to stay relevant in the age of AI, this cohort is non-negotiable. Best professional training I've had.",
    image: "https://randomuser.me/api/portraits/men/19.jpg",
    name: "Abhishek Roy",
    role: "Senior Fullstack Developer · Atlassian"
  },
  {
    text: "We saved over $12,000 in monthly API tokens by implementing the dynamic router caching patterns from Phase 6.",
    image: "https://randomuser.me/api/portraits/men/51.jpg",
    name: "Manish Verma",
    role: "Solutions Architect · Amazon"
  },
  {
    text: "The testing and evaluation framework has become our team's standard template. Essential knowledge for shipping AI with confidence.",
    image: "https://randomuser.me/api/portraits/men/58.jpg",
    name: "Harish Sen",
    role: "Backend Tech Lead · Zomato"
  }
];

export default function TestimonialsDemo() {
  return (
    <main className="w-full bg-background min-h-screen">
      {/* Intro section */}
      <section className="py-20 text-center max-w-2xl mx-auto px-4">
        <span className="text-xs font-semibold uppercase tracking-widest text-primary">
          Showcase
        </span>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mt-2 mb-4">
          Scroll-Driven Student Outcomes
        </h1>
        <p className="text-muted-foreground text-sm sm:text-base">
          Scroll down slowly to witness the 360° testimonial accumulation and violent blast sequence.
        </p>
      </section>

      {/* Cinematic Blast component */}
      <TestimonialBlast 
        testimonials={MOCK_TESTIMONIALS} 
        motivationalQuote="The future belongs to those who build it. Master Agentic AI and command the new frontier."
      />

      {/* Outro section */}
      <section className="py-20 text-center max-w-xl mx-auto px-4">
        <h3 className="text-xl font-bold mb-2">Build High-Performance AI Systems</h3>
        <p className="text-muted-foreground text-sm mb-6">
          Ready to join these elite engineers shipping production-grade autonomous agent clusters?
        </p>
        <button className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity">
          Book My Seat →
        </button>
      </section>
    </main>
  );
}
