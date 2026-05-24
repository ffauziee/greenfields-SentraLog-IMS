from typing import Optional, Tuple

from ..core.constants import STATUS_ACTIVE, STATUS_ARCHIVED, STATUS_UNASSIGNED

SORT_COLUMNS = {
    'title': 'i.title',
    'severity': 's.level',
    'status': 'st.name',
    'reported_by': 'u.username',
    'assigned_to': 'a.username',
    'created': 'i.created_at',
}

ALLOWED_SORT = frozenset(SORT_COLUMNS.keys())
ALLOWED_ORDER = frozenset(['asc', 'desc'])


class IncidentFilter:
    def __init__(self):
        self.conditions = ["i.is_deleted = FALSE"]
        self.params = []
        self.sort_by = None
        self.sort_order = None

    def by_status_group(self, status_group: str):
        if status_group == "archived":
            self.conditions.append("i.status_id IN %s")
            self.params.append(STATUS_ARCHIVED)
        elif status_group == "unassigned":
            self.conditions.append("i.status_id IN %s AND i.assigned_to IS NULL")
            self.params.append(STATUS_UNASSIGNED)
        else:
            self.conditions.append("i.status_id IN %s")
            self.params.append(STATUS_ACTIVE)

    def by_assigned_to(self, user_id: Optional[str]):
        if user_id:
            self.conditions.append("i.assigned_to = %s")
            self.params.append(user_id)

    def by_search(self, search: Optional[str]):
        if search:
            self.conditions.append("(i.title ILIKE %s OR i.description ILIKE %s)")
            self.params.extend([f"%{search}%", f"%{search}%"])

    def by_severity(self, severity_id: Optional[int]):
        if severity_id:
            self.conditions.append("i.severity_id = %s")
            self.params.append(severity_id)

    def by_status(self, status_id: Optional[int]):
        if status_id:
            self.conditions.append("i.status_id = %s")
            self.params.append(status_id)

    def by_date_range(self, date_from: Optional[str], date_to: Optional[str]):
        if date_from:
            self.conditions.append("i.created_at >= %s::timestamp")
            self.params.append(date_from)
        if date_to:
            self.conditions.append("i.created_at <= (%s::timestamp + INTERVAL '1 day' - INTERVAL '1 second')")
            self.params.append(date_to)

    def by_sort(self, sort_by: Optional[str], sort_order: Optional[str]):
        if sort_by in ALLOWED_SORT and sort_order in ALLOWED_ORDER:
            self.sort_by = sort_by
            self.sort_order = sort_order

    def build_sort(self) -> str:
        if self.sort_by:
            col = SORT_COLUMNS[self.sort_by]
            return f"ORDER BY {col} {'ASC' if self.sort_order == 'asc' else 'DESC'}"
        return "ORDER BY s.level DESC, i.created_at DESC"

    def build(self):
        return " AND ".join(self.conditions), tuple(self.params)
