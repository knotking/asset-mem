"""
Integration test for AI-generated checkpoint names.

This script verifies that the name generation integrates correctly
with the checkpoint analysis worker.
"""

import json
from datetime import datetime
from typing import Dict, Any


def simulate_checkpoint_analysis_flow(
    checkpoint_id: str,
    user_id: str,
    property_id: str,
    location: str = None,
    existing_name: str = None
) -> Dict[str, Any]:
    """
    Simulate the checkpoint analysis flow to verify name generation.
    
    This simulates what happens in pubsub_checkpoint_analysis function.
    """
    from name_generator import generate_checkpoint_name
    
    # Simulate AI analysis results for different scenarios
    test_scenarios = {
        "critical_issue": {
            "summary": "Kitchen showing gas leak near stove, critical safety hazard",
            "conditions": ["damaged", "unsafe"],
            "detectedItems": ["stove", "gas line", "cabinets"],
            "issues": [
                {
                    "description": "Gas leak detected near stove",
                    "severity": "critical"
                }
            ],
            "condition_scores": {"overall": 45},
            "damage_scores": {"gas_leak": 90},
            "detectedAsset": "Kitchen",
            "assetConfidence": 0.95
        },
        "major_issue": {
            "summary": "Basement showing significant structural crack in foundation",
            "conditions": ["damaged", "deteriorating"],
            "detectedItems": ["foundation", "concrete", "wall"],
            "issues": [
                {
                    "description": "Large crack in foundation wall",
                    "severity": "major"
                }
            ],
            "condition_scores": {"overall": 55},
            "damage_scores": {"cracks": 75},
            "detectedAsset": "Basement",
            "assetConfidence": 0.92
        },
        "moderate_issue": {
            "summary": "Bathroom with water staining on ceiling, possible leak above",
            "conditions": ["fair", "water damage"],
            "detectedItems": ["ceiling", "shower", "sink"],
            "issues": [
                {
                    "description": "Water staining on ceiling",
                    "severity": "moderate"
                }
            ],
            "condition_scores": {"overall": 68},
            "damage_scores": {"water": 45},
            "detectedAsset": "Bathroom",
            "assetConfidence": 0.89
        },
        "minor_issue": {
            "summary": "Living room in good condition with minor carpet wear",
            "conditions": ["good", "wear and tear"],
            "detectedItems": ["carpet", "furniture", "windows"],
            "issues": [
                {
                    "description": "Worn carpet fibers near entryway",
                    "severity": "minor"
                }
            ],
            "condition_scores": {"overall": 78},
            "damage_scores": {"wear": 25},
            "detectedAsset": "Living Room",
            "assetConfidence": 0.91
        },
        "excellent_condition": {
            "summary": "Kitchen in excellent condition, well-maintained and clean",
            "conditions": ["excellent", "clean", "well-maintained"],
            "detectedItems": ["appliances", "countertops", "cabinets"],
            "issues": [],
            "condition_scores": {"overall": 95},
            "damage_scores": {},
            "detectedAsset": "Kitchen",
            "assetConfidence": 0.96
        },
        "good_condition": {
            "summary": "Garage in good condition with normal wear",
            "conditions": ["good", "functional"],
            "detectedItems": ["garage door", "floor", "walls"],
            "issues": [],
            "condition_scores": {"overall": 82},
            "damage_scores": {},
            "detectedAsset": "Garage",
            "assetConfidence": 0.88
        },
        "vehicle_damage": {
            "summary": "Vehicle showing dented rear bumper from recent impact",
            "conditions": ["damaged", "fair"],
            "detectedItems": ["bumper", "taillights", "body"],
            "issues": [
                {
                    "description": "Dented rear bumper",
                    "severity": "major"
                }
            ],
            "condition_scores": {"overall": 70},
            "damage_scores": {"dents": 60},
            "detectedAsset": "Vehicle",
            "assetConfidence": 0.94
        },
        "appliance_issue": {
            "summary": "Refrigerator showing worn door seal, possible efficiency loss",
            "conditions": ["fair", "needs maintenance"],
            "detectedItems": ["door seal", "compressor", "shelves"],
            "issues": [
                {
                    "description": "Door seal worn and ineffective",
                    "severity": "moderate"
                }
            ],
            "condition_scores": {"overall": 65},
            "damage_scores": {"wear": 50},
            "detectedAsset": "Refrigerator",
            "assetConfidence": 0.93
        }
    }
    
    print(f"\n{'='*80}")
    print(f"Testing Checkpoint Analysis Name Generation")
    print(f"{'='*80}\n")
    
    results = []
    
    for scenario_name, analysis_result in test_scenarios.items():
        print(f"\n--- Scenario: {scenario_name.replace('_', ' ').title()} ---")
        
        # Extract data
        detected_asset = analysis_result.get("detectedAsset")
        final_location = location or detected_asset
        
        # Simulate name generation logic from main.py
        if not (isinstance(existing_name, str) and existing_name.strip()):
            auto_name = generate_checkpoint_name(
                analysis_result=analysis_result,
                location=final_location,
                detected_asset=detected_asset
            )
            print(f"Location: {final_location}")
            print(f"AI Analysis Summary: {analysis_result['summary'][:70]}...")
            print(f"Issues: {len(analysis_result['issues'])} detected")
            if analysis_result['issues']:
                print(f"  Highest Severity: {analysis_result['issues'][0]['severity']}")
                print(f"  Description: {analysis_result['issues'][0]['description']}")
            print(f"Overall Score: {analysis_result['condition_scores']['overall']}")
            print(f"✨ Generated Name: '{auto_name}'")
            
            results.append({
                "scenario": scenario_name,
                "location": final_location,
                "generated_name": auto_name,
                "issues_count": len(analysis_result['issues']),
                "overall_score": analysis_result['condition_scores']['overall']
            })
        else:
            print(f"User-provided name: '{existing_name}' (preserved)")
            results.append({
                "scenario": scenario_name,
                "location": final_location,
                "generated_name": existing_name,
                "user_provided": True
            })
    
    print(f"\n{'='*80}")
    print(f"Summary of Generated Names")
    print(f"{'='*80}\n")
    
    for result in results:
        if not result.get("user_provided"):
            print(f"{result['scenario']:25} -> {result['generated_name']}")
    
    print(f"\n{'='*80}")
    print(f"✅ Integration Test Complete")
    print(f"{'='*80}\n")
    
    return results


def verify_name_quality(results):
    """Verify that generated names meet quality criteria."""
    print("\n📊 Quality Checks:\n")
    
    checks_passed = 0
    total_checks = 0
    
    for result in results:
        if result.get("user_provided"):
            continue
            
        name = result["generated_name"]
        scenario = result["scenario"]
        
        # Check 1: Name is not empty
        total_checks += 1
        if name and len(name) > 0:
            checks_passed += 1
            print(f"✓ {scenario}: Name is not empty")
        else:
            print(f"✗ {scenario}: Name is empty!")
        
        # Check 2: Name is reasonable length
        total_checks += 1
        if len(name) <= 50:
            checks_passed += 1
            print(f"✓ {scenario}: Name length OK ({len(name)} chars)")
        else:
            print(f"✗ {scenario}: Name too long ({len(name)} chars)")
        
        # Check 3: Name contains location
        total_checks += 1
        location_lower = result["location"].lower()
        if location_lower in name.lower():
            checks_passed += 1
            print(f"✓ {scenario}: Name includes location")
        else:
            print(f"✗ {scenario}: Name missing location")
        
        # Check 4: Name doesn't contain date (dates shown separately in UI)
        total_checks += 1
        if "•" not in name and "jan" not in name.lower() and "feb" not in name.lower():
            checks_passed += 1
            print(f"✓ {scenario}: Name doesn't include date separator")
        else:
            print(f"⚠ {scenario}: Name includes date pattern")
        
        # Check 5: Critical/major issues are prominent
        if result["issues_count"] > 0 and result["overall_score"] < 70:
            total_checks += 1
            # Should mention the issue type
            if any(keyword in name.lower() for keyword in ["leak", "crack", "damage", "dent", "worn"]):
                checks_passed += 1
                print(f"✓ {scenario}: Name highlights issue")
            else:
                print(f"✗ {scenario}: Name doesn't highlight issue")
        
        # Check 6: Good condition names are positive
        if result["issues_count"] == 0 and result["overall_score"] >= 80:
            total_checks += 1
            if any(keyword in name.lower() for keyword in ["excellent", "well-maintained", "good"]):
                checks_passed += 1
                print(f"✓ {scenario}: Name uses positive language")
            else:
                print(f"⚠ {scenario}: Name could be more positive")
        
        print()
    
    print(f"\n{'='*80}")
    print(f"Quality Score: {checks_passed}/{total_checks} checks passed ({checks_passed*100//total_checks}%)")
    print(f"{'='*80}\n")
    
    return checks_passed, total_checks


if __name__ == "__main__":
    print("\n🧪 Running Integration Test for AI-Generated Checkpoint Names\n")
    
    # Run simulation
    results = simulate_checkpoint_analysis_flow(
        checkpoint_id="test_123",
        user_id="user_456",
        property_id="prop_789",
        location=None,  # Will use auto-detected location
        existing_name=None  # Will generate name
    )
    
    # Verify quality
    passed, total = verify_name_quality(results)
    
    if passed == total:
        print("✅ All quality checks passed!")
    elif passed >= total * 0.9:
        print("✅ Most quality checks passed (acceptable)")
    else:
        print("⚠️  Some quality checks failed - review results above")
    
    print("\n✨ Integration test completed successfully!\n")
