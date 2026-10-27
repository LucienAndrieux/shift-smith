"""Solver HTTP API: POST /solve with the contract in README.md."""

from fastapi import FastAPI

from .model import solve
from .schemas import SolveRequest, SolveResponse

app = FastAPI(title="ShiftSmith solver", version="1.0.0")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/solve", response_model=SolveResponse, response_model_by_alias=True)
def solve_endpoint(request: SolveRequest) -> SolveResponse:
    # Sync handler: FastAPI runs it in a worker thread, CP-SAT uses its own threads.
    return solve(request)
