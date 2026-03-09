import json
from huggingface_hub import AsyncInferenceClient
from app.core.config import settings
from app.models.schemas import (
    AnalysisResultSchema,
    AutomationScriptRequest,
    AutomationScriptResponse,
    CoverageModuleSchema,
    MindMapModuleSchema,
    MindMapRequirementSchema,
    QAIntelligenceSchema,
    RiskAnalysisItemSchema,
    TestCaseSchema,
)


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

QA_INTELLIGENCE_PROMPT = """
You are an expert QA architect and product quality analyst.

Your task is to analyze a PRD and its generated test cases to produce advanced QA intelligence.

You MUST:
1. Identify major modules / features from the PRD.
2. Identify requirement statements for each module.
3. Map generated test scenarios to those requirements.
4. Estimate requirement coverage per module.
5. Highlight uncovered or weakly tested requirements.
6. Identify bug-prone or risky areas from the PRD.
7. Build a visual-friendly mind map structure linking modules -> requirements -> scenarios.

Return ONLY valid JSON in this exact structure:
{
  "overall_coverage_percentage": 0,
  "coverage_modules": [
    {
      "module_name": "Authentication",
      "total_requirements": 4,
      "covered_requirements": 3,
      "coverage_percentage": 75,
      "mapped_test_scenarios": ["Valid login", "Invalid password"],
      "uncovered_requirements": ["Define retry limit for login attempts"],
      "recommended_test_scenarios": ["Verify account lockout after repeated failures"]
    }
  ],
  "uncovered_requirement_alerts": ["Authentication lacks MFA fallback coverage"],
  "risk_analysis": [
    {
      "area": "Authentication",
      "level": "High",
      "issues": ["Missing retry limit for login attempts", "No fallback defined for MFA failures"],
      "suggested_testing_approach": "Add brute-force, MFA timeout, and fallback recovery scenarios."
    }
  ],
  "mind_map": [
    {
      "module_name": "Authentication",
      "requirements": [
        {
          "requirement": "User can login with valid credentials",
          "scenarios": ["Valid login", "Locked account"],
          "covered": true
        },
        {
          "requirement": "System handles MFA failure gracefully",
          "scenarios": [],
          "covered": false
        }
      ]
    }
  ]
}

Rules:
- Keep coverage percentage realistic and derived from covered vs total requirements.
- Use concise module names.
- Use short, concrete requirement statements.
- Risk levels must be one of: High, Medium, Low.
- If test coverage is weak, add recommended test scenarios.

PRD:
{prd_text}

TEST CASES:
{test_cases}
"""

PLAYWRIGHT_AUTOMATION_SCRIPT_PROMPT = """
You are a senior Playwright automation engineer writing production-quality UI tests for a real automation framework.

You must reason about the test scenario before producing code.

STEP 1 - Understand the scenario
- Infer the application flow.
- Identify the user actions required.
- Identify the validations and expected outcomes.
- Identify likely UI controls and any page transitions.

STEP 2 - Choose the automation strategy
- First classify the scenario as one of:
  - UI interaction flow
  - API validation flow
  - Combined UI + API workflow
- The implementation pattern MUST follow that classification instead of using a fixed template.
- Prefer stable selectors in this exact order:
  1. getByRole
  2. getByLabel
  3. getByPlaceholder
  4. getByTestId
- Use CSS selectors only if no semantic selector is plausible.
- Avoid deep CSS chains and fragile selectors.
- For UI navigation flows, use waitForURL, URL assertions, or safe navigation handling when the action changes pages.
- For API-heavy flows, validate request/response behavior with waitForResponse or API request assertions when appropriate.
- For combined flows, use both UI assertions and API verification in the same test.
- Do not use invalid ARIA roles such as "password". Password inputs should use getByLabel or another valid accessible selector.
- Use Playwright auto-waiting and expect assertions instead of arbitrary waits.

STEP 3 - Generate production-quality Playwright code
- Use @playwright/test.
- Use a clear, descriptive test name.
- Keep the code clean, readable, and maintainable.
- Add a small number of high-value comments for important actions.
- Use safe navigation handling patterns such as Promise.all with click + waitForNavigation when needed.
- Use meaningful assertions such as URL checks, visible content, and key UI state validation.
- Keep the structure consistent with senior automation engineering practices so selectors and actions are easy to move into page objects later.

STEP 4 - Stability rules
- NEVER use waitForTimeout.
- NEVER use arbitrary sleeps.
- NEVER use fragile CSS chains.
- NEVER include markdown fences or explanations in the code.

STEP 5 - Framework-friendly structure
- Organize selectors and actions so the test can later be extracted into page objects with minimal changes.

STEP 6 - Assertions and lifecycle handling
- Every script must include meaningful assertions that confirm the scenario outcome.
- If the scenario opens a browser page, rely on Playwright fixtures and leave the test cleanly scoped.
- Use request fixtures only when the scenario is API-driven or mixed.
- Keep setup limited to what the test truly needs and avoid leaking state across tests.

STEP 7 - Readability and maintainability
- Use readable variable names.
- Keep indentation and formatting consistent.
- Add only concise comments that explain intent, not obvious syntax.
- The finished script must look like code written by an experienced Playwright engineer.

Use this pre-analysis and follow it:
{strategy_context}

You are generating code for this exact test case:
- Scenario: {scenario}
- Testing Type: {testing_type}
- Feature: {feature_name}
- Sub Feature: {sub_feature_name}
- Test Data: {test_data}
- Acceptance Criteria: {acceptance_criteria}
- Test Steps: {test_steps}

Return ONLY valid JSON in this exact shape:
{
  "framework": "Playwright",
  "language": "TypeScript",
  "file_name": "generated.spec.ts",
  "code": "import { test, expect } from '@playwright/test';\\n\\n...",
  "explanation": "Short summary of the flow validated by the script."
}

The value of "code" must contain only runnable Playwright code and nothing else.
"""

CYPRESS_AUTOMATION_SCRIPT_PROMPT = """
You are a senior Cypress automation engineer writing production-quality UI tests for a real automation framework.

You must reason about the test scenario before producing code.

STEP 1 - Understand the scenario
- Infer the application flow and page transitions.
- Identify the user actions and validations required.
- Identify likely stable, accessible UI controls.

STEP 2 - Choose the automation strategy
- First classify the scenario as one of:
  - UI interaction flow
  - API validation flow
  - Combined UI + API workflow
- The implementation pattern MUST follow that classification instead of using a fixed template.
- Prefer stable selectors in this exact order:
  1. findByRole / contains with accessible text
  2. findByLabelText
  3. findByPlaceholderText
  4. getByTestId / data-testid
- Avoid deep CSS chains, dynamic classes, and brittle selectors.
- Do not use invalid ARIA roles such as "password". Password fields should be targeted with label-based selectors.
- For UI navigation flows, use cy.location, cy.url, or equivalent navigation assertions.
- For API-heavy flows, use cy.request or cy.intercept with response validation.
- For combined flows, use UI interactions plus aliased network verification with cy.intercept/cy.wait.
- Use Cypress retry behavior and assertion chaining instead of fixed waits.

STEP 3 - Generate production-quality Cypress code
- Use describe / it structure.
- Use a clear, descriptive test name.
- Keep selectors and actions easy to extract into page objects later.
- Add only concise, high-value comments.
- Use meaningful assertions for URL, visible state, and key UI outcomes.
- Keep the implementation aligned with production Cypress practices and avoid ad hoc patterns.

STEP 4 - Stability rules
- NEVER use cy.wait with arbitrary time values.
- NEVER use fixed delays.
- NEVER use fragile CSS chains.
- NEVER include markdown fences or explanations in the code.

STEP 5 - Assertions and lifecycle handling
- Every script must include meaningful assertions that confirm the scenario outcome.
- Use beforeEach only when it simplifies stable setup and avoids duplication.
- Let Cypress manage browser lifecycle; do not add unnecessary cleanup noise.
- Keep setup deterministic and avoid leaking state between tests.

STEP 6 - Readability and maintainability
- Use readable aliases and variable names.
- Keep indentation and formatting consistent.
- Add only concise comments that clarify intent.
- The finished script must look like code written by an experienced Cypress engineer.

Use this pre-analysis and follow it:
{strategy_context}

You are generating code for this exact test case:
- Scenario: {scenario}
- Testing Type: {testing_type}
- Feature: {feature_name}
- Sub Feature: {sub_feature_name}
- Test Data: {test_data}
- Acceptance Criteria: {acceptance_criteria}
- Test Steps: {test_steps}

Return ONLY valid JSON in this exact shape:
{
  "framework": "Cypress",
  "language": "TypeScript",
  "file_name": "generated.cy.ts",
  "code": "describe('...', () => {\\n  it('...', () => {\\n    ...\\n  });\\n});",
  "explanation": "Short summary of the flow validated by the script."
}

The value of "code" must contain only runnable Cypress code and nothing else.
"""

SELENIUM_AUTOMATION_SCRIPT_PROMPT = """
You are a senior Selenium automation engineer writing production-quality Java tests for a real automation framework.

You must reason about the test scenario before producing code.

STEP 1 - Understand the scenario
- Infer the application flow, navigation, and expected page transitions.
- Identify the user actions and validations required.
- Identify stable locators that could be reused in a Page Object Model later.

STEP 2 - Choose the automation strategy
- First classify the scenario as one of:
  - UI interaction flow
  - API validation flow
  - Combined UI + API workflow
- The implementation pattern MUST follow that classification instead of using a fixed template.
- Prefer accessible, stable locators first. Use descriptive By locators that are realistic for production UI tests.
- Avoid brittle XPath or deep CSS selectors unless there is no better option.
- Do not use invalid ARIA roles such as "password". Password fields should be accessed via label-associated or stable attribute locators.
- For UI navigation flows, use WebDriverWait with URL or visible-state assertions.
- For API-heavy flows, use explicit Java-based API verification only when the scenario is primarily backend-driven.
- For combined flows, use Selenium UI verification plus explicit backend verification where the scenario clearly requires it.
- Use WebDriverWait and ExpectedConditions for synchronization.

STEP 3 - Generate production-quality Selenium code
- Use Java with JUnit 5.
- Use clear test names and readable helper-level structure inside the method.
- Use WebDriverWait instead of sleeps.
- Include meaningful assertions that confirm the flow succeeded or failed correctly.
- Keep the code ready for future extraction into page objects.
- Include browser setup and teardown that cleanly closes resources.

STEP 4 - Stability rules
- NEVER use Thread.sleep.
- NEVER use arbitrary waits.
- NEVER use brittle locator chains.
- NEVER include markdown fences or explanations in the code.

STEP 5 - Assertions and lifecycle handling
- Every script must include meaningful assertions that confirm the scenario outcome.
- Initialize the driver clearly and always close it safely in teardown/finally.
- Use WebDriverWait and ExpectedConditions for all non-trivial synchronization.
- Keep helper-level structure clean so the method can be moved into a scalable framework later.

STEP 6 - Readability and maintainability
- Use readable variable names and consistent formatting.
- Add only concise comments that clarify important intent.
- The finished script must look like code written by an experienced Selenium automation engineer.

Use this pre-analysis and follow it:
{strategy_context}

You are generating code for this exact test case:
- Scenario: {scenario}
- Testing Type: {testing_type}
- Feature: {feature_name}
- Sub Feature: {sub_feature_name}
- Test Data: {test_data}
- Acceptance Criteria: {acceptance_criteria}
- Test Steps: {test_steps}

Return ONLY valid JSON in this exact shape:
{
  "framework": "Selenium",
  "language": "Java",
  "file_name": "GeneratedTest.java",
  "code": "import org.junit.jupiter.api.Test;\\n...",
  "explanation": "Short summary of the flow validated by the script."
}

The value of "code" must contain only runnable Selenium Java code and nothing else.
"""

API_AUTOMATION_SCRIPT_PROMPT = """
You are a senior API automation engineer writing production-quality automated API tests for a real automation framework.

You must reason about the test scenario before producing code.

STEP 1 - Understand the scenario
- Infer the API flow, request intent, and expected response behavior.
- Identify the request inputs, validation rules, and response assertions required.
- Identify positive and negative validation opportunities when relevant.

STEP 2 - Choose the automation strategy
- First classify the scenario as one of:
  - API validation flow
  - Combined UI + API workflow with API-first verification
- The implementation pattern MUST follow that classification instead of using a fixed template.
- Prefer Playwright API testing with @playwright/test in TypeScript unless the scenario strongly suggests another API library.
- Use native framework assertions and response parsing.
- Validate status code, important response fields, and error handling behavior.
- If the scenario mentions a UI-triggered API flow, focus on validating the backend contract and persisted side effects that can be asserted without a browser.
- Avoid fixed waits or artificial delays.

STEP 3 - Generate production-quality API automation code
- Use a clear, descriptive test name.
- Structure the request payload, request execution, and assertions cleanly.
- Add concise TODO comments only where endpoint details are not known.
- Keep the code easy to refactor into reusable API client helpers later.
- Keep the implementation aligned with production API automation practices.

STEP 4 - Stability rules
- NEVER use arbitrary delays.
- NEVER include markdown fences or explanations in the code.

STEP 5 - Assertions and lifecycle handling
- Every script must validate status code, important response fields, and relevant error handling.
- Keep setup minimal and scoped to the test.
- Reuse the framework request client or fixture cleanly and avoid unnecessary boilerplate.

STEP 6 - Readability and maintainability
- Use readable request payload variables and assertion names.
- Keep formatting consistent.
- Add only concise comments that clarify intent.
- The finished script must look like code written by an experienced API automation engineer.

Use this pre-analysis and follow it:
{strategy_context}

You are generating code for this exact test case:
- Scenario: {scenario}
- Testing Type: {testing_type}
- Feature: {feature_name}
- Sub Feature: {sub_feature_name}
- Test Data: {test_data}
- Acceptance Criteria: {acceptance_criteria}
- Test Steps: {test_steps}

Return ONLY valid JSON in this exact shape:
{
  "framework": "API",
  "language": "TypeScript",
  "file_name": "generated-api.spec.ts",
  "code": "import { test, expect } from '@playwright/test';\\n...",
  "explanation": "Short summary of the flow validated by the script."
}

The value of "code" must contain only runnable API automation code and nothing else.
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


async def generate_qa_intelligence(prd_text: str, test_cases: list[TestCaseSchema]) -> QAIntelligenceSchema:
    prompt = (
        QA_INTELLIGENCE_PROMPT
        .replace("{prd_text}", prd_text)
        .replace(
            "{test_cases}",
            json.dumps(
                [
                    {
                        "scenario": test_case.scenario,
                        "testing_type": test_case.testing_type,
                        "severity": test_case.severity,
                        "priority": test_case.priority,
                        "feature_name": test_case.feature_name,
                        "sub_feature_name": test_case.sub_feature_name,
                        "acceptance_criteria": test_case.acceptance_criteria,
                    }
                    for test_case in test_cases
                ],
                ensure_ascii=False,
            ),
        )
    )

    response = await client.chat_completion(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=[
            {"role": "system", "content": "You are a QA intelligence engine. Always return valid JSON."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=8000,
        temperature=0.2,
    )

    raw_content = response.choices[0].message.content.strip()
    content = _clean_json_content(raw_content)

    try:
        data = json.loads(content)
        return _coerce_qa_intelligence(data, test_cases)
    except Exception as e:
        print(f"Failed to parse QA intelligence: {e}")
        print(f"Raw content: {raw_content}")
        return _fallback_qa_intelligence(test_cases)


async def generate_automation_script(request: AutomationScriptRequest) -> AutomationScriptResponse:
    automation_ir = _build_automation_ir(request)
    prompt = _build_automation_script_prompt(request, automation_ir)

    response = await client.chat_completion(
        model="Qwen/Qwen2.5-Coder-32B-Instruct",
        messages=[
            {"role": "system", "content": "You generate production-grade test automation, apply framework best practices, and always return valid JSON."},
            {"role": "user", "content": prompt},
        ],
        max_tokens=4000,
        temperature=0.15,
    )

    raw_content = response.choices[0].message.content.strip()
    content = _clean_json_content(raw_content)

    try:
        data = json.loads(content)
        generated_code = _clean_generated_code(str(data.get("code") or ""))
        return AutomationScriptResponse(
            framework=str(data.get("framework") or request.framework).strip(),
            language=str(data.get("language") or _default_language_for_framework(request.framework)).strip(),
            file_name=str(data.get("file_name") or _default_file_name(request.framework, request.scenario)).strip(),
            code=generated_code or _fallback_automation_code(request, automation_ir),
            explanation=str(data.get("explanation") or f"Automation-ready script generated from the internal Automation IR for a {automation_ir['test_type']} flow.").strip(),
        )
    except Exception as e:
        print(f"Failed to parse automation script: {e}")
        print(f"Raw content: {raw_content}")
        return AutomationScriptResponse(
            framework=request.framework,
            language=_default_language_for_framework(request.framework),
            file_name=_default_file_name(request.framework, request.scenario),
            code=_fallback_automation_code(request, automation_ir),
            explanation="Fallback automation template generated because the AI response could not be parsed.",
        )


def _clamp_score(score: int) -> int:
    return max(0, min(100, score))


def _clean_json_content(content: str) -> str:
    cleaned = content.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    if cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def _coerce_list(value: object) -> list[str]:
    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]
    if isinstance(value, str) and value.strip():
        return [value.strip()]
    return []


def _default_language_for_framework(framework: str) -> str:
    normalized = framework.strip().lower()
    if normalized in {"playwright", "cypress"}:
        return "TypeScript"
    if normalized == "selenium":
        return "Java"
    return "TypeScript"


def _build_automation_script_prompt(request: AutomationScriptRequest, automation_ir: dict[str, object]) -> str:
    normalized_framework = request.framework.strip().lower()
    if normalized_framework == "playwright":
        template = PLAYWRIGHT_AUTOMATION_SCRIPT_PROMPT
    elif normalized_framework == "cypress":
        template = CYPRESS_AUTOMATION_SCRIPT_PROMPT
    elif normalized_framework == "selenium":
        template = SELENIUM_AUTOMATION_SCRIPT_PROMPT
    else:
        template = API_AUTOMATION_SCRIPT_PROMPT

    strategy_context = _format_automation_ir_context(automation_ir)

    return (
        template
        .replace("{framework}", request.framework)
        .replace("{strategy_context}", strategy_context)
        .replace("{scenario}", request.scenario)
        .replace("{testing_type}", request.testing_type)
        .replace("{feature_name}", request.feature_name)
        .replace("{sub_feature_name}", request.sub_feature_name)
        .replace("{test_data}", request.test_data)
        .replace("{acceptance_criteria}", request.acceptance_criteria)
        .replace("{test_steps}", request.test_steps)
    )


def _default_file_name(framework: str, scenario: str) -> str:
    slug = "".join(char.lower() if char.isalnum() else "-" for char in scenario).strip("-")
    slug = "-".join(part for part in slug.split("-") if part) or "generated-test"
    normalized = framework.strip().lower()
    if normalized == "playwright":
        return f"{slug}.spec.ts"
    if normalized == "cypress":
        return f"{slug}.cy.ts"
    if normalized == "selenium":
        return f"{_pascal_case(slug)}Test.java"
    return f"{slug}.api.spec.ts"


def _pascal_case(value: str) -> str:
    parts = [part for part in value.replace("_", "-").split("-") if part]
    if not parts:
        return "Generated"
    return "".join(part[:1].upper() + part[1:] for part in parts)


def _clean_generated_code(code: str) -> str:
    cleaned = code.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[1] if "\n" in cleaned else cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()


def _build_automation_strategy_context(request: AutomationScriptRequest) -> str:
    return _format_automation_ir_context(_build_automation_ir(request))


def _format_automation_ir_context(automation_ir: dict[str, object]) -> str:
    ordered_steps = automation_ir.get("ordered_test_steps") or []
    formatted_steps = "\n".join(
        f"  {index}. {step}"
        for index, step in enumerate(ordered_steps, start=1)
    ) or "  1. Validate the intended outcome using the scenario details."

    selector_targets = automation_ir.get("selector_targets") or []
    formatted_selectors = "\n".join(
        f"  - {selector_target['element']}: {selector_target['selector_strategy']}"
        for selector_target in selector_targets
        if isinstance(selector_target, dict)
    ) or "  - Use accessible selectors first, then test IDs, then stable attributes."

    assertions = automation_ir.get("assertions") or []
    formatted_assertions = "\n".join(
        f"  - {assertion}"
        for assertion in assertions
        if str(assertion).strip()
    ) or "  - Validate the intended scenario outcome."

    framework_mapping = automation_ir.get("framework_mapping") or {}

    return (
        "Internal Automation IR:\n"
        f"- Test type: {automation_ir['test_type']}\n"
        f"- Primary validation objective: {automation_ir['primary_validation_objective']}\n"
        "- Ordered test steps:\n"
        f"{formatted_steps}\n"
        "- Selector targets:\n"
        f"{formatted_selectors}\n"
        f"- Synchronization strategy: {automation_ir['synchronization_strategy']}\n"
        f"- Assertion strategy: {automation_ir['assertion_strategy']}\n"
        "- Assertions:\n"
        f"{formatted_assertions}\n"
        f"- Classification reasoning: {automation_ir['reasoning']}\n"
        "- Framework mapping:\n"
        f"  - Playwright: {framework_mapping.get('playwright', '')}\n"
        f"  - Cypress: {framework_mapping.get('cypress', '')}\n"
        f"  - Selenium: {framework_mapping.get('selenium', '')}\n"
        f"  - API: {framework_mapping.get('api', '')}"
    )


def _infer_automation_strategy(request: AutomationScriptRequest) -> dict[str, str]:
    combined_text = " ".join(
        part.strip()
        for part in [
            request.scenario,
            request.testing_type,
            request.feature_name,
            request.sub_feature_name,
            request.test_data,
            request.acceptance_criteria,
            request.test_steps,
        ]
        if part and part.strip()
    ).lower()

    ui_keywords = [
        "page", "screen", "button", "click", "select", "choose", "fill", "enter", "type", "upload",
        "modal", "form", "dashboard", "login", "logout", "redirect", "navigate", "tab", "dialog",
        "toast", "visible", "displayed", "shown", "landing",
    ]
    navigation_keywords = [
        "redirect", "navigate", "route", "url", "page loads", "moves to", "taken to", "redirected",
        "dashboard", "landing page", "open page",
    ]
    api_keywords = [
        "api", "endpoint", "request", "response", "payload", "json", "status code", "http", "graphql",
        "rest", "header", "token", "body", "schema", "service", "backend", "network", "retry",
        "webhook", "latency", "timeout", "error code",
    ]
    api_side_effect_keywords = [
        "saved", "persisted", "stored", "created", "updated", "deleted", "sent", "triggered",
        "sync", "synchronized", "notification sent", "email sent",
    ]

    ui_score = sum(1 for keyword in ui_keywords if keyword in combined_text)
    navigation_score = sum(1 for keyword in navigation_keywords if keyword in combined_text)
    api_score = sum(1 for keyword in api_keywords if keyword in combined_text)
    side_effect_score = sum(1 for keyword in api_side_effect_keywords if keyword in combined_text)

    framework = request.framework.strip().lower()

    if framework == "api":
        classification = "API validation flow" if api_score >= ui_score else "Combined UI + API workflow with API-first verification"
    elif api_score and (ui_score or side_effect_score):
        classification = "Combined UI + API workflow"
    elif api_score > ui_score:
        classification = "API validation flow"
    else:
        classification = "UI interaction flow"

    if classification == "UI interaction flow":
        synchronization = (
            "Wait on navigation or URL changes only when the action actually changes pages; otherwise rely on element auto-waiting."
            if navigation_score
            else "Rely on framework-native element waits and stable visibility/state assertions."
        )
        validation = (
            "Validate the resulting page URL, visible content, and user-facing success or error state."
        )
    elif classification == "API validation flow":
        synchronization = (
            "Synchronize on the API request or response path instead of page navigation, then validate the payload and response contract."
        )
        validation = (
            "Assert response status, key response fields, and negative/error handling where relevant."
        )
    else:
        synchronization = (
            "Combine UI synchronization with explicit API verification so the script validates both the user flow and the underlying network/backend behavior."
        )
        validation = (
            "Assert both the visible UI result and the related API response or persisted side effect."
        )

    if framework == "playwright":
        framework_note = (
            "Use waitForURL/toHaveURL for navigation flows, waitForResponse or request context for API-heavy flows, and combine both for mixed scenarios."
        )
    elif framework == "cypress":
        framework_note = (
            "Use cy.location/cy.url for navigation flows, cy.request or cy.intercept for API-heavy flows, and alias intercepted requests for mixed scenarios."
        )
    elif framework == "selenium":
        framework_note = (
            "Use WebDriverWait and ExpectedConditions for UI synchronization, and only add Java API verification when the scenario clearly requires backend validation."
        )
    else:
        framework_note = (
            "Use API-first assertions with request/response validation; for mixed scenarios focus on backend contract checks and verifiable side effects."
        )

    return {
        "classification": classification,
        "reasoning": (
            f"Detected UI cues={ui_score}, navigation cues={navigation_score}, API cues={api_score}, side-effect cues={side_effect_score} from the scenario details."
        ),
        "synchronization": synchronization,
        "validation": validation,
        "framework_note": framework_note,
    }


def _extract_ordered_test_steps(request: AutomationScriptRequest) -> list[str]:
    raw_steps = [
        line.strip().lstrip("-*0123456789. ").strip()
        for line in request.test_steps.replace("\r", "\n").split("\n")
        if line.strip()
    ]
    if raw_steps:
        return raw_steps

    fallback_steps = [
        request.scenario.strip(),
        request.acceptance_criteria.strip(),
    ]
    return [step for step in fallback_steps if step]


def _infer_selector_targets(request: AutomationScriptRequest, classification: str) -> list[dict[str, str]]:
    combined_text = " ".join(
        part.strip()
        for part in [request.scenario, request.acceptance_criteria, request.test_steps]
        if part and part.strip()
    ).lower()

    selector_targets: list[dict[str, str]] = []

    if "login" in combined_text:
        selector_targets.extend([
            {"element": "Username input", "selector_strategy": "Prefer getByLabel('Username') or equivalent accessible label selector."},
            {"element": "Password input", "selector_strategy": "Prefer getByLabel('Password'); do not use an invalid password role."},
            {"element": "Login submit action", "selector_strategy": "Prefer getByRole('button', { name: /login/i }) or equivalent accessible button selector."},
        ])

    if any(keyword in combined_text for keyword in ["upload", "file", "document"]):
        selector_targets.append(
            {"element": "Upload control", "selector_strategy": "Prefer accessible label or button selectors, then stable test IDs for file inputs if needed."}
        )

    if any(keyword in combined_text for keyword in ["dashboard", "heading", "page", "screen", "modal", "dialog"]):
        selector_targets.append(
            {"element": "Primary page confirmation element", "selector_strategy": "Prefer heading, dialog, or landmark role selectors before test IDs or stable attributes."}
        )

    if "API" in classification or "Hybrid" in classification:
        selector_targets.append(
            {"element": "Network interaction", "selector_strategy": "Validate request/response contracts and side effects instead of relying only on UI selectors."}
        )

    if not selector_targets:
        selector_targets.append(
            {"element": "Primary interactive control", "selector_strategy": "Prefer role, label, or placeholder selectors first; fall back to test IDs or stable attributes only when necessary."}
        )

    return selector_targets


def _build_assertions(classification: str, request: AutomationScriptRequest) -> list[str]:
    assertions: list[str] = []
    combined_text = " ".join(
        part.strip()
        for part in [request.scenario, request.acceptance_criteria, request.test_steps]
        if part and part.strip()
    ).lower()

    if classification == "UI":
        if any(keyword in combined_text for keyword in ["redirect", "navigate", "url", "dashboard", "page"]):
            assertions.append("Verify the resulting URL or route matches the expected destination.")
        assertions.append("Verify the key UI element, heading, success state, or error state is visible.")
    elif classification == "API":
        assertions.extend([
            "Verify the response status code matches the expected outcome.",
            "Verify the response body contains the required fields or error details.",
        ])
    else:
        assertions.extend([
            "Verify the triggered API response succeeds or fails as expected.",
            "Verify the final UI state reflects the backend result.",
        ])

    return assertions


def _build_automation_ir(request: AutomationScriptRequest) -> dict[str, object]:
    strategy = _infer_automation_strategy(request)
    classification = strategy["classification"]
    ordered_steps = _extract_ordered_test_steps(request)

    if classification == "UI interaction flow":
        test_type = "UI"
    elif classification == "API validation flow":
        test_type = "API"
    else:
        test_type = "Hybrid"

    framework_mapping = {
        "playwright": "Use Playwright auto-waiting, getByRole/getByLabel selectors, and URL or response validation based on the selected strategy.",
        "cypress": "Use Cypress command chaining, accessible selectors, and URL or intercept/request assertions based on the selected strategy.",
        "selenium": "Use explicit waits with WebDriverWait and ExpectedConditions, stable locators, and deterministic teardown.",
        "api": "Use request/response assertions, response body validation, and API-client fixtures or helpers without browser dependency.",
    }

    return {
        "ir_name": "Automation IR",
        "test_type": test_type,
        "classification": classification,
        "primary_validation_objective": strategy["validation"],
        "ordered_test_steps": ordered_steps,
        "selector_targets": _infer_selector_targets(request, test_type),
        "synchronization_strategy": strategy["synchronization"],
        "assertion_strategy": strategy["validation"],
        "assertions": _build_assertions(test_type, request),
        "reasoning": strategy["reasoning"],
        "framework_mapping": framework_mapping,
    }


def _fallback_automation_code(request: AutomationScriptRequest, automation_ir: dict[str, object] | None = None) -> str:
    framework = request.framework.strip().lower()
    scenario_comment = f"Scenario: {request.scenario}"
    strategy = automation_ir or _build_automation_ir(request)
    classification = str(strategy["classification"])

    if framework == "playwright":
        if classification == "API validation flow":
            return f"""import {{ test, expect }} from '@playwright/test';

test('{request.scenario}', async ({{ request }}) => {{
  // {scenario_comment}
  const response = await request.post('/api/resource', {{
    data: {{
      // TODO: Replace with the real API payload for this scenario.
      notes: `{request.test_data or 'Provide request data for this API flow.'}`,
    }},
  }});

  expect(response.ok()).toBeTruthy();
  expect(response.status()).toBeGreaterThanOrEqual(200);

  const responseBody = await response.json();

  // TODO: Replace placeholder assertions with real response-field validation.
  expect(responseBody).toBeTruthy();
}});
""".rstrip()

        if classification == "Combined UI + API workflow":
            return f"""import {{ test, expect }} from '@playwright/test';

test('{request.scenario}', async ({{ page }}) => {{
  // {scenario_comment}
  await page.goto('/');

  const pageHeading = page.getByRole('heading').first();
  await expect(pageHeading).toBeVisible();

  const relevantResponse = page.waitForResponse((response) =>
    response.ok() && response.url().includes('/api/')
  );

  // TODO: Replace placeholder selectors with the real accessible controls from the product.
  // TODO: Perform the scenario steps that trigger the backend interaction.
  // {request.test_steps}

  const response = await relevantResponse;
  expect(response.ok()).toBeTruthy();
  await expect(page).toHaveURL(/.+/);

  // Validate the visible UI outcome after the backend call completes.
  await expect(pageHeading).toBeVisible();
}});
""".rstrip()

        return f"""import {{ test, expect }} from '@playwright/test';

test('{request.scenario}', async ({{ page }}) => {{
  // {scenario_comment}
  await page.goto('/');

  // Replace placeholder selectors with the real accessible controls from the product.
  const pageHeading = page.getByRole('heading').first();
  await expect(pageHeading).toBeVisible();

  // TODO: Execute the scenario steps using getByRole / getByLabel selectors.
  // {request.test_steps}

  // Validate the expected outcome after the user flow completes.
  await expect(page).toHaveURL(/.+/);
}});
""".rstrip()

    if framework == "cypress":
        if classification == "API validation flow":
            return f"""describe('{request.feature_name or 'Generated flow'}', () => {{
  it('{request.scenario}', () => {{
    // {scenario_comment}
    cy.request({{
      method: 'POST',
      url: '/api/resource',
      body: {{
        // TODO: Replace with the real request body for this API scenario.
        notes: `{request.test_data or 'Provide request data for this API flow.'}`,
      }},
    }}).then((response) => {{
      expect(response.status).to.be.oneOf([200, 201]);
      expect(response.body).to.exist;
    }});
  }});
}});
""".rstrip()

        if classification == "Combined UI + API workflow":
            return f"""describe('{request.feature_name or 'Generated flow'}', () => {{
  it('{request.scenario}', () => {{
    // {scenario_comment}
    cy.intercept('**/api/**').as('apiRequest');
    cy.visit('/');

    // TODO: Perform the scenario steps using stable accessible selectors.
    // {request.test_steps}

    cy.wait('@apiRequest').then((interception) => {{
      expect(interception.response?.statusCode).to.be.oneOf([200, 201]);
    }});

    cy.contains('body', /./).should('be.visible');
    cy.location('pathname').should('match', /.+/);
  }});
}});
""".rstrip()

        return f"""describe('{request.feature_name or 'Generated flow'}', () => {{
  it('{request.scenario}', () => {{
    // {scenario_comment}
    cy.visit('/');

    // TODO: Perform the scenario steps using stable accessible selectors.
    // {request.test_steps}

    cy.contains('body', /./).should('be.visible');
    cy.location('pathname').should('match', /.+/);
  }});
}});
""".rstrip()

    if framework == "selenium":
        class_name = _default_file_name(request.framework, request.scenario).replace(".java", "")
        method_name = class_name[:1].lower() + class_name[1:]
        if classification == "API validation flow":
            return f"""import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.junit.jupiter.api.Test;

public class {class_name} {{

    @Test
    void {method_name}() throws Exception {{
        // {scenario_comment}
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest request = HttpRequest.newBuilder()
            .uri(URI.create("http://localhost:8000/api/resource"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{{}}"))
            .build();

        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());

        assertTrue(response.statusCode() >= 200 && response.statusCode() < 300);
        assertEquals(false, response.body().isBlank());
    }}
}}
""".rstrip()

        return f"""import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.openqa.selenium.By;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.WebElement;
import org.openqa.selenium.chrome.ChromeDriver;
import org.openqa.selenium.support.ui.ExpectedConditions;
import org.openqa.selenium.support.ui.WebDriverWait;

public class {class_name} {{

    @Test
    void {method_name}() {{
        WebDriver driver = new ChromeDriver();
        WebDriverWait wait = new WebDriverWait(driver, Duration.ofSeconds(10));

        try {{
            // {scenario_comment}
            driver.get("http://localhost:3000");

            WebElement pageHeading = wait.until(
                ExpectedConditions.visibilityOfElementLocated(By.tagName("h1"))
            );
            assertTrue(pageHeading.isDisplayed());

            // TODO: Execute the scenario steps with stable locators.
            // {request.test_steps}

            // Validate the user-visible outcome after the flow completes.
            assertTrue(pageHeading.isDisplayed());
        }} finally {{
            driver.quit();
        }}
    }}
}}
""".rstrip()

    if classification == "Combined UI + API workflow with API-first verification":
        return f"""import {{ test, expect }} from '@playwright/test';

test('{request.scenario}', async ({{ request }}) => {{
  // {scenario_comment}
  const response = await request.post('/api/resource', {{
    data: {{
      // TODO: Replace with the real request payload that the UI flow would trigger.
      notes: `{request.test_data or 'Provide request data for this combined API flow.'}`,
    }},
  }});

  expect(response.ok()).toBeTruthy();

  const responseBody = await response.json();

  // TODO: Validate the side effect or persisted state that corresponds to the UI flow.
  expect(responseBody).toBeTruthy();
}});
""".rstrip()

    return f"""import {{ test, expect }} from '@playwright/test';

test('{request.scenario}', async ({{ request }}) => {{
  // {scenario_comment}
  const response = await request.post('/api/resource', {{
    data: {{
      // TODO: Map the real request payload for this scenario.
      notes: `{request.test_data or 'Provide request data for this API flow.'}`,
    }},
  }});

  expect(response.status()).toBeGreaterThanOrEqual(200);
  expect(response.ok()).toBeTruthy();

  const responseBody = await response.json();

  // TODO: Replace placeholder assertions with the real response schema.
  expect(responseBody).toBeTruthy();
}});
""".rstrip()


def _fallback_qa_intelligence(test_cases: list[TestCaseSchema]) -> QAIntelligenceSchema:
    grouped: dict[str, list[TestCaseSchema]] = {}
    for test_case in test_cases:
        module_name = (test_case.feature_name or test_case.sub_feature_name or "General").strip() or "General"
        grouped.setdefault(module_name, []).append(test_case)

    coverage_modules: list[CoverageModuleSchema] = []
    mind_map: list[MindMapModuleSchema] = []
    uncovered_alerts: list[str] = []
    risk_analysis: list[RiskAnalysisItemSchema] = []

    for module_name, module_cases in grouped.items():
        requirement_names = {
            (case.sub_feature_name or case.scenario or "General requirement").strip()
            for case in module_cases
            if (case.sub_feature_name or case.scenario)
        }
        total_requirements = max(1, len(requirement_names))
        covered_requirements = len(requirement_names)
        coverage_percentage = 100 if total_requirements else 0
        mapped_scenarios = [case.scenario for case in module_cases[:6] if case.scenario]

        coverage_modules.append(
            CoverageModuleSchema(
                module_name=module_name,
                total_requirements=total_requirements,
                covered_requirements=covered_requirements,
                coverage_percentage=coverage_percentage,
                mapped_test_scenarios=mapped_scenarios,
                uncovered_requirements=[],
                recommended_test_scenarios=[],
            )
        )

        requirements: list[MindMapRequirementSchema] = []
        for requirement_name in sorted(requirement_names):
            scenarios = [case.scenario for case in module_cases if (case.sub_feature_name or case.scenario).strip() == requirement_name]
            requirements.append(
                MindMapRequirementSchema(
                    requirement=requirement_name,
                    scenarios=scenarios,
                    covered=bool(scenarios),
                )
            )

        mind_map.append(MindMapModuleSchema(module_name=module_name, requirements=requirements))

        high_risk_cases = [case for case in module_cases if normalize_priority_or_severity(case.severity) in {"critical", "high"}]
        if high_risk_cases:
            risk_analysis.append(
                RiskAnalysisItemSchema(
                    area=module_name,
                    level="Medium" if len(high_risk_cases) < 3 else "High",
                    issues=[case.scenario for case in high_risk_cases[:3]],
                    suggested_testing_approach="Review negative paths, edge cases, and system failure handling for this module.",
                )
            )

    overall_coverage = round(
        sum(module.coverage_percentage for module in coverage_modules) / len(coverage_modules)
    ) if coverage_modules else 0

    if not risk_analysis:
        risk_analysis.append(
            RiskAnalysisItemSchema(
                area="General",
                level="Low",
                issues=["No major risk concentrations detected from the generated test cases."],
                suggested_testing_approach="Continue validating edge cases and non-functional requirements.",
            )
        )

    return QAIntelligenceSchema(
        overall_coverage_percentage=overall_coverage,
        coverage_modules=coverage_modules,
        uncovered_requirement_alerts=uncovered_alerts,
        risk_analysis=risk_analysis,
        mind_map=mind_map,
    )


def _coerce_qa_intelligence(data: dict, test_cases: list[TestCaseSchema]) -> QAIntelligenceSchema:
    coverage_modules = [
        CoverageModuleSchema(
            module_name=str(item.get("module_name") or "General").strip(),
            total_requirements=max(1, int(item.get("total_requirements") or 1)),
            covered_requirements=max(0, int(item.get("covered_requirements") or 0)),
            coverage_percentage=_clamp_score(int(item.get("coverage_percentage") or 0)),
            mapped_test_scenarios=_coerce_list(item.get("mapped_test_scenarios")),
            uncovered_requirements=_coerce_list(item.get("uncovered_requirements")),
            recommended_test_scenarios=_coerce_list(item.get("recommended_test_scenarios")),
        )
        for item in (data.get("coverage_modules") or [])
        if isinstance(item, dict)
    ]

    risk_analysis = [
        RiskAnalysisItemSchema(
            area=str(item.get("area") or "General").strip(),
            level=str(item.get("level") or "Medium").strip(),
            issues=_coerce_list(item.get("issues")),
            suggested_testing_approach=str(item.get("suggested_testing_approach") or "").strip(),
        )
        for item in (data.get("risk_analysis") or [])
        if isinstance(item, dict)
    ]

    mind_map = [
        MindMapModuleSchema(
            module_name=str(item.get("module_name") or "General").strip(),
            requirements=[
                MindMapRequirementSchema(
                    requirement=str(requirement.get("requirement") or "General requirement").strip(),
                    scenarios=_coerce_list(requirement.get("scenarios")),
                    covered=bool(requirement.get("covered")),
                )
                for requirement in (item.get("requirements") or [])
                if isinstance(requirement, dict)
            ],
        )
        for item in (data.get("mind_map") or [])
        if isinstance(item, dict)
    ]

    overall_coverage = _clamp_score(int(data.get("overall_coverage_percentage") or 0))

    intelligence = QAIntelligenceSchema(
        overall_coverage_percentage=overall_coverage,
        coverage_modules=coverage_modules,
        uncovered_requirement_alerts=_coerce_list(data.get("uncovered_requirement_alerts")),
        risk_analysis=risk_analysis,
        mind_map=mind_map,
    )

    if not intelligence.coverage_modules or not intelligence.mind_map:
        return _fallback_qa_intelligence(test_cases)

    return intelligence


def normalize_priority_or_severity(value: str) -> str:
    return (value or "").strip().lower()


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
