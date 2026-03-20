from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models.models import Vendor
from app.schemas import VendorCreate, VendorUpdate, VendorOut

router = APIRouter(prefix="/api/vendors", tags=["vendors"])


@router.get("", response_model=list[VendorOut])
def list_vendors(db: Session = Depends(get_db)):
    return db.query(Vendor).all()


@router.get("/{vendor_id}", response_model=VendorOut)
def get_vendor(vendor_id: str, db: Session = Depends(get_db)):
    v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    return v


@router.post("", response_model=VendorOut)
def create_vendor(data: VendorCreate, db: Session = Depends(get_db)):
    v = Vendor(**data.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.put("/{vendor_id}", response_model=VendorOut)
def update_vendor(vendor_id: str, data: VendorUpdate, db: Session = Depends(get_db)):
    v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    for k, val in data.model_dump().items():
        setattr(v, k, val)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/{vendor_id}")
def delete_vendor(vendor_id: str, db: Session = Depends(get_db)):
    v = db.query(Vendor).filter(Vendor.id == vendor_id).first()
    if not v:
        raise HTTPException(404, "Vendor not found")
    db.delete(v)
    db.commit()
    return {"ok": True}
