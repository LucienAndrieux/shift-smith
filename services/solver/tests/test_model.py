from collections import defaultdict
from datetime import date, timedelta

from app.model import solve
from app.schemas import SolveRequest

SHIFTS = {
    "A": [(450, 720), (780, 990)],  # 07:30-12:00 / 13:00-16:30
    "B": [(930, 1095), (1125, 1440)],  # 15:30-18:15 / 18:45-24:00
    "D": [(0, 450)],  # 00:00-07:30
}


def request(**overrides) -> SolveRequest:
    employees = [
        {
            "id": f"e{i}",
            "displayName": f"Employee {i}",
            "primarySectionId": "front-desk",
            "weeklyContractMinutes": 2250,
            "monthlyTlDays": 1,
            "requiresMonthlyWeekendOff": i < 2,
            "fixedDaysOff": [{"weekday": 1 + (i % 7)}, {"weekday": 1 + ((i + 1) % 7)}],
            "eligibility": [{"shiftTypeId": s} for s in SHIFTS],
        }
        for i in range(5)
    ]
    body = {
        "runId": "test",
        "year": 2026,
        "month": 11,
        "sections": [{"id": "front-desk", "code": "reception", "name": "Reception"}],
        "shiftTypes": [
            {
                "id": code,
                "sectionId": "front-desk",
                "code": code,
                "periods": [{"startMinute": s, "endMinute": e} for s, e in periods],
            }
            for code, periods in SHIFTS.items()
        ],
        "dayCodes": [
            {"code": "OF", "kind": "rest", "isDueDay": False, "creditsTime": False},
            {"code": "TL", "kind": "absence", "isDueDay": True, "creditsTime": False},
            {"code": "AL", "kind": "absence", "isDueDay": True, "creditsTime": True},
            {"code": "BD", "kind": "absence", "isDueDay": True, "creditsTime": True},
        ],
        "employees": employees,
        "staffingRequirements": [{"sectionId": "front-desk", "shiftTypeId": s, "minStaff": 1} for s in SHIFTS],
        "absences": [{"employeeId": "e3", "dayCode": "AL", "startDate": "2026-11-10", "endDate": "2026-11-12"}],
        "lockedAssignments": [
            {"employeeId": "e4", "date": "2026-11-20", "shiftTypeId": "A", "isLocked": True}
        ],
        "options": {"timeLimitSeconds": 20},
    }
    body.update(overrides)
    return SolveRequest.model_validate(body)


def grid(response):
    cells = defaultdict(dict)
    for a in response.assignments:
        cells[a.employee_id][date.fromisoformat(a.date)] = a.shift_type_id or a.day_code
    return cells


def test_respects_hard_rules_and_covers_reception():
    response = solve(request())
    assert response.status in ("optimal", "feasible")
    cells = grid(response)
    days = [date(2026, 11, d) for d in range(1, 31)]

    for employee, row in cells.items():
        assert len(row) == 30
        for d in days[1:]:
            prev, cur = row[d - timedelta(days=1)], row[d]
            if prev in SHIFTS and cur in SHIFTS:
                rest = 1440 + SHIFTS[cur][0][0] - SHIFTS[prev][-1][1]
                assert rest >= 660, f"{employee} {d}: {prev}->{cur}"
        streak = 0
        for d in days:
            streak = streak + 1 if row[d] in SHIFTS else 0
            assert streak <= 6
        # Full ISO weeks: exactly two OF days.
        for monday in (date(2026, 11, 2), date(2026, 11, 9), date(2026, 11, 16), date(2026, 11, 23)):
            week = [row[monday + timedelta(days=i)] for i in range(7)]
            assert week.count("OF") == 2, f"{employee} week {monday}: {week}"

    # Leave and locked cells are kept.
    assert [cells["e3"][date(2026, 11, d)] for d in (10, 11, 12)].count("AL") >= 2
    assert cells["e4"][date(2026, 11, 20)] == "A"

    # Every day has someone on A, B and D.
    for d in days:
        worked = [row[d] for row in cells.values()]
        for code in SHIFTS:
            assert code in worked, f"{d}: no {code}"


def test_reports_infeasible_when_locked_cells_break_hard_rules():
    locked = [
        {"employeeId": "e0", "date": f"2026-11-{d:02d}", "shiftTypeId": "A", "isLocked": True}
        for d in range(2, 10)  # 8 consecutive locked working days
    ]
    response = solve(request(lockedAssignments=locked, options={"timeLimitSeconds": 10}))
    assert response.status == "infeasible"
