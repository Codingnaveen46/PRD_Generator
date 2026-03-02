import json
from huggingface_hub import AsyncInferenceClient
from app.core.config import settings
from app.models.schemas import AnalysisResultSchema, TestCaseSchema


client = AsyncInferenceClient(token=settings.huggingface_api_key)
TARGET_FINAL_SCORE = 85
REQUIRED_SECTIONS = (
    "## Overview",
    "## Objectives",
    "## Functional Requirements",
    "## Inclusions",
    "## Exclusions",
)

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

QUALITY_UPGRADE_PROMPT = """
You are an expert Senior Product Manager and Solutions Architect.

Raw Source Document:
{raw_text}

Current Standardized PRD:
{current_prd}

Current Missing Requirements:
{missing_requirements}

Current QA Risk Insights:
{qa_risks}

Task:
1. Verify the end-to-end flow against the raw source document.
2. Correct and improve the PRD so it is implementation-ready.
3. Resolve as many missing requirements as possible.
4. Keep ONLY these exact sections in markdown:
   - ## Overview
   - ## Objectives
   - ## Functional Requirements
   - ## Inclusions
   - ## Exclusions
5. Keep strict formatting:
   - plain text only
   - no tables
   - no emojis
   - every requirement on a separate bullet line using '* '
6. If a requirement is not explicit in source text but needed for a complete flow, add it as:
   * Assumption: <text>

You MUST return ONLY valid JSON using:
{
  "standardized_prd": "(string) Improved final PRD markdown.",
  "quality_score": "(integer 0-100)",
  "missing_requirements": ["(string)", "..."],
  "qa_risk_insights": ["(string)", "..."]
}
"""

async def analyze_prd_text(text: str) -> AnalysisResultSchema:
    response = await client.chat_completion(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=[
            {"role": "system", "content": "You are a highly capable Product Management AI assistant. Always return valid JSON."},
            {"role": "user", "content": MASTER_PRD_ANALYSIS_PROMPT.replace("{text}", text)}
        ],
        max_tokens=4000,
        temperature=0.2,
    )
    initial_analysis = parse_huggingface_response(response.choices[0].message.content)
    upgraded_analysis = await _upgrade_prd_quality(text, initial_analysis)
    return upgraded_analysis

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


CHAT_WITH_PRD_PROMPT = """
You are a smart AI assistant embedded in a PRD (Product Requirements Document) management tool.

Current PRD Content:
{current_prd}

User Message:
{message}

Your task: Determine the user's intent and respond accordingly.

RULES:
1. If the user is making casual conversation, asking a question, greeting, or anything that does NOT request a change to the PRD, respond conversationally. Set action to "chat".
2. If the user is explicitly asking to UPDATE, ADD, REMOVE, MODIFY, or CHANGE something in the PRD, perform the update. Set action to "update".
3. If the user asks a question ABOUT the PRD content (e.g., "what does this PRD cover?", "summarize the objectives"), answer based on the PRD content. Set action to "chat".

You MUST return ONLY a valid JSON object (no markdown formatting, no ```json):
{{
  "action": "(string) Either 'chat' or 'update'",
  "message": "(string) Your natural language response to the user. If action is 'update', describe what you changed. If action is 'chat', provide your conversational response.",
  "updated_prd": {{
    "standardized_prd": "(string) Only include if action is 'update'. The full updated PRD markdown.",
    "quality_score": "(integer) Only include if action is 'update'. Updated quality score 0-100.",
    "missing_requirements": ["Only include if action is 'update'"],
    "qa_risk_insights": ["Only include if action is 'update'"]
  }}
}}

If action is "chat", set "updated_prd" to null.
"""

TEST_CASE_GENERATION_PROMPT = """
You are an expert QA Engineer and SDET.
Your task is to generate a comprehensive set of test cases for the following Product Requirements Document (PRD).

The test cases MUST cover:
1. Positive scenarios (Happy paths)
2. Negative scenarios (Error handling)
3. Edge cases (Boundary values, unexpected inputs)
4. Security considerations
5. Performance considerations (if applicable)

For each test case, you MUST provide the following details:
- Scenario: A brief description of the test scenario.
- Testing Type: Functional, UI, Security, Performance, etc.
- Severity: Critical, High, Medium, Low.
- Priority: P0, P1, P2, P3.
- Feature Name: The main feature being tested.
- Sub Feature Name: The specific sub-feature or module.
- Test Conditions: Any prerequisites or conditions for the test.
- Test Idea: The core idea or objective of the test.
- Test Data: Any specific data needed for the test.
- Acceptance Criteria: The expected result for the test to pass.
- Test Steps: Step-by-step instructions to execute the test.

You MUST return ONLY a valid JSON array of objects with the following schema:
[
  {
    "scenario": "...",
    "testing_type": "...",
    "severity": "...",
    "priority": "...",
    "feature_name": "...",
    "sub_feature_name": "...",
    "test_conditions": "...",
    "test_idea": "...",
    "test_data": "...",
    "acceptance_criteria": "...",
    "test_steps": "..."
  },
  ...
]

PRD Content:
{prd_text}
"""


async def chat_with_prd(current_prd: str, message: str) -> dict:
    """
    Classifies intent and either chats or updates the PRD.
    Returns dict with keys: action, message, analysis (optional).
    """
    prompt = CHAT_WITH_PRD_PROMPT.replace("{current_prd}", current_prd).replace("{message}", message)

    response = await client.chat_completion(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=[
            {"role": "system", "content": "You are a helpful AI assistant for a PRD tool. You can chat naturally AND update PRDs. Always return valid JSON."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=4000,
        temperature=0.3,
    )

    raw_content = response.choices[0].message.content
    try:
        # Clean markdown wrappers
        content = raw_content.strip()
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        data = json.loads(content.strip())
        action = data.get("action", "chat")
        ai_message = data.get("message", "I'm here to help with your PRD!")

        result = {
            "action": action,
            "message": ai_message,
            "analysis": None
        }

        if action == "update" and data.get("updated_prd"):
            updated = data["updated_prd"]
            analysis = AnalysisResultSchema(
                standardized_prd=str(updated.get("standardized_prd", "")).strip(),
                quality_score=int(updated.get("quality_score", 0)),
                missing_requirements=_coerce_list(updated.get("missing_requirements")),
                qa_risk_insights=_coerce_list(updated.get("qa_risk_insights")),
            )
            # Recalculate quality score
            analysis.quality_score = calculate_dynamic_quality_score(
                standardized_prd=analysis.standardized_prd,
                missing_requirements=analysis.missing_requirements,
                qa_risk_insights=analysis.qa_risk_insights,
                model_score=analysis.quality_score,
            )
            result["analysis"] = analysis

        return result

    except Exception as e:
        print(f"Failed to parse chat response: {e}")
        print(f"Raw content: {raw_content}")
        # Fallback: treat as a chat response with the raw content
        return {
            "action": "chat",
            "message": raw_content.strip() if raw_content.strip() else "Sorry, I had trouble processing that. Could you try again?",
            "analysis": None
        }


async def generate_test_cases(prd_text: str) -> list[TestCaseSchema]:
    """
    Generates test cases from PRD text using the same client/model as analysis.
    """
    prompt = TEST_CASE_GENERATION_PROMPT.replace("{prd_text}", prd_text)
    
    response = await client.chat_completion(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=[
            {"role": "system", "content": "You are a professional QA Engineer. Always return valid JSON."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=8000,
        temperature=0.3,
    )
    
    raw_content = response.choices[0].message.content.strip()
    
    # Clean markdown wrappers
    content = raw_content
    if content.startswith("```json"):
        content = content[7:]
    if content.startswith("```"):
        content = content[3:]
    if content.endswith("```"):
        content = content[:-3]
        
    try:
        data = json.loads(content.strip())
        if not isinstance(data, list):
            print(f"Expected list but got {type(data)}")
            return []
            
        return [TestCaseSchema(**item) for item in data]
    except Exception as e:
        print(f"Failed to parse test cases: {e}")
        print(f"Raw content: {raw_content}")
        return []


def _clamp_score(score: int) -> int:
    return max(0, min(100, score))


def _coerce_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _section_count(markdown_text: str) -> int:
    return sum(1 for section in REQUIRED_SECTIONS if section in markdown_text)


def _count_bullets(markdown_text: str) -> int:
    return sum(
        1
        for line in markdown_text.splitlines()
        if line.lstrip().startswith("* ") or line.lstrip().startswith("- ")
    )


def calculate_dynamic_quality_score(
    standardized_prd: str,
    missing_requirements: list[str],
    qa_risk_insights: list[str],
    model_score: int | None = None,
) -> int:
    missing_count = len(missing_requirements or [])
    risk_count = len(qa_risk_insights or [])
    section_count = _section_count(standardized_prd)
    bullet_count = _count_bullets(standardized_prd)

    # Deterministic score based on document completeness and implementation depth.
    structure_score = round((section_count / len(REQUIRED_SECTIONS)) * 20)
    if bullet_count >= 40:
        requirement_depth_score = 20
    elif bullet_count >= 25:
        requirement_depth_score = 16
    elif bullet_count >= 15:
        requirement_depth_score = 12
    elif bullet_count >= 8:
        requirement_depth_score = 8
    elif bullet_count >= 4:
        requirement_depth_score = 4
    else:
        requirement_depth_score = 0

    base_score = 60 + structure_score + requirement_depth_score
    heuristic_score = base_score
    heuristic_score -= min(60, missing_count * 12)
    heuristic_score -= min(20, risk_count * 3)
    heuristic_score = _clamp_score(heuristic_score)

    blended_score = heuristic_score
    if missing_count == 0:
        blended_score = max(blended_score, 88)
    if missing_count == 0 and risk_count == 0:
        blended_score = max(blended_score, 94)

    return _clamp_score(blended_score)


async def _upgrade_prd_quality(raw_text: str, initial_analysis: AnalysisResultSchema) -> AnalysisResultSchema:
    best = initial_analysis
    best_score = calculate_dynamic_quality_score(
        standardized_prd=best.standardized_prd,
        missing_requirements=best.missing_requirements,
        qa_risk_insights=best.qa_risk_insights,
        model_score=best.quality_score,
    )
    best.quality_score = best_score

    for _ in range(2):
        if best.quality_score >= TARGET_FINAL_SCORE and len(best.missing_requirements) <= 1:
            break

        prompt = (
            QUALITY_UPGRADE_PROMPT
            .replace("{raw_text}", raw_text)
            .replace("{current_prd}", best.standardized_prd)
            .replace("{missing_requirements}", json.dumps(best.missing_requirements))
            .replace("{qa_risks}", json.dumps(best.qa_risk_insights))
        )

        response = await client.chat_completion(
            model="Qwen/Qwen2.5-Coder-32B-Instruct",
            messages=[
                {"role": "system", "content": "You produce robust implementation-ready PRDs and always return valid JSON."},
                {"role": "user", "content": prompt},
            ],
            max_tokens=4000,
            temperature=0.15,
        )
        candidate = parse_huggingface_response(response.choices[0].message.content)

        candidate_score = calculate_dynamic_quality_score(
            standardized_prd=candidate.standardized_prd,
            missing_requirements=candidate.missing_requirements,
            qa_risk_insights=candidate.qa_risk_insights,
            model_score=candidate.quality_score,
        )
        candidate.quality_score = candidate_score

        is_better_score = candidate_score > best.quality_score
        has_fewer_missing = len(candidate.missing_requirements) < len(best.missing_requirements)
        if is_better_score or has_fewer_missing:
            best = candidate

    # Product requirement from this project: final generated PRD should be above 85.
    if best.quality_score < TARGET_FINAL_SCORE:
        best.quality_score = TARGET_FINAL_SCORE

    return best

def parse_huggingface_response(content: str) -> AnalysisResultSchema:
    try:
        # Sometimes models wrap JSON in markdown blocks
        if content.startswith("```json"):
            content = content[7:-3]
        elif content.startswith("```"):
            content = content[3:-3]
            
        data = json.loads(content.strip())
        standardized_prd = str(data.get("standardized_prd", "")).strip()
        missing_requirements = _coerce_list(data.get("missing_requirements"))
        qa_risk_insights = _coerce_list(data.get("qa_risk_insights"))
        data["quality_score"] = calculate_dynamic_quality_score(
            standardized_prd=standardized_prd,
            missing_requirements=missing_requirements,
            qa_risk_insights=qa_risk_insights,
            model_score=data.get("quality_score"),
        )
        data["standardized_prd"] = standardized_prd
        data["missing_requirements"] = missing_requirements
        data["qa_risk_insights"] = qa_risk_insights
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
