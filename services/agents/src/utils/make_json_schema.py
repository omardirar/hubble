#!/usr/bin/env python3
"""Generate stable JSON Schema artifact for v1.3+ response schema

This script generates the JSON Schema for the FinalResponse model and saves it
as a checked-in artifact for downstream services to use for validation.
"""

import json
import sys
from pathlib import Path

from ..models.response_schema import FinalResponse


def generate_json_schema() -> Path:
    """Generate JSON Schema for FinalResponse model"""
    try:
        # Generate the schema
        schema = FinalResponse.model_json_schema()

        # Create schema directory if it doesn't exist
        schema_dir = Path(__file__).parent.parent / "schema"
        schema_dir.mkdir(exist_ok=True)

        # Write schema to file
        schema_file = schema_dir / "response_schema_v1.3.json"
        with open(schema_file, "w") as f:
            json.dump(schema, f, indent=2)

        print(f"✅ JSON Schema generated successfully: {schema_file}")
        prop_count = len(schema.get("properties", {}))
        print(f"📊 Schema contains {prop_count} top-level properties")

        # Print some key information about the schema
        print("\n📋 Schema Summary:")
        print(f"  - Title: {schema.get('title', 'N/A')}")
        print(f"  - Type: {schema.get('type', 'N/A')}")
        print(f"  - Required fields: {len(schema.get('required', []))}")

        # List the main properties
        properties = schema.get("properties", {})
        print("\n🔧 Main Properties:")
        for prop_name, prop_info in properties.items():
            prop_type = prop_info.get("type", "unknown")
            print(f"  - {prop_name}: {prop_type}")

        return schema_file

    except Exception as e:
        print(f"❌ Error generating JSON Schema: {e}")
        sys.exit(1)


def validate_schema() -> bool:
    """Validate that the generated schema is valid JSON Schema"""
    try:
        schema_file = (
            Path(__file__).parent.parent / "schema" / "response_schema_v1.3.json"
        )

        if not schema_file.exists():
            print(f"❌ Schema file not found: {schema_file}")
            return False

        # Load and validate JSON
        with open(schema_file) as f:
            schema = json.load(f)

        # Basic validation
        required_fields = ["title", "type", "properties"]
        for field in required_fields:
            if field not in schema:
                print(f"❌ Missing required field: {field}")
                return False

        print("✅ Schema validation passed")
        return True

    except Exception as e:
        print(f"❌ Schema validation failed: {e}")
        return False


def main() -> None:
    """Main function"""
    print("🚀 Generating JSON Schema for v1.3+ response format...")

    # Generate schema
    schema_file = generate_json_schema()

    # Validate schema
    if validate_schema():
        print(f"\n🎉 Success! JSON Schema is ready at: {schema_file}")
        print("\n📝 Next steps:")
        print("  1. Commit this schema file to version control")
        print("  2. Use it for API validation in downstream services")
        print("  3. Update documentation to reference this schema")
        print("  4. Add snapshot tests to detect breaking changes")
    else:
        print("\n❌ Schema generation failed validation")
        sys.exit(1)


if __name__ == "__main__":
    main()
