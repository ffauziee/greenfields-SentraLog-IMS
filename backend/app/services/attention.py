def calculate_attention_score(incident: dict, age_hours: float) -> int:
    score = 0
    severity_map = {1: 10, 2: 20, 3: 30, 4: 40}
    score += severity_map.get(incident.get("severity_level"), 0)
    sla_hours = incident.get("sla_hours", 72)
    if sla_hours and age_hours > sla_hours:
        breach_ratio = min((age_hours - sla_hours) / sla_hours, 1.0)
        score += int(breach_ratio * 30)
    if age_hours <= 1:
        score += 20
    elif age_hours <= 4:
        score += 15
    elif age_hours <= 12:
        score += 10
    elif age_hours <= 24:
        score += 5
    status_name = incident.get("status_name", "")
    if status_name == "OPEN":
        score += 10
    elif status_name == "ESCALATED":
        score += 8
    elif status_name == "IN_PROGRESS":
        score += 5
    return min(score, 100)
def check_escalation(incident: dict, age_hours: float) -> bool:
    if incident.get("severity_level", 1) >= 3:
        sla_hours = incident.get("sla_hours", 24)
        if sla_hours and age_hours >= (sla_hours * 0.5):
            return True
    return False