"""Re-export shared report renderer (gcp/common/report)."""

from common.report.renderer import (  # noqa: F401
    html_to_pdf_bytes,
    render_report_html,
)
