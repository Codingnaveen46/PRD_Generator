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
