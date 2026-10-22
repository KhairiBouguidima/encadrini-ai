import os, sys
sys.path.insert(0, os.path.abspath('.'))

from app.models.evaluation import Evaluation, ApprovalStatus
from app.schemas.evaluation import EvaluationCreate, EvaluationResponse
from app.api.v1.endpoints.evaluations import router
from app.api.v1.endpoints.annotations import router as ar
print('BACKEND CHECKS OK')
