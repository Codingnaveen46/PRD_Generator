import json
from huggingface_hub import AsyncInferenceClient
from app.core.config import settings
from app.models.schemas import AnalysisResultSchema


client = AsyncInferenceClient(token=settings.huggingface_api_key)

MASTER_PRD_ANALYSIS_PROMPT = """
You are an expert Senior Product Manager and Software Architect.
Analyze the following raw PRD or BRD text and extract a structured standardized Product Requirements Document.

PRD Writing Guidelines to STRICTLY FOLLOW:
1. Use plain text only. Do NOT use emojis. Do NOT use tables (they may cause misinterpretation of content).
2. Structure the document into these exact clear sections:
   - Overview
   - Objectives
   - Functional Requirements
   - Inclusions
   - Exclusions
3. Use bullet points where needed: List conditions, fields, or options clearly. Use them especially in Functional Requirements, Inclusions, and Exclusions.
4. Use paragraphs where appropriate: Explain user flows or background context in short, focused paragraphs, especially in Overview and Functional sections.
5. Be specific and detailed: Mention field names, buttons, expected behavior, and form flow clearly. Avoid assumptions.
6. Describe one flow at a time: Explain each form section or system flow separately to keep logic clean and understandable.
7. What to Avoid: NO emojis, NO tables, NO mixing multiple flows into one block, NO generic statements without details.

You MUST return ONLY a valid JSON object with the following schema and NO markdown formatting (no ```json):
{
  "standardized_prd": "(string) A comprehensive, beautifully formatted Markdown representation of the PRD following the EXACT structure and guidelines above. \n- Use double line breaks between ALL sections and paragraphs.\n- Use '##' for the 5 main mandated section headings.\n- Use '###' for any sub-headings or specific flows within those sections.\n- EVERY single detail or requirement MUST be a new bullet point starting with a '*' on a NEW LINE.\n- NEVER group bullet points into a single paragraph. NEVER use inline bullets (like '•').\n- DO NOT include tables. DO NOT include emojis.",
  "quality_score": "(integer, 0-100) A score representing how complete, clear, and actionable the original document is.",
  "missing_requirements": ["(string) Identify key areas, edge cases, or functional requirements that the original document omitted.", "..."],
  "qa_risk_insights": ["(string) Identify potential technical risks, QA testing challenges, security vulnerabilities.", "..."]
}

Here is the raw text to analyze:
{text}
"""


REFINE_PRD_PROMPT = """
You are an expert Senior Product Manager and Software Architect.
Current PRD Content:
{current_prd}

User Instruction for Refinement:
{instruction}

Task: Update the PRD content based on the user instruction.
Rules:
1. Maintain the EXACT 5-section structure (Overview, Objectives, Functional Requirements, Inclusions, Exclusions).
2. Continue to follow all previous formatting guidelines: plain text only, NO emojis, NO tables, line-by-line bullet points.
3. Update specific sections as requested while keeping the rest of the PRD consistent.

You MUST return ONLY a valid JSON object with the following schema:
{
  "standardized_prd": "(string) The updated PRD Markdown content.",
  "quality_score": "(integer, 0-100) Updated quality score.",
  "missing_requirements": ["Updated missing requirements..."],
  "qa_risk_insights": ["Updated QA risks..."]
}
"""

async def analyze_prd_text(text: str) -> AnalysisResultSchema:
    # Existing implementation...
    response = await client.chat_completion(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=[
            {"role": "system", "content": "You are a highly capable Product Management AI assistant. Always return valid JSON."},
            {"role": "user", "content": MASTER_PRD_ANALYSIS_PROMPT.replace("{text}", text)}
        ],
        max_tokens=4000,
        temperature=0.2,
    )
    return parse_huggingface_response(response.choices[0].message.content)

async def refine_prd_text(current_prd: str, instruction: str) -> AnalysisResultSchema:
    prompt = REFINE_PRD_PROMPT.replace("{current_prd}", current_prd).replace("{instruction}", instruction)
    
    response = await client.chat_completion(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=[
            {"role": "system", "content": "You are a helpful PM assistant specializing in PRD refinement. Always return valid JSON."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=4000,
        temperature=0.2,
    )
    
    return parse_huggingface_response(response.choices[0].message.content)

def parse_huggingface_response(content: str) -> AnalysisResultSchema:
    try:
        # Sometimes models wrap JSON in markdown blocks
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]
            
        data = json.loads(content.strip())
        return AnalysisResultSchema(**data)
    except Exception as e:
        print(f"Failed to parse JSON response: {e}")
        # Fallback to a valid schema if parsing fails
        return AnalysisResultSchema(
            standardized_prd=content,
            quality_score=0,
            missing_requirements=["Failed to parse missing requirements."],
            qa_risk_insights=["Failed to parse QA insights."]
        )

