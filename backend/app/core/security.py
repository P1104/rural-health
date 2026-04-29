from app.services.anonymizer import AnonymizerService
from app.services.encryption import EncryptionService


class SecurityProtocol:
    """
    Orchestrates the 3-Layer Security Model.
    This logic is hidden from public API endpoints but enforced on every submission.
    """

    @staticmethod
    def process_submission(raw_data: dict):
        # Layer 1: Data Sanitization
        sanitized_data = {
            "pii": raw_data.get("pii"),
            "medical": {
                "zones": raw_data.get("zones"),
                "symptoms": raw_data.get("symptoms"),
                "severity": raw_data.get("severity"),
            },
            "location": raw_data.get("location"),
        }

        # Layer 2: Vaulting & Encryption
        token = AnonymizerService.generate_case_token()
        encrypted_bundle = EncryptionService.encrypt_for_vault(
            str(sanitized_data["pii"]), b"MASTER_PUBLIC_KEY"
        )

        # Layer 3: H3 Anonymized Routing
        h3_sector = AnonymizerService.anonymize_location(
            sanitized_data["location"]["lat"], sanitized_data["location"]["lng"]
        )

        return {
            "public_flare": {
                "case_id": token,
                "sector": h3_sector,
                "medical": sanitized_data["medical"],
            },
            "vault_entry": {
                "pii": encrypted_bundle,
                "location": sanitized_data["location"],
            },
        }
