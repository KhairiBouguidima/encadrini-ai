from app.models.evaluation import Evaluation
from app.schemas.evaluation import EvaluationCreate, EvaluationResponse
from app.api.v1.endpoints.evaluations import router as er
from app.models.annotation import Annotation
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate, AnnotationResponse
from app.api.v1.endpoints.annotations import router as ar
print("ALL BACKEND IMPORTS OK")
