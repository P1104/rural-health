import h3
import uuid

class AnonymizerService:
    @staticmethod
    def anonymize_location(lat: float, lng: float, resolution: int = 7) -> str:
        """Converts exact GPS to an H3 hexagonal sector."""
        return h3.latlng_to_cell(lat, lng, resolution)

    @staticmethod
    def generate_case_token() -> str:
        """Generates a non-identifiable tracking token."""
        return f"SEC-{uuid.uuid4().hex[:8].upper()}"

    @staticmethod
    def strip_pii(data: dict) -> dict:
        """Removes all identifying fields for public broadcast."""
        public_fields = ['symptoms', 'zones', 'severity', 'duration', 'h3_index', 'timestamp']
        return {k: v for k, v in data.items() if k in public_fields}
