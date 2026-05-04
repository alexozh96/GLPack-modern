"""
PDF export service — converts report dicts to styled PDFs using fpdf2.

Layout follows the original GLPack text format (Section 6 / 11.5 of docs):
  Financial statements:
    indent      = 2 chars
    description = 45 chars (left-aligned)
    amount      = 15 chars (right-aligned, ###,###.##, negatives in parens)
    percentage  = 7 chars  (right-aligned, ##.##%)
    total line width ≈ 69

  Ledger listing:
    TRX  = 4 chars
    DATE = 5 chars (DD/MM)
    PARTICULARS = 45 chars
    DEBIT  = 13 chars (right-aligned)
    CREDIT = 13 chars (right-aligned)
    total line width ≈ 88 (fits comfortably at 8pt Courier on A4)
"""

from datetime import date, datetime
from decimal import Decimal

from fpdf import FPDF

# ── formatting helpers ────────────────────────────────────────────────────────

_SEP62 = "=" * 62
_DASH15 = "-" * 15
_EQ15 = "=" * 15
_DASH13 = "-" * 13
_EQ13 = "=" * 13
_AMT_BLANK = " " * 15
_PCT_BLANK = " " * 7

_PRINTED_ON = datetime.now().strftime("%d/%m/%y")


def _amt(v, width: int = 15, blank_zero: bool = False) -> str:
    if v is None or (blank_zero and Decimal(str(v)) == 0):
        return " " * width
    v = Decimal(str(v))
    if v < 0:
        s = f"({abs(v):,.2f})"
    else:
        s = f"{v:,.2f}"
    return s.rjust(width)


def _pct(v, width: int = 7) -> str:
    if v is None:
        return " " * width
    return f"{Decimal(str(v)):.2f}%".rjust(width)


def _fs_line(desc: str, amount=None, pct=None, blank_zero: bool = False) -> str:
    """Single financial statement line: 2-indent + 45-desc + 15-amt + 7-pct."""
    return f"  {desc:<45}{_amt(amount, blank_zero=blank_zero)}{_pct(pct)}"


def _fs_sep(double: bool = False) -> str:
    """Separator under amount column (47 spaces + 15 dashes/equals)."""
    fill = _EQ15 if double else _DASH15
    return f"  {' ' * 45}{fill}"


def _ldg_line(trx: str, dt: date, particular: str, dr, cr) -> str:
    """Ledger detail line."""
    date_str = dt.strftime("%d/%m") if dt else "     "
    return (
        f" {trx or '':>4}  {date_str:<5}  {particular[:45]:<45}"
        f"  {_amt(dr, 13, blank_zero=True)}  {_amt(cr, 13, blank_zero=True)}"
    )


def _fs_header(company_name: str, title: str, subtitle: str) -> list[str]:
    company = (company_name or "").upper()
    header = f"  {company:<42}PRINTED ON {_PRINTED_ON}"
    return [
        header,
        f"  {title}",
        f"  {subtitle}",
        f"  {_SEP62}",
        "",
    ]


def _period_subtitle(label: str, period_start: date, period_end: date) -> str:
    end_str = period_end.strftime("%d %b %Y").upper()
    return f"{label} {end_str}"


# ── report text renderers ─────────────────────────────────────────────────────

def render_trial_balance(data: dict, company_name: str) -> list[str]:
    ps: date = data["period_start"]
    pe: date = data["period_end"]
    subtitle = _period_subtitle("FOR THE PERIOD ENDED", ps, pe)
    lines = _fs_header(company_name, "TRIAL BALANCE", subtitle)

    lines.append(f"  {'CODE':<6}{'ACCOUNT':<39}{'DEBIT':>15}{'CREDIT':>15}")
    lines.append(f"  {'-' * 62}")

    total_dr = Decimal("0")
    total_cr = Decimal("0")
    for a in data["accounts"]:
        dr = Decimal(str(a["total_dr"]))
        cr = Decimal(str(a["total_cr"]))
        total_dr += dr
        total_cr += cr
        lines.append(
            f"  {a['code']:<6}{a['name']:<39}{_amt(dr, 15, blank_zero=True)}{_amt(cr, 15, blank_zero=True)}"
        )

    lines.append(f"  {'-' * 62}")
    lines.append(f"  {'TOTAL':<45}{_amt(total_dr)}{_amt(total_cr)}")
    lines.append(f"  {'':>45}{_EQ15}{_EQ15}")
    lines.append("")
    lines.append("* ACCOUNT PREPARED USING GLPACK SOFTWARE")
    return lines


def render_expense_schedule(data: dict, company_name: str) -> list[str]:
    ps: date = data["period_start"]
    pe: date = data["period_end"]
    subtitle = _period_subtitle("FOR THE YEAR ENDED", ps, pe)
    lines = _fs_header(company_name, "SCHEDULE OF EXPENSES", subtitle)

    lines.append(f"  {'':45}{'S$':>15}")
    lines.append("")

    for item in data["items"]:
        lines.append(_fs_line(item["name"], item["amount"], item.get("pct_of_sales")))

    lines.append("")
    lines.append(_fs_sep(double=False))
    lines.append(_fs_line("", data["total"], data.get("total_pct")))
    lines.append(_fs_sep(double=False))
    lines.append("")
    lines.append("* ACCOUNT PREPARED USING GLPACK SOFTWARE")
    return lines


def render_profit_loss(data: dict, company_name: str) -> list[str]:
    ps: date = data["period_start"]
    pe: date = data["period_end"]
    subtitle = _period_subtitle("FOR THE YEAR ENDED", ps, pe)
    lines = _fs_header(company_name, "PROFIT AND LOSS ACCOUNT", subtitle)

    lines.append(f"  {'':45}{'S$':>15}")
    lines.append("")

    # Revenue
    for r in data["revenue_lines"]:
        lines.append(_fs_line(r["name"], r["amount"], r.get("pct_of_revenue")))
    lines.append(_fs_sep())
    lines.append(_fs_line("", data["total_revenue"], "100.00"))
    lines.append(_fs_sep())
    lines.append("")

    # Cost of sales
    if data["cost_of_sales_lines"]:
        lines.append(_fs_line("LESS COST OF SALES"))
        for r in data["cost_of_sales_lines"]:
            lines.append(_fs_line(r["name"], r["amount"], r.get("pct_of_revenue")))
        lines.append(_fs_sep())
        lines.append(_fs_line("", data["total_cost_of_sales"],
                               _pct_val(data["total_cost_of_sales"], data["total_revenue"])))
        lines.append("")

    lines.append(_fs_line("GROSS PROFIT", data["gross_profit"],
                           _pct_val(data["gross_profit"], data["total_revenue"])))
    lines.append(_fs_sep())

    lines.append(_fs_line("OTHER INCOME", data["other_income"],
                           _pct_val(data["other_income"], data["total_revenue"])))
    lines.append("")
    lines.append(_fs_line("TOTAL REVENUE", data["total_gross_revenue"],
                           _pct_val(data["total_gross_revenue"], data["total_revenue"])))
    lines.append(_fs_line("LESS EXPENSES (ATTACHED SCHEDULE)", data["total_expenses"],
                           _pct_val(data["total_expenses"], data["total_revenue"])))
    lines.append(_fs_sep())

    lines.append(_fs_line("PROFIT/(LOSS) FOR THE PERIOD BEFORE TAXATION",
                           data["profit_before_tax"],
                           _pct_val(data["profit_before_tax"], data["total_revenue"])))
    lines.append(_fs_line("LESS TAXATION", data["taxation"],
                           _pct_val(data["taxation"], data["total_revenue"])))
    lines.append(_fs_sep())

    lines.append(_fs_line("PROFIT/(LOSS) AFTER TAXATION", data["profit_after_tax"],
                           _pct_val(data["profit_after_tax"], data["total_revenue"])))
    lines.append(_fs_line("PROFIT AND LOSS A/C BROUGHT FORWARD", data["pl_brought_forward"]))
    lines.append(_fs_sep())
    lines.append(_fs_line("PROFIT AND LOSS CARRIED FORWARD", data["pl_carried_forward"]))
    lines.append(_fs_sep(double=True))
    lines.append("")
    lines.append("* ACCOUNT PREPARED USING GLPACK SOFTWARE")
    return lines


def render_balance_sheet(data: dict, company_name: str) -> list[str]:
    pe: date = data["period_end"]
    subtitle = f"AS AT {pe.strftime('%d %b %Y').upper()}"
    lines = _fs_header(company_name, "BALANCE SHEET", subtitle)

    lines.append(f"  {'':45}{'S$':>15}")
    lines.append("")

    # Equity
    lines.append(_fs_line("SHARE CAPITAL", data["share_capital"]))
    lines.append(_fs_line("PROFIT AND LOSS ACCOUNT", data["profit_loss_account"]))
    lines.append(_fs_sep())
    lines.append(_fs_line("", data["total_equity"]))
    lines.append(_fs_sep(double=True))
    lines.append("")
    lines.append(f"  {'Represented by':>47}")
    lines.append("")

    # Current assets
    lines.append(_fs_line("CURRENT ASSETS"))
    for a in data["current_assets"]:
        lines.append(_fs_line(a["name"], a["amount"], blank_zero=True))
    lines.append(_fs_sep())
    lines.append(_fs_line("", data["total_current_assets"]))
    lines.append(_fs_sep())

    # Current liabilities
    lines.append(_fs_line("LESS CURRENT LIABILITIES"))
    for a in data["current_liabilities"]:
        lines.append(_fs_line(a["name"], a["amount"], blank_zero=True))
    lines.append(_fs_sep())
    lines.append(_fs_line("", data["total_current_liabilities"]))
    lines.append(_fs_sep())
    lines.append("")
    lines.append(_fs_line("NET CURRENT ASSETS/(LIABILITIES)", data["net_current_assets"]))
    lines.append(_fs_sep())

    # Fixed assets
    if data["fixed_assets"]:
        lines.append("")
        lines.append(_fs_line("FIXED ASSETS"))
        for a in data["fixed_assets"]:
            lines.append(_fs_line(a["name"], a["amount"], blank_zero=True))
        lines.append(_fs_sep())
        lines.append(_fs_line("", data["total_fixed_assets"]))
        lines.append(_fs_sep())

    lines.append("")
    lines.append(_fs_line("", data["total_net_assets"]))
    lines.append(_fs_sep(double=True))
    lines.append("")
    lines.append("* ACCOUNT PREPARED USING GLPACK SOFTWARE")
    return lines


def render_ledger_account(data: dict, company_name: str) -> list[str]:
    ps: date = data["period_start"]
    pe: date = data["period_end"]
    company = (company_name or "").upper()
    printed = f"PRINTED ON {_PRINTED_ON}"
    period_label = f"{ps.strftime('%b %Y').upper()} - {pe.strftime('%b %Y').upper()}"

    lines = [
        f" {company:<42}{printed}",
        f" LEDGER ACCOUNT: {data['code']} {data['name']}",
        f" TRX  DATE   {'PARTICULARS':<45}  {'DEBIT':>13}  {'CREDIT':>13}",
        f" {'-' * 85}",
    ]

    ob = Decimal(str(data["opening_balance"]))
    if ob != 0:
        ob_dr = ob if ob > 0 else Decimal("0")
        ob_cr = -ob if ob < 0 else Decimal("0")
        lines.append(_ldg_line("", ps, "BALANCE BROUGHT DOWN", ob_dr, ob_cr))

    for ln in data["lines"]:
        lines.append(_ldg_line(
            ln["trx_no"], ln["date"], ln["particular"],
            Decimal(str(ln["dr_amount"])),
            Decimal(str(ln["cr_amount"])),
        ))

    # Closing balance
    cb = Decimal(str(data["closing_balance"]))
    if cb != 0:
        cb_dr = Decimal("0")
        cb_cr = cb if cb > 0 else -cb
        lines.append(f" {'':4}  {'':5}  {'BALANCE CARRIED DOWN':<45}  {_amt(cb_dr, 13, blank_zero=True)}  {_amt(cb_cr, 13, blank_zero=True)}")

    lines += [
        f" {'':4}  {'':5}  {'':45}  {_DASH13}  {_DASH13}",
        f" {'':4}  {'':5}  {'':45}  {_amt(data['total_dr'], 13)}  {_amt(data['total_cr'], 13)}",
        f" {'':4}  {'':5}  {'':45}  {_EQ13}  {_EQ13}",
        "",
        "* ACCOUNT PREPARED USING GLPACK SOFTWARE",
    ]
    return lines


def render_debtors_listing(data: dict, company_name: str) -> list[str]:
    pe: date = data["period_end"]
    subtitle = f"AS AT {pe.strftime('%d %b %Y').upper()}"
    lines = _fs_header(company_name, "TRADE DEBTORS LISTING", subtitle)
    lines.append(f"  {'':45}{'S$':>15}")
    lines.append("")
    for item in data["items"]:
        lines.append(_fs_line(item["name"], item["amount"], blank_zero=True))
    lines.append(_fs_sep())
    lines.append(_fs_line("TOTAL TRADE DEBTORS", data["total"]))
    lines.append(_fs_sep(double=True))
    lines.append("")
    lines.append("* ACCOUNT PREPARED USING GLPACK SOFTWARE")
    return lines


def render_creditors_listing(data: dict, company_name: str) -> list[str]:
    pe: date = data["period_end"]
    subtitle = f"AS AT {pe.strftime('%d %b %Y').upper()}"
    lines = _fs_header(company_name, "TRADE CREDITORS LISTING", subtitle)
    lines.append(f"  {'':45}{'S$':>15}")
    lines.append("")
    for item in data["items"]:
        lines.append(_fs_line(item["name"], item["amount"], blank_zero=True))
    lines.append(_fs_sep())
    lines.append(_fs_line("TOTAL TRADE CREDITORS", data["total"]))
    lines.append(_fs_sep(double=True))
    lines.append("")
    lines.append("* ACCOUNT PREPARED USING GLPACK SOFTWARE")
    return lines


def render_fixed_assets(data: dict, company_name: str) -> list[str]:
    pe: date = data["period_end"]
    subtitle = f"AS AT {pe.strftime('%d %b %Y').upper()}"
    lines = _fs_header(company_name, "FIXED ASSETS SCHEDULE", subtitle)

    # Header row
    lines.append(
        f"  {'ACCOUNT':<6}{'NAME':<39}{'COST':>15}{'ACCM-DEPN':>15}{'NBV':>15}"
    )
    lines.append(f"  {'-' * 90}")

    for item in data["items"]:
        lines.append(
            f"  {item['code']:<6}{item['name']:<39}"
            f"{_amt(item['cost'], 15, blank_zero=True)}"
            f"{_amt(item['accum_depn'], 15, blank_zero=True)}"
            f"{_amt(item['nbv'], 15, blank_zero=True)}"
        )

    lines.append(f"  {'-' * 90}")
    lines.append(
        f"  {'TOTAL':<45}"
        f"{_amt(data['total_cost'], 15)}"
        f"{_amt(data['total_accum_depn'], 15)}"
        f"{_amt(data['total_nbv'], 15)}"
    )
    lines.append(f"  {'':>45}{'=' * 15}{'=' * 15}{'=' * 15}")
    lines.append("")
    lines.append("* ACCOUNT PREPARED USING GLPACK SOFTWARE")
    return lines


# ── PDF builder ───────────────────────────────────────────────────────────────

def lines_to_pdf(pages: list[list[str]], font_size: float = 8.5) -> bytes:
    """Convert a list of page-line-lists into a monospace PDF."""
    pdf = FPDF()
    pdf.set_margins(12, 12, 12)
    pdf.set_auto_page_break(auto=True, margin=15)

    for page_lines in pages:
        pdf.add_page()
        pdf.set_font("Courier", size=font_size)
        line_height = font_size * 0.45  # mm, tight leading for mono text
        for line in page_lines:
            # fpdf2 cell: width 0 = full usable width
            pdf.cell(0, line_height, text=line, new_x="LMARGIN", new_y="NEXT")

    return bytes(pdf.output())


# ── convenience: render + build in one call ───────────────────────────────────

_RENDERERS = {
    "trial-balance": render_trial_balance,
    "expense-schedule": render_expense_schedule,
    "profit-loss": render_profit_loss,
    "balance-sheet": render_balance_sheet,
    "debtors-listing": render_debtors_listing,
    "creditors-listing": render_creditors_listing,
    "fixed-assets": render_fixed_assets,
}


def build_single_pdf(report_key: str, data: dict, company_name: str) -> bytes:
    renderer = _RENDERERS[report_key]
    return lines_to_pdf([renderer(data, company_name)])


def build_full_statements_pdf(
    expense_schedule: dict,
    profit_loss: dict,
    balance_sheet: dict,
    debtors: dict,
    creditors: dict,
    fixed_assets: dict,
    company_name: str,
) -> bytes:
    """Bundle all financial statement reports into one PDF, one report per page."""
    pages = [
        render_expense_schedule(expense_schedule, company_name),
        render_profit_loss(profit_loss, company_name),
        render_balance_sheet(balance_sheet, company_name),
        render_debtors_listing(debtors, company_name),
        render_creditors_listing(creditors, company_name),
        render_fixed_assets(fixed_assets, company_name),
    ]
    return lines_to_pdf(pages)


# ── helpers ───────────────────────────────────────────────────────────────────

def _pct_val(part, whole) -> str | None:
    """Compute percentage string for use in _fs_line pct arg."""
    try:
        p = Decimal(str(part))
        w = Decimal(str(whole))
        if w == 0:
            return None
        return str((p / w * 100).quantize(Decimal("0.01")))
    except Exception:
        return None
