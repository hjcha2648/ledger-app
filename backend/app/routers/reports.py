"""월간 명세서 메일 (Amazon SES, PLAN.md 기능 2)

로그인한 사용자 본인 주소로만, 선택 월의 요약·카테고리별 지출·최근 6개월·거래 내역·정기결제를 명세서 형태로 보낸다.
받는 주소는 요청으로 바꿀 수 없다 (JWT 사용자 이메일 고정). 메일 내용은 DB·로그에 남기지 않는다.

SES 샌드박스에서는 받는 주소도 SES 인증이 필요하므로, 페이지에서 본인 주소 인증 메일을 요청할 수 있게 한다
(email-status / email-verification). SES 자격 증명 삭제 기능은 두지 않는다 (발신 도메인 보호).
"""

import logging
import threading
import time
from email.utils import formataddr
from html import escape

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.deps import get_current_user
from app.models import Category, Subscription, Transaction, User
from app.routers.dashboard import _shift_month, get_dashboard
from app.schemas.report import EmailStatusResponse, MonthlyEmailRequest, MonthlyEmailResponse
from app.utils import parse_month

logger = logging.getLogger("ledger")

router = APIRouter(prefix="/api/reports", tags=["reports"])

MAX_TRANSACTIONS = 200
SENDER_NAME = "가계부"
UNAVAILABLE = "지금은 메일을 보낼 수 없습니다. 잠시 후 다시 시도하세요."
NEEDS_VERIFICATION = "받는 메일 주소 인증이 필요합니다. 메일 인증을 먼저 완료하세요."
CYCLE_LABEL = {"WEEKLY": "매주", "MONTHLY": "매월", "YEARLY": "매년"}

# 사용자별 마지막 발송 시각 (단일 uvicorn 프로세스 기준)
_last_sent: dict[int, float] = {}
_last_sent_lock = threading.Lock()


def _reserve_slot(user_id: int) -> None:
    now = time.monotonic()
    with _last_sent_lock:
        last = _last_sent.get(user_id)
        if last is not None and now - last < settings.email_cooldown_seconds:
            wait_min = max(1, round((settings.email_cooldown_seconds - (now - last)) / 60))
            raise HTTPException(
                status.HTTP_429_TOO_MANY_REQUESTS, detail=f"명세서 메일은 {wait_min}분 뒤에 다시 보낼 수 있습니다."
            )
        _last_sent[user_id] = now


def _release_slot(user_id: int) -> None:
    with _last_sent_lock:
        _last_sent.pop(user_id, None)


def mask_email(email: str) -> str:
    local, _, domain = email.partition("@")
    return f"{local[:1]}***@{domain}"


def _won(n: int) -> str:
    return f"{n:,}원"


def _signed_won(n: int) -> str:
    return f"+{n:,}원" if n > 0 else f"{n:,}원" if n < 0 else "0원"


def _month_label(month: str) -> str:
    return f"{int(month[:4])}년 {int(month[5:])}월"


def _collect(db: Session, user: User, month: str) -> dict:
    """선택 월 명세서 데이터 (user_id 조건으로만 조회)"""
    start, end = parse_month(month)
    prev = _shift_month(start, -1)
    prev_month = f"{prev.year:04d}-{prev.month:02d}"
    dash = get_dashboard(month=month, db=db, current_user=user)
    prev_dash = get_dashboard(month=prev_month, db=db, current_user=user)
    txs = db.execute(
        select(Transaction, Category.name)
        .join(Category, Transaction.category_id == Category.id)
        .where(Transaction.user_id == user.id, Transaction.occurred_on >= start, Transaction.occurred_on < end)
        .order_by(Transaction.occurred_on, Transaction.id)
    ).all()
    subs = db.execute(
        select(Subscription, Category.name)
        .join(Category, Subscription.category_id == Category.id)
        .where(Subscription.user_id == user.id)
        .order_by(Subscription.id)
    ).all()
    return {"month": month, "prev_month": prev_month, "dash": dash, "prev": prev_dash, "txs": txs, "subs": subs}


def _category_rows(data: dict) -> list[tuple[str, int, int, int | None]]:
    """(이름, 이번 달, 비율 %, 지난달 대비 증감 — 지난달에 없으면 None)"""
    total = data["dash"].summary.expense_krw or 1
    prev = {c.name: c.amount_krw for c in data["prev"].expense_by_category}
    return [
        (c.name, c.amount_krw, round(c.amount_krw * 100 / total), c.amount_krw - prev[c.name] if c.name in prev else None)
        for c in data["dash"].expense_by_category
    ]


def render_text(data: dict) -> str:
    s = data["dash"].summary
    lines = [
        f"{_month_label(data['month'])} 가계부 명세서",
        "",
        f"수입 {_won(s.income_krw)} / 지출 {_won(s.expense_krw)} / 잔액 {_won(s.balance_krw)}",
        "",
        "[카테고리별 지출]",
        *(
            f"- {name}: {_won(amount)} ({pct}%, 지난달 대비 {'신규' if diff is None else _signed_won(diff)})"
            for name, amount, pct, diff in _category_rows(data)
        ),
        "",
        "[최근 6개월]",
        *(f"- {m.month}: 수입 {_won(m.income_krw)}, 지출 {_won(m.expense_krw)}" for m in data["dash"].monthly_compare),
        "",
        f"[거래 내역 {len(data['txs'])}건]",
        *(
            f"- {t.occurred_on} {'수입' if t.type == 'INCOME' else '지출'} {name} {_won(t.amount_krw)} {t.merchant or ''}".rstrip()
            for t, name in data["txs"][:MAX_TRANSACTIONS]
        ),
        "",
        "[등록된 정기결제] (거래 합계에는 포함되지 않음)",
        *(f"- {sub.name}: {CYCLE_LABEL.get(sub.billing_cycle, sub.billing_cycle)} {_won(sub.amount_krw)}" for sub, _ in data["subs"]),
        "",
        "이 메일은 가계부 앱에서 직접 요청한 명세서입니다.",
    ]
    return "\n".join(lines)


# 메일 클라이언트 호환을 위해 표 + 인라인 스타일만 쓴다 (외부 이미지·스크립트·<style> 없음)
_TD = 'style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:14px;color:#1f2937"'
_TD_R = 'style="padding:8px 10px;border-bottom:1px solid #eef0f3;font-size:14px;color:#1f2937;text-align:right;white-space:nowrap"'
_TH = 'style="padding:8px 10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:left;font-weight:600"'
_TH_R = 'style="padding:8px 10px;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;text-align:right;font-weight:600"'
_H2 = 'style="margin:28px 0 8px;font-size:16px;color:#111827"'


def _card(label: str, value: str, color: str) -> str:
    return (
        f'<td style="width:33%;padding:12px;background:#f9fafb;border-radius:8px">'
        f'<div style="font-size:12px;color:#6b7280">{label}</div>'
        f'<div style="margin-top:4px;font-size:18px;font-weight:700;color:{color}">{value}</div></td>'
    )


def render_html(data: dict) -> str:
    e = escape  # 카테고리·사용처·정기결제 이름은 사용자가 입력한 값이므로 반드시 이스케이프
    s = data["dash"].summary
    label = _month_label(data["month"])

    cat_rows = "".join(
        f"<tr><td {_TD}>{e(name)}"
        f'<div style="margin-top:4px;height:6px;background:#eef0f3;border-radius:3px">'
        f'<div style="width:{pct}%;height:6px;background:#6366f1;border-radius:3px"></div></div></td>'
        f"<td {_TD_R}>{_won(amount)}</td><td {_TD_R}>{pct}%</td>"
        f"<td {_TD_R}>{'신규' if diff is None else _signed_won(diff)}</td></tr>"
        for name, amount, pct, diff in _category_rows(data)
    ) or f'<tr><td {_TD} colspan="4">이 달 지출이 없습니다.</td></tr>'

    month_rows = "".join(
        f"<tr><td {_TD}>{m.month}</td><td {_TD_R}>{_won(m.income_krw)}</td><td {_TD_R}>{_won(m.expense_krw)}</td></tr>"
        for m in data["dash"].monthly_compare
    )

    shown = data["txs"][:MAX_TRANSACTIONS]
    tx_rows = "".join(
        f"<tr><td {_TD}>{t.occurred_on.month}/{t.occurred_on.day}</td><td {_TD}>{e(name)}</td>"
        f"<td {_TD}>{e(t.merchant or '')}</td>"
        f'<td {_TD_R}><span style="color:{"#059669" if t.type == "INCOME" else "#dc2626"}">'
        f"{'+' if t.type == 'INCOME' else '-'}{_won(t.amount_krw)}</span></td></tr>"
        for t, name in shown
    ) or f'<tr><td {_TD} colspan="4">이 달 거래가 없습니다.</td></tr>'
    more = (
        f'<p style="font-size:12px;color:#6b7280">거래가 많아 앞의 {MAX_TRANSACTIONS}건만 표시했습니다.</p>'
        if len(data["txs"]) > MAX_TRANSACTIONS
        else ""
    )

    sub_rows = "".join(
        f"<tr><td {_TD}>{e(sub.name)}</td><td {_TD}>{e(name)}</td>"
        f"<td {_TD_R}>{CYCLE_LABEL.get(sub.billing_cycle, e(sub.billing_cycle))} {_won(sub.amount_krw)}</td></tr>"
        for sub, name in data["subs"]
    ) or f'<tr><td {_TD} colspan="3">등록된 정기결제가 없습니다.</td></tr>'

    balance_color = "#111827" if s.balance_krw >= 0 else "#dc2626"
    return f"""<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>{label} 가계부 명세서</title></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,'Apple SD Gothic Neo','Malgun Gothic',sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:12px;padding:28px 24px">
<tr><td>
  <div style="font-size:13px;color:#6366f1;font-weight:600">가계부 명세서</div>
  <h1 style="margin:4px 0 20px;font-size:22px;color:#111827">{label}</h1>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="6"><tr>
    {_card("수입", _won(s.income_krw), "#059669")}{_card("지출", _won(s.expense_krw), "#dc2626")}{_card("잔액", _won(s.balance_krw), balance_color)}
  </tr></table>

  <h2 {_H2}>카테고리별 지출</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><th {_TH}>카테고리</th><th {_TH_R}>금액</th><th {_TH_R}>비율</th><th {_TH_R}>지난달 대비</th></tr>{cat_rows}
  </table>

  <h2 {_H2}>최근 6개월</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><th {_TH}>월</th><th {_TH_R}>수입</th><th {_TH_R}>지출</th></tr>{month_rows}
  </table>

  <h2 {_H2}>거래 내역 ({len(data["txs"])}건)</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><th {_TH}>날짜</th><th {_TH}>카테고리</th><th {_TH}>사용처</th><th {_TH_R}>금액</th></tr>{tx_rows}
  </table>{more}

  <h2 {_H2}>등록된 정기결제</h2>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><th {_TH}>이름</th><th {_TH}>카테고리</th><th {_TH_R}>금액</th></tr>{sub_rows}
  </table>
  <p style="margin:8px 0 0;font-size:12px;color:#6b7280">정기결제 금액은 위 수입·지출 합계에 포함되지 않습니다.</p>

  <p style="margin:28px 0 0;padding-top:16px;border-top:1px solid #eef0f3;font-size:12px;color:#9ca3af">
    이 메일은 가계부 앱에서 직접 요청한 명세서입니다. 요청하지 않았다면 이 메일을 무시하세요.</p>
</td></tr></table>
</td></tr></table>
</body></html>"""


def _ses():
    # boto3는 첫 호출 때 불러온다. 자격 증명은 환경(로컬 aws login 프로필, EC2 IAM 역할)에서 찾는다.
    import boto3

    return boto3.client("sesv2", region_name=settings.ses_region)


def _error_code(e: Exception) -> str | None:
    """botocore ClientError의 오류 코드 (예: MessageRejected, NotFoundException)"""
    response = getattr(e, "response", None)
    return response.get("Error", {}).get("Code") if isinstance(response, dict) else None


def _send(to: str, subject: str, text: str, html: str) -> None:
    _ses().send_email(
        FromEmailAddress=formataddr((SENDER_NAME, settings.ses_sender), charset="utf-8"),
        Destination={"ToAddresses": [to]},
        Content={
            "Simple": {
                "Subject": {"Data": subject, "Charset": "UTF-8"},
                "Body": {"Text": {"Data": text, "Charset": "UTF-8"}, "Html": {"Data": html, "Charset": "UTF-8"}},
            }
        },
    )


def _recipient_status(email: str) -> str:
    """받는 주소 상태: verified(받을 수 있음) / pending(인증 메일 링크 대기) / unverified(인증 요청 전)

    SES 샌드박스에서는 받는 주소도 SES에 인증돼 있어야 한다. 프로덕션 접근이 승인되면 인증 없이 모두 verified.
    """
    client = _ses()
    if client.get_account().get("ProductionAccessEnabled"):
        return "verified"
    domain = email.rpartition("@")[2]
    for identity in (email, domain):  # 주소 자체 또는 주소의 도메인이 인증돼 있으면 받을 수 있다
        try:
            info = client.get_email_identity(EmailIdentity=identity)
        except Exception as e:
            if _error_code(e) == "NotFoundException":
                continue
            raise
        if info.get("VerifiedForSendingStatus"):
            return "verified"
        if identity == email:
            return "pending"
    return "unverified"


def _require_enabled() -> None:
    if not settings.email_enabled or not settings.ses_sender:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE)


# 인증 메일 요청은 사용자별 1분에 1번 (AWS가 보내는 메일이라 남용 방지)
_verify_requested: dict[int, float] = {}
_verify_lock = threading.Lock()
VERIFY_COOLDOWN_SECONDS = 60


@router.get("/email-status", response_model=EmailStatusResponse)
def get_email_status(current_user: User = Depends(get_current_user)):
    _require_enabled()
    try:
        state = _recipient_status(current_user.email)
    except Exception as e:
        logger.error("SES status failed: user_id=%s error=%s code=%s", current_user.id, type(e).__name__, _error_code(e))
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE)
    return EmailStatusResponse(email=mask_email(current_user.email), status=state)


@router.post("/email-verification", response_model=EmailStatusResponse)
def request_email_verification(response: Response, current_user: User = Depends(get_current_user)):
    """본인 주소를 SES에 등록해 AWS 인증 메일을 보낸다. 이미 인증됐거나 대기 중이면 메일을 다시 보내지 않는다."""
    _require_enabled()
    masked = mask_email(current_user.email)
    try:
        state = _recipient_status(current_user.email)
        if state != "unverified":
            return EmailStatusResponse(email=masked, status=state)
        now = time.monotonic()
        with _verify_lock:
            last = _verify_requested.get(current_user.id)
            if last is not None and now - last < VERIFY_COOLDOWN_SECONDS:
                raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, detail="잠시 후 다시 시도하세요.")
            _verify_requested[current_user.id] = now
        _ses().create_email_identity(EmailIdentity=current_user.email)
    except HTTPException:
        raise
    except Exception as e:
        if _error_code(e) == "AlreadyExistsException":  # 동시에 두 번 눌린 경우
            return EmailStatusResponse(email=masked, status="pending")
        logger.error("SES verify failed: user_id=%s error=%s code=%s", current_user.id, type(e).__name__, _error_code(e))
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE)
    response.status_code = status.HTTP_202_ACCEPTED
    return EmailStatusResponse(email=masked, status="pending")


@router.post("/monthly-email", response_model=MonthlyEmailResponse, status_code=status.HTTP_202_ACCEPTED)
def send_monthly_email(
    body: MonthlyEmailRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    _require_enabled()
    data = _collect(db, current_user, body.month)  # month 형식 오류는 여기서 422
    _reserve_slot(current_user.id)

    try:
        _send(
            to=current_user.email,
            subject=f"[가계부] {_month_label(body.month)} 명세서",
            text=render_text(data),
            html=render_html(data),
        )
    except Exception as e:  # SES 거부(샌드박스 미인증 주소 등)·권한·연결 오류
        _release_slot(current_user.id)
        code = _error_code(e)
        logger.error("SES send failed: user_id=%s error=%s code=%s", current_user.id, type(e).__name__, code)
        if code == "MessageRejected":  # 샌드박스에서 받는 주소가 인증되지 않음
            raise HTTPException(status.HTTP_409_CONFLICT, detail=NEEDS_VERIFICATION)
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, detail=UNAVAILABLE)

    return MonthlyEmailResponse(sent_to=mask_email(current_user.email))
