from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Workstream
from app.schemas import WorkstreamCreate, WorkstreamOut

router = APIRouter(prefix="/api/workstreams", tags=["workstreams"])


@router.get("", response_model=list[WorkstreamOut])
def list_workstreams(contract_id: str | None = None, db: Session = Depends(get_db)):
    q = db.query(Workstream)
    if contract_id:
        q = q.filter(Workstream.contract_id == contract_id)
    return q.all()


@router.post("", response_model=WorkstreamOut)
def create_workstream(data: WorkstreamCreate, db: Session = Depends(get_db)):
    w = Workstream(**data.model_dump())
    db.add(w)
    db.commit()
    db.refresh(w)
    return w


@router.delete("/{ws_id}")
def delete_workstream(ws_id: str, db: Session = Depends(get_db)):
    w = db.query(Workstream).filter(Workstream.id == ws_id).first()
    if not w:
        raise HTTPException(404, "Workstream not found")
    db.delete(w)
    db.commit()
    return {"ok": True}
