from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field


class ReportFilterItem(BaseModel):
    label: str
    value: str | None = None


class ReportSummaryMetricItem(BaseModel):
    label: str
    value: str
    helper: str | None = None


class ReportTrendPoint(BaseModel):
    label: str
    total: int = 0
    completed: int = 0


class ReportDistributionPoint(BaseModel):
    label: str
    count: int = 0


class ReportChartData(BaseModel):
    period_trend: list[ReportTrendPoint] = Field(default_factory=list)
    status_distribution: list[ReportDistributionPoint] = Field(default_factory=list)
    client_activity: list[ReportDistributionPoint] = Field(default_factory=list)
    project_activity: list[ReportDistributionPoint] = Field(default_factory=list)


class ReportChartImageItem(BaseModel):
    title: str
    subtitle: str | None = None
    image_data_url: str


class ReportTableColumn(BaseModel):
    key: str
    label: str


class ReportPdfPreviewRequest(BaseModel):
    template_key: str = "executive_summary_general"
    report_key: str = "report"
    report_type: str = "Reporte"
    report_title: str
    report_description: str
    report_objective: str
    source_module: str = "Módulo de Reportes"
    organization_name: str | None = None
    organization_area: str | None = None
    orientation: Literal["portrait", "landscape"] = "landscape"
    paper_size: Literal["A4", "LETTER", "LEGAL"] = "A4"
    applied_filters: list[ReportFilterItem] = Field(default_factory=list)
    summary_metrics: list[ReportSummaryMetricItem] = Field(default_factory=list)
    chart_data: ReportChartData = Field(default_factory=ReportChartData)
    chart_images: list[ReportChartImageItem] = Field(default_factory=list)
    table_title: str = "Detalle de resultados"
    table_description: str = "Tabla consolidada de registros visibles para el reporte generado."
    table_range_label: str | None = None
    table_columns: list[ReportTableColumn] = Field(default_factory=list)
    table_rows: list[dict[str, Any]] = Field(default_factory=list)
