from typing import Optional

from ..core.constants import STATUS_ACTIVE, STATUS_ARCHIVED, STATUS_UNASSIGNED


class IncidentFilter:
    def __init__(self):
        self.conditions = ["i.is_deleted = FALSE"]
        self.params = []

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

    def build(self):
        return " AND ".join(self.conditions), tuple(self.params)
