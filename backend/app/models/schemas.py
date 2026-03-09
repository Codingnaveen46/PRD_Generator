from typing import List, Optional
from pydantic import BaseModel

class AnalysisResultSchema(BaseModel):
    standardized_prd: str
    quality_score: int
    missing_requirements: List[str]
    qa_risk_insights: List[str]

class PRDResponse(BaseModel):
    id: str
    filename: str
    status: str
    created_at: str

class PRDDetailResponse(PRDResponse):
    analysis: Optional[AnalysisResultSchema] = None

class RefinementRequest(BaseModel):
    instruction: str

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    action: str  # "chat" or "update"
    message: str
    analysis: Optional[AnalysisResultSchema] = None

class TestCaseSchema(BaseModel):
    scenario: str
    testing_type: str
    severity: str
    priority: str
    feature_name: str
    sub_feature_name: str
    test_conditions: str
    test_idea: str
    test_data: str
    acceptance_criteria: str
    test_steps: str

class TestCaseListResponse(BaseModel):
    prd_id: str
    test_cases: List[TestCaseSchema]


class CoverageModuleSchema(BaseModel):
    module_name: str
    total_requirements: int
    covered_requirements: int
    coverage_percentage: int
    mapped_test_scenarios: List[str]
    uncovered_requirements: List[str]
    recommended_test_scenarios: List[str]


class RiskAnalysisItemSchema(BaseModel):
    area: str
    level: str
    issues: List[str]
    suggested_testing_approach: str


class MindMapRequirementSchema(BaseModel):
    requirement: str
    scenarios: List[str]
    covered: bool


class MindMapModuleSchema(BaseModel):
    module_name: str
    requirements: List[MindMapRequirementSchema]


class QAIntelligenceSchema(BaseModel):
    overall_coverage_percentage: int
    coverage_modules: List[CoverageModuleSchema]
    uncovered_requirement_alerts: List[str]
    risk_analysis: List[RiskAnalysisItemSchema]
    mind_map: List[MindMapModuleSchema]


class QAIntelligenceResponse(BaseModel):
    prd_id: str
    intelligence: QAIntelligenceSchema
    cached: bool = False


class AutomationScriptRequest(BaseModel):
    framework: str
    scenario: str
    testing_type: str
    feature_name: str
    sub_feature_name: str
    test_data: str
    acceptance_criteria: str
    test_steps: str


class AutomationScriptResponse(BaseModel):
    framework: str
    language: str
    file_name: str
    code: str
    explanation: str
