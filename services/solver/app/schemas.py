"""Request/response models of POST /solve (see services/solver/README.md).

Field names are camelCase on the wire, snake_case in Python.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class Model(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Section(Model):
    id: str
    code: str
    name: str
    sort_order: int = 0


class Period(Model):
    start_minute: int
    end_minute: int
    unpaid_break_minutes: int = 0


class ShiftType(Model):
    id: str
    section_id: str
    code: str
    is_active: bool = True
    periods: list[Period]


class DayCode(Model):
    code: str
    label: str = ""
    kind: Literal["rest", "absence", "other"]
    is_due_day: bool = True
    credits_time: bool = False


class FixedDayOff(Model):
    weekday: int


class Eligibility(Model):
    shift_type_id: str
    preference: Literal["preferred", "normal", "rare"] = "normal"
    max_per_week: int | None = None
    exact_per_week: int | None = None


class Employee(Model):
    id: str
    display_name: str
    primary_section_id: str
    status: Literal["active", "inactive"] = "active"
    weekly_contract_minutes: int
    monthly_tl_days: int = 0
    requires_monthly_weekend_off: bool = False
    birthday_month: int | None = None
    birthday_day: int | None = None
    hired_on: str | None = None
    left_on: str | None = None
    fixed_days_off: list[FixedDayOff] = Field(default_factory=list)
    eligibility: list[Eligibility] = Field(default_factory=list)


class Relation(Model):
    employee_a_id: str
    employee_b_id: str
    type: Literal["same_days_off", "different_weekend_off"]


class Absence(Model):
    employee_id: str
    day_code: str
    start_date: str
    end_date: str


class Unavailability(Model):
    employee_id: str
    date: str
    start_minute: int | None = None
    end_minute: int | None = None
    reason: str | None = None


class Holiday(Model):
    date: str
    name: str = ""


class StaffingRequirement(Model):
    section_id: str
    shift_type_id: str | None = None
    weekday: int | None = None
    min_staff: int = 0
    max_staff: int | None = None
    valid_from: str | None = None
    valid_to: str | None = None


class StaffingOverride(Model):
    section_id: str
    shift_type_id: str | None = None
    date: str
    min_staff: int = 0
    max_staff: int | None = None
    reason: str | None = None


class Rule(Model):
    code: str
    scope: Literal["global", "section", "employee"]
    section_id: str | None = None
    employee_id: str | None = None
    value: Any = None
    is_hard: bool = True
    is_active: bool = True


class Assignment(Model):
    employee_id: str
    date: str
    shift_type_id: str | None = None
    day_code: str | None = None
    is_locked: bool = False


class Balance(Model):
    employee_id: str
    balance_minutes: int


class Weights(Model):
    staffing_short: int = 1000
    staffing_over: int = 200
    weekend_off: int = 800
    same_days_off: int = 600
    different_weekend_off: int = 600
    exact_per_week: int = 400
    tl_days: int = 60
    fixed_day_off_moved: int = 20
    hour_bank_per_half_hour: int = 4
    normal_shift: int = 1
    rare_shift: int = 8


class Options(Model):
    time_limit_seconds: float = 30
    weights: Weights = Field(default_factory=Weights)


class SolveRequest(Model):
    run_id: str
    year: int
    month: int
    sections: list[Section]
    shift_types: list[ShiftType]
    day_codes: list[DayCode]
    employees: list[Employee]
    relations: list[Relation] = Field(default_factory=list)
    absences: list[Absence] = Field(default_factory=list)
    unavailabilities: list[Unavailability] = Field(default_factory=list)
    holidays: list[Holiday] = Field(default_factory=list)
    staffing_requirements: list[StaffingRequirement] = Field(default_factory=list)
    staffing_overrides: list[StaffingOverride] = Field(default_factory=list)
    rules: list[Rule] = Field(default_factory=list)
    locked_assignments: list[Assignment] = Field(default_factory=list)
    previous_assignments: list[Assignment] = Field(default_factory=list)
    hour_bank_balances: list[Balance] = Field(default_factory=list)
    options: Options = Field(default_factory=Options)


class Stats(Model):
    wall_time_seconds: float
    conflicts: int
    branches: int


class SolveResponse(Model):
    run_id: str
    status: Literal["optimal", "feasible", "infeasible"]
    assignments: list[Assignment] = Field(default_factory=list)
    objective: float | None = None
    stats: Stats | None = None
    infeasibility: list[dict[str, Any]] = Field(default_factory=list)
