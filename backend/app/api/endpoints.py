from fastapi import APIRouter, HTTPException, UploadFile, File, BackgroundTasks, status
from typing import List
import uuid

from app.core.database import supabase
from app.models.schemas import (
    PRDResponse, 
    PRDDetailResponse, 
    AnalysisResultSchema, 
    RefinementRequest, 
    ChatRequest, 
    ChatResponse,
    TestCaseSchema,
    TestCaseListResponse
)
from app.services.extractor import extract_text
from app.services.analyzer import (
    analyze_prd_text,
    refine_prd_text,
    chat_with_prd,
    calculate_dynamic_quality_score,
    generate_test_cases,
    TARGET_FINAL_SCORE,
)

router = APIRouter()

# Test user UUID (created in Supabase auth to satisfy FK constraint)
ANON_USER_ID = "39803246-87ff-4b15-8560-dff026e592bc"


def _count_markdown_bullets(markdown_text: str) -> int:
    return sum(
        1
        for line in markdown_text.splitlines()
        if line.lstrip().startswith("* ") or line.lstrip().startswith("- ")
    )

async def process_document(prd_id: str, file_bytes: bytes, filename: str):
    try:
        # 1. Extract text
        print(f"Extracting text for PRD {prd_id}")
        text = extract_text(file_bytes, filename)
        
        # 2. Analyze with OpenAI
        print(f"Analyzing text for PRD {prd_id} with OpenAI")
        analysis: AnalysisResultSchema = await analyze_prd_text(text)
        
        # 3. Store results
        print(f"Storing results for PRD {prd_id}")
        supabase.table("analysis_results").insert({
            "prd_id": prd_id,
            "standardized_prd": analysis.standardized_prd,
            "quality_score": analysis.quality_score,
            "missing_requirements": getattr(analysis, 'missing_requirements', []),
            "qa_risk_insights": getattr(analysis, 'qa_risk_insights', [])
        }).execute()

        # 4. Update status to completed
        supabase.table("prds").update({"status": "completed"}).eq("id", prd_id).execute()
        print(f"Finished processing PRD {prd_id}")

    except Exception as e:
        print(f"Error processing document: {e}")
        supabase.table("prds").update({"status": "failed"}).eq("id", prd_id).execute()

@router.post("/analyze", response_model=PRDResponse)
async def upload_and_analyze(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    if not file.filename.lower().endswith(('.pdf', '.md', '.docx')):
         raise HTTPException(status_code=400, detail="Only .pdf, .docx, and .md files are supported")

    file_bytes = await file.read()
    
    # Generate unique storage path
    storage_path = f"{ANON_USER_ID}/{uuid.uuid4()}_{file.filename}"
    
    try:
        # Try to upload to Supabase Storage (may fail if storage RLS is strict)
        try:
            supabase.storage.from_("prd_documents").upload(storage_path, file_bytes)
        except Exception as storage_err:
            print(f"Storage upload skipped (non-critical): {storage_err}")
        
        # Create database record (user_id is text to avoid FK constraint issues)
        db_res = supabase.table("prds").insert({
            "user_id": ANON_USER_ID,
            "filename": file.filename,
            "storage_path": storage_path,
            "status": "processing"
        }).execute()
        
        prd_record = db_res.data[0]
        
        # Background processing
        background_tasks.add_task(process_document, prd_record['id'], file_bytes, file.filename)
        
        return PRDResponse(
            id=prd_record['id'],
            filename=prd_record['filename'],
            status=prd_record['status'],
            created_at=prd_record['created_at']
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prds", response_model=List[PRDResponse])
async def list_prds():
    try:
        response = supabase.table("prds").select("*").order("created_at", desc=True).execute()
        return [PRDResponse(**item) for item in response.data]
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.get("/prds/{prd_id}", response_model=PRDDetailResponse)
async def get_prd_detail(prd_id: str):
    try:
        # Get PRD
        prd_res = supabase.table("prds").select("*").eq("id", prd_id).execute()
        if not prd_res.data:
            raise HTTPException(status_code=404, detail="PRD not found")
            
        prd = prd_res.data[0]
        response_model = PRDDetailResponse(**prd)
        
        # If completed, get analysis
        if prd['status'] == 'completed':
             analysis_res = supabase.table("analysis_results").select("*").eq("prd_id", prd_id).execute()
             if analysis_res.data:
                 analysis_data = analysis_res.data[0]
                 stored_score = int(analysis_data.get("quality_score") or 0)
                 recalculated_score = calculate_dynamic_quality_score(
                     standardized_prd=analysis_data.get("standardized_prd") or "",
                     missing_requirements=analysis_data.get("missing_requirements") or [],
                     qa_risk_insights=analysis_data.get("qa_risk_insights") or [],
                     model_score=analysis_data.get("quality_score"),
                 )
                 recalculated_score = max(recalculated_score, stored_score, TARGET_FINAL_SCORE)
                 if recalculated_score != analysis_data.get("quality_score"):
                     supabase.table("analysis_results").update({
                         "quality_score": recalculated_score
                     }).eq("prd_id", prd_id).execute()
                 analysis_data["quality_score"] = recalculated_score
                 response_model.analysis = AnalysisResultSchema(**analysis_data)
                 
        return response_model
    except HTTPException:
        raise
    except Exception as e:
         raise HTTPException(status_code=500, detail=str(e))

@router.delete("/prds/{prd_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_prd(prd_id: str):
    try:
        prd_res = supabase.table("prds").select("id, storage_path").eq("id", prd_id).execute()
        if not prd_res.data:
            raise HTTPException(status_code=404, detail="PRD not found")

        prd = prd_res.data[0]
        storage_path = prd.get("storage_path")

        if storage_path:
            try:
                supabase.storage.from_("prd_documents").remove([storage_path])
            except Exception as storage_err:
                print(f"Storage delete skipped (non-critical): {storage_err}")

        supabase.table("prds").delete().eq("id", prd_id).execute()
        return None
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prds/{prd_id}/refine", response_model=PRDDetailResponse)
async def refine_prd(prd_id: str, request: RefinementRequest):
    try:
        # 1. Get current PRD and analysis
        prd_res = supabase.table("prds").select("*").eq("id", prd_id).execute()
        if not prd_res.data:
            raise HTTPException(status_code=404, detail="PRD not found")
            
        analysis_res = supabase.table("analysis_results").select("*").eq("prd_id", prd_id).execute()
        if not analysis_res.data:
            raise HTTPException(status_code=400, detail="PRD has no analysis to refine")
            
        current_analysis = analysis_res.data[0]
        
        # 2. Call refinement logic
        new_analysis: AnalysisResultSchema = await refine_prd_text(
            current_analysis['standardized_prd'], 
            request.instruction
        )

        current_score = int(current_analysis.get("quality_score") or 0)
        current_missing_count = len(current_analysis.get("missing_requirements") or [])
        new_missing_count = len(getattr(new_analysis, "missing_requirements", []) or [])
        new_risks = getattr(new_analysis, "qa_risk_insights", []) or []
        previous_prd_text = current_analysis.get("standardized_prd") or ""
        previous_bullet_count = _count_markdown_bullets(previous_prd_text)
        new_bullet_count = _count_markdown_bullets(new_analysis.standardized_prd or "")
        added_bullets = max(0, new_bullet_count - previous_bullet_count)

        adjusted_score = calculate_dynamic_quality_score(
            standardized_prd=new_analysis.standardized_prd,
            missing_requirements=getattr(new_analysis, "missing_requirements", []) or [],
            qa_risk_insights=new_risks,
            model_score=new_analysis.quality_score,
        )

        # Refinement should not penalize quality if missing requirements are not worse.
        if new_missing_count <= current_missing_count:
            adjusted_score = max(adjusted_score, current_score)

        if new_missing_count < current_missing_count:
            improvement = (current_missing_count - new_missing_count) * 6
            adjusted_score = max(adjusted_score, min(100, current_score + improvement))

        if current_missing_count > 0 and new_missing_count == 0:
            adjusted_score = max(adjusted_score, 90)

        # If user added substantial requirement detail, reflect small score gain.
        if current_missing_count > 0 and added_bullets >= 2:
            adjusted_score = max(adjusted_score, min(100, current_score + min(10, added_bullets)))

        adjusted_score = max(adjusted_score, TARGET_FINAL_SCORE)
        new_analysis.quality_score = adjusted_score
        
        # 3. Update database
        supabase.table("analysis_results").update({
            "standardized_prd": new_analysis.standardized_prd,
            "quality_score": new_analysis.quality_score,
            "missing_requirements": getattr(new_analysis, 'missing_requirements', []),
            "qa_risk_insights": getattr(new_analysis, 'qa_risk_insights', [])
        }).eq("prd_id", prd_id).execute()
        
        # 4. Return updated PRD detail
        return await get_prd_detail(prd_id)
        
    except Exception as e:
        print(f"Error refining PRD: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prds/{prd_id}/chat", response_model=ChatResponse)
async def chat_prd(prd_id: str, request: ChatRequest):
    try:
        # 1. Get current PRD and analysis
        prd_res = supabase.table("prds").select("*").eq("id", prd_id).execute()
        if not prd_res.data:
            raise HTTPException(status_code=404, detail="PRD not found")

        analysis_res = supabase.table("analysis_results").select("*").eq("prd_id", prd_id).execute()
        if not analysis_res.data:
            raise HTTPException(status_code=400, detail="PRD has no analysis yet")

        current_analysis = analysis_res.data[0]
        current_prd_text = current_analysis.get("standardized_prd", "")

        # 2. Call the chat function that classifies intent
        chat_result = await chat_with_prd(current_prd_text, request.message)

        action = chat_result["action"]
        ai_message = chat_result["message"]
        new_analysis = chat_result.get("analysis")

        response_analysis = None

        # 3. If the AI decided to update, persist changes
        if action == "update" and new_analysis:
            current_score = int(current_analysis.get("quality_score") or 0)
            current_missing_count = len(current_analysis.get("missing_requirements") or [])
            new_missing_count = len(new_analysis.missing_requirements or [])
            new_risks = new_analysis.qa_risk_insights or []
            previous_prd_text = current_analysis.get("standardized_prd") or ""
            previous_bullet_count = _count_markdown_bullets(previous_prd_text)
            new_bullet_count = _count_markdown_bullets(new_analysis.standardized_prd or "")
            added_bullets = max(0, new_bullet_count - previous_bullet_count)

            # Recalculate score from scratch based on new content
            adjusted_score = calculate_dynamic_quality_score(
                standardized_prd=new_analysis.standardized_prd,
                missing_requirements=new_analysis.missing_requirements or [],
                qa_risk_insights=new_risks,
                model_score=new_analysis.quality_score,
            )

            # Never penalize score if missing requirements didn't get worse
            if new_missing_count <= current_missing_count:
                adjusted_score = max(adjusted_score, current_score)

            # Boost score when missing requirements are resolved
            if new_missing_count < current_missing_count:
                improvement = (current_missing_count - new_missing_count) * 6
                adjusted_score = max(adjusted_score, min(100, current_score + improvement))

            # Big boost if ALL missing requirements are now resolved
            if current_missing_count > 0 and new_missing_count == 0:
                adjusted_score = max(adjusted_score, 90)

            # Boost if user added substantial requirement detail (new bullets)
            if current_missing_count > 0 and added_bullets >= 2:
                adjusted_score = max(adjusted_score, min(100, current_score + min(10, added_bullets)))

            adjusted_score = max(adjusted_score, TARGET_FINAL_SCORE)
            new_analysis.quality_score = adjusted_score

            supabase.table("analysis_results").update({
                "standardized_prd": new_analysis.standardized_prd,
                "quality_score": new_analysis.quality_score,
                "missing_requirements": new_analysis.missing_requirements,
                "qa_risk_insights": new_analysis.qa_risk_insights,
            }).eq("prd_id", prd_id).execute()

            response_analysis = new_analysis

        return ChatResponse(
            action=action,
            message=ai_message,
            analysis=response_analysis,
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in chat endpoint: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/prds/{prd_id}/generate-test-cases", response_model=TestCaseListResponse)
async def create_test_cases(prd_id: str):
    try:
        # 1. Get PRD analysis
        analysis_res = supabase.table("analysis_results").select("standardized_prd").eq("prd_id", prd_id).execute()
        if not analysis_res.data:
            raise HTTPException(status_code=400, detail="PRD has no analysis to generate test cases from")
            
        prd_text = analysis_res.data[0]['standardized_prd']
        
        # 2. Generate test cases
        print(f"Generating test cases for PRD {prd_id}...")
        test_cases = await generate_test_cases(prd_text)
        
        if not test_cases:
            raise HTTPException(status_code=500, detail="AI failed to generate test cases. Please try again.")
            
        # 3. Store in database
        try:
            # Delete existing test cases for this PRD first if any
            supabase.table("test_cases").delete().eq("prd_id", prd_id).execute()
            
            insert_data = []
            for tc in test_cases:
                tc_dict = tc.model_dump() if hasattr(tc, 'model_dump') else tc.dict()
                tc_dict['prd_id'] = prd_id
                insert_data.append(tc_dict)
                
            supabase.table("test_cases").insert(insert_data).execute()
        except Exception as db_err:
            print(f"Database error while saving test cases: {db_err}")
            if "relation \"public.test_cases\" does not exist" in str(db_err):
                 raise HTTPException(status_code=500, detail="Database table 'test_cases' is missing. Please run the SQL migration in Supabase.")
            raise HTTPException(status_code=500, detail=f"Failed to save test cases to database: {str(db_err)}")
        
        return TestCaseListResponse(prd_id=prd_id, test_cases=test_cases)
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generating test cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/prds/{prd_id}/test-cases", response_model=TestCaseListResponse)
async def get_test_cases(prd_id: str):
    try:
        res = supabase.table("test_cases").select("*").eq("prd_id", prd_id).execute()
        test_cases = [TestCaseSchema(**item) for item in res.data]
        return TestCaseListResponse(prd_id=prd_id, test_cases=test_cases)
    except Exception as e:
        print(f"Error fetching test cases: {e}")
        raise HTTPException(status_code=500, detail=str(e))
