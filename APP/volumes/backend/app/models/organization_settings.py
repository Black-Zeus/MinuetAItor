from __future__ import annotations

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from db.base import Base


class OrganizationSetting(Base):
    __tablename__ = "organization_settings"

    id = Column(Integer, primary_key=True)

    name = Column(String(200), nullable=True)
    legal_name = Column(String(200), nullable=True)
    tax_id = Column(String(40), nullable=True)
    description = Column(String(600), nullable=True)
    industry = Column(String(120), nullable=True)
    email = Column(String(254), nullable=True)
    phone = Column(String(30), nullable=True)
    website = Column(String(500), nullable=True)
    public_base_url = Column(String(500), nullable=True)
    address = Column(String(400), nullable=True)
    country = Column(String(120), nullable=True)
    region = Column(String(120), nullable=True)
    city = Column(String(120), nullable=True)
    postal_code = Column(String(40), nullable=True)
    contact_name = Column(String(200), nullable=True)
    contact_email = Column(String(254), nullable=True)
    contact_phone = Column(String(30), nullable=True)
    contact_position = Column(String(120), nullable=True)
    contact_department = Column(String(120), nullable=True)
    notes = Column(Text, nullable=True)
    avatar_object_id = Column(String(36), ForeignKey("objects.id"), nullable=True)
    banner_object_id = Column(String(36), ForeignKey("objects.id"), nullable=True)

    created_at = Column(DateTime, nullable=False)
    created_by = Column(String(36), ForeignKey("users.id"), nullable=True)
    updated_at = Column(DateTime, nullable=True)
    updated_by = Column(String(36), ForeignKey("users.id"), nullable=True)

    avatar_object = relationship("Object", foreign_keys=[avatar_object_id], lazy="select")
    banner_object = relationship("Object", foreign_keys=[banner_object_id], lazy="select")
    created_by_user = relationship("User", foreign_keys=[created_by], lazy="select")
    updated_by_user = relationship("User", foreign_keys=[updated_by], lazy="select")

    def __repr__(self) -> str:
        return f"<OrganizationSetting id={self.id} name={self.name!r}>"
