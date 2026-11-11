from __future__ import annotations

import json
import re
from typing import Any, Dict, List

from app.ai.provider import AIProvider
from app.config import settings


class ResumeOptimizerService:
    def __init__(self, provider: AIProvider | None = None):
        self.provider = provider or AIProvider()

    @staticmethod
    def _tokenize(text: str) -> List[str]:
        tokens = re.findall(r"[a-z0-9+#]+(?:\.[a-z0-9+#]+)?", (text or "").lower())
        stop_words = {
            "with", "from", "that", "this", "have", "will", "your", "into", "over",
            "they", "them", "their", "about", "should", "could", "would", "been",
            "also", "using", "used", "made", "role", "team", "work", "job", "resume"
        }
        return [token for token in tokens if token not in stop_words]

    async def generate_suggestions(self, resume_text: str, job_description: str) -> List[Dict[str, Any]]:
        if not resume_text.strip() or not job_description.strip():
            return []

        if not settings.openai_api_key:
            return self._fallback_suggestions(resume_text, job_description)

        system_prompt = (
            "You are an ATS resume optimization assistant. Return valid JSON only with an array "
            "of suggestion objects. Each object must contain: 'section', 'original', 'suggested', 'reason'. "
            "Keep suggestions concise, ATS-friendly, and tailored to the job description."
        )
        user_prompt = (
            "Job description:\n" + job_description[:20000] + "\n\nResume text:\n" + resume_text[:20000]
        )

        try:
            completion = await self.provider.chat_completion(system_prompt, user_prompt, temperature=0.3)
            payload = json.loads(completion)
            if isinstance(payload, dict):
                payload = payload.get("suggestions", [])
            suggestions = []
            for item in payload[:5]:
                if not isinstance(item, dict):
                    continue
                suggestions.append({
                    "section": item.get("section", "Summary"),
                    "original": item.get("original", ""),
                    "suggested": item.get("suggested", ""),
                    "reason": item.get("reason", "Matches the role requirement."),
                })
            return suggestions or self._fallback_suggestions(resume_text, job_description)
        except Exception:
            return self._fallback_suggestions(resume_text, job_description)

    def _fallback_suggestions(self, resume_text: str, job_description: str) -> List[Dict[str, Any]]:
        resume_tokens = set(self._tokenize(resume_text))
        job_tokens = self._tokenize(job_description)
        job_counter = {}
        for token in job_tokens:
            job_counter[token] = job_counter.get(token, 0) + 1

        missing = [
            token for token in sorted(job_counter, key=lambda x: (-job_counter[x], x))
            if token not in resume_tokens and len(token) > 3
        ]

        suggestions: List[Dict[str, Any]] = []
        for keyword in missing[:5]:
            suggestions.append({
                "section": "Skills",
                "original": "Skill set not emphasized",
                "suggested": f"Add {keyword.upper()} to your skills, projects, and experience bullets.",
                "reason": f"The target role mentions {keyword} as a key requirement.",
            })

        if not suggestions:
            suggestions.append({
                "section": "Summary",
                "original": "Current professional summary",
                "suggested": "Results-driven professional with strong problem-solving, analytical thinking, and measurable delivery aligned to the target role.",
                "reason": "A concise ATS-friendly summary improves keyword coverage and recruiter readability.",
            })

        if resume_text.lower().count("experience") < 1 and "experience" in job_description.lower():
            suggestions.append({
                "section": "Experience",
                "original": "Experience section is not clearly emphasized",
                "suggested": "Add quantified achievements for scope, ownership, and business impact in each role.",
                "reason": "ATS systems and recruiters prefer measurable outcomes tied to the job requirements.",
            })

        return suggestions[:5]
