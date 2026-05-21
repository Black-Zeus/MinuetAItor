from __future__ import annotations

from pydantic import BaseModel, Field


class UserRefResponse(BaseModel):
    id: str
    username: str | None = None
    full_name: str | None = Field(None, serialization_alias="fullName")

    model_config = {"populate_by_name": True}


class OrganizationSettingsRequest(BaseModel):
    name: str | None = Field(None, max_length=200)
    legal_name: str | None = Field(None, max_length=200, alias="legalName")
    tax_id: str | None = Field(None, max_length=40, alias="taxId")
    description: str | None = Field(None, max_length=600)
    industry: str | None = Field(None, max_length=120)
    email: str | None = Field(None, max_length=254)
    phone: str | None = Field(None, max_length=30)
    website: str | None = Field(None, max_length=500)
    address: str | None = Field(None, max_length=400)
    country: str | None = Field(None, max_length=120)
    region: str | None = Field(None, max_length=120)
    city: str | None = Field(None, max_length=120)
    postal_code: str | None = Field(None, max_length=40, alias="postalCode")
    contact_name: str | None = Field(None, max_length=200, alias="contactName")
    contact_email: str | None = Field(None, max_length=254, alias="contactEmail")
    contact_phone: str | None = Field(None, max_length=30, alias="contactPhone")
    contact_position: str | None = Field(None, max_length=120, alias="contactPosition")
    contact_department: str | None = Field(None, max_length=120, alias="contactDepartment")
    notes: str | None = None

    model_config = {"populate_by_name": True}


class OrganizationSettingsResponse(BaseModel):
    id: int
    name: str | None = None
    logo_url: str | None = Field(None, serialization_alias="logoUrl")
    banner_url: str | None = Field(None, serialization_alias="bannerUrl")
    legal_name: str | None = Field(None, serialization_alias="legalName")
    tax_id: str | None = Field(None, serialization_alias="taxId")
    description: str | None = None
    industry: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    address: str | None = None
    country: str | None = None
    region: str | None = None
    city: str | None = None
    postal_code: str | None = Field(None, serialization_alias="postalCode")
    contact_name: str | None = Field(None, serialization_alias="contactName")
    contact_email: str | None = Field(None, serialization_alias="contactEmail")
    contact_phone: str | None = Field(None, serialization_alias="contactPhone")
    contact_position: str | None = Field(None, serialization_alias="contactPosition")
    contact_department: str | None = Field(None, serialization_alias="contactDepartment")
    notes: str | None = None
    created_at: str | None = Field(None, serialization_alias="createdAt")
    updated_at: str | None = Field(None, serialization_alias="updatedAt")
    created_by: UserRefResponse | None = Field(None, serialization_alias="createdBy")
    updated_by: UserRefResponse | None = Field(None, serialization_alias="updatedBy")

    model_config = {"populate_by_name": True}
