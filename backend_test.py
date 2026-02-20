#!/usr/bin/env python3
"""
Comprehensive Backend API Test Suite for DieselExpress Fuel Delivery App
Tests all API endpoints including auth, orders, pricing, and stats
"""

import requests
import json
import sys
from datetime import datetime, timedelta
from typing import Optional, Dict, Any

class DieselExpressAPITester:
    def __init__(self, base_url: str = "https://fuel-logistics-3.preview.emergentagent.com"):
        self.base_url = base_url
        self.token: Optional[str] = None
        self.user_data: Optional[Dict[str, Any]] = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []
        
    def log_result(self, test_name: str, success: bool, response_code: int = None, error: str = None):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            
        result = {
            "test": test_name,
            "success": success,
            "response_code": response_code,
            "error": error
        }
        self.test_results.append(result)
        
        status = "✅ PASS" if success else "❌ FAIL"
        print(f"{status} | {test_name} | {response_code or 'N/A'} | {error or 'OK'}")

    def make_request(self, method: str, endpoint: str, data: Dict = None, require_auth: bool = False) -> tuple:
        """Make HTTP request with proper headers"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        
        if require_auth and self.token:
            headers['Authorization'] = f'Bearer {self.token}'
            
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
                
            try:
                response_data = response.json()
            except:
                response_data = {"message": response.text}
                
            return True, response.status_code, response_data
            
        except Exception as e:
            return False, None, {"error": str(e)}

    def test_pricing_endpoint(self):
        """Test pricing endpoint (public)"""
        success, code, data = self.make_request("GET", "pricing")
        
        if success and code == 200:
            required_fields = ["price_per_liter", "delivery_fee", "minimum_quantity", "currency"]
            has_all_fields = all(field in data for field in required_fields)
            self.log_result("GET /api/pricing", has_all_fields and code == 200, code)
            return has_all_fields
        else:
            self.log_result("GET /api/pricing", False, code, data.get("error", "API failed"))
            return False

    def test_user_registration(self):
        """Test user registration"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        test_user = {
            "email": f"test.user.{timestamp}@example.com",
            "password": "TestPassword123!",
            "user_type": "particulier",
            "full_name": "Test User",
            "phone": "0612345678",
            "address": "123 Rue de Test",
            "city": "Paris",
            "postal_code": "75001"
        }
        
        success, code, data = self.make_request("POST", "auth/register", test_user)
        
        if success and code == 200:
            if "access_token" in data and "user" in data:
                self.token = data["access_token"]
                self.user_data = data["user"]
                self.log_result("POST /api/auth/register", True, code)
                return True
            else:
                self.log_result("POST /api/auth/register", False, code, "Missing token or user data")
                return False
        else:
            self.log_result("POST /api/auth/register", False, code, data.get("detail", "Registration failed"))
            return False

    def test_user_login(self):
        """Test user login with existing user"""
        if not self.user_data:
            self.log_result("POST /api/auth/login", False, None, "No user data from registration")
            return False
            
        login_data = {
            "email": self.user_data["email"],
            "password": "TestPassword123!"
        }
        
        success, code, data = self.make_request("POST", "auth/login", login_data)
        
        if success and code == 200:
            if "access_token" in data:
                self.token = data["access_token"]
                self.log_result("POST /api/auth/login", True, code)
                return True
            else:
                self.log_result("POST /api/auth/login", False, code, "Missing token")
                return False
        else:
            self.log_result("POST /api/auth/login", False, code, data.get("detail", "Login failed"))
            return False

    def test_get_user_profile(self):
        """Test getting current user profile"""
        success, code, data = self.make_request("GET", "auth/me", require_auth=True)
        
        if success and code == 200:
            required_fields = ["id", "email", "user_type", "full_name"]
            has_required = all(field in data for field in required_fields)
            self.log_result("GET /api/auth/me", has_required, code)
            return has_required
        else:
            self.log_result("GET /api/auth/me", False, code, data.get("detail", "Profile fetch failed"))
            return False

    def test_get_stats(self):
        """Test getting user stats"""
        success, code, data = self.make_request("GET", "stats", require_auth=True)
        
        if success and code == 200:
            required_fields = ["total_orders", "total_liters", "total_spent", "orders_by_status"]
            has_required = all(field in data for field in required_fields)
            self.log_result("GET /api/stats", has_required, code)
            return has_required
        else:
            self.log_result("GET /api/stats", False, code, data.get("detail", "Stats fetch failed"))
            return False

    def test_create_order(self):
        """Test creating a new order"""
        tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
        
        order_data = {
            "quantity": 50,
            "delivery_address": "456 Rue de Livraison",
            "delivery_city": "Lyon",
            "delivery_postal_code": "69001",
            "delivery_date": tomorrow,
            "delivery_time_slot": "14:00-16:00",
            "notes": "Test order notes"
        }
        
        success, code, data = self.make_request("POST", "orders", order_data, require_auth=True)
        
        if success and code == 200:
            required_fields = ["id", "quantity", "total_price", "status", "delivery_address"]
            has_required = all(field in data for field in required_fields)
            if has_required:
                self.order_id = data["id"]
                self.log_result("POST /api/orders", True, code)
                return True
            else:
                self.log_result("POST /api/orders", False, code, "Missing required fields in response")
                return False
        else:
            self.log_result("POST /api/orders", False, code, data.get("detail", "Order creation failed"))
            return False

    def test_get_orders(self):
        """Test getting user orders list"""
        success, code, data = self.make_request("GET", "orders", require_auth=True)
        
        if success and code == 200:
            if isinstance(data, list):
                self.log_result("GET /api/orders", True, code)
                return True
            else:
                self.log_result("GET /api/orders", False, code, "Response is not a list")
                return False
        else:
            self.log_result("GET /api/orders", False, code, data.get("detail", "Orders fetch failed"))
            return False

    def test_get_single_order(self):
        """Test getting a specific order"""
        if not hasattr(self, 'order_id'):
            self.log_result("GET /api/orders/{id}", False, None, "No order ID available")
            return False
            
        success, code, data = self.make_request("GET", f"orders/{self.order_id}", require_auth=True)
        
        if success and code == 200:
            required_fields = ["id", "quantity", "total_price", "status"]
            has_required = all(field in data for field in required_fields)
            self.log_result("GET /api/orders/{id}", has_required, code)
            return has_required
        else:
            self.log_result("GET /api/orders/{id}", False, code, data.get("detail", "Single order fetch failed"))
            return False

    def test_update_order_status(self):
        """Test updating order status"""
        if not hasattr(self, 'order_id'):
            self.log_result("PUT /api/orders/{id}/status", False, None, "No order ID available")
            return False
            
        status_data = {"status": "confirmed"}
        success, code, data = self.make_request("PUT", f"orders/{self.order_id}/status", status_data, require_auth=True)
        
        if success and code == 200:
            if data.get("status") == "confirmed":
                self.log_result("PUT /api/orders/{id}/status", True, code)
                return True
            else:
                self.log_result("PUT /api/orders/{id}/status", False, code, "Status not updated correctly")
                return False
        else:
            self.log_result("PUT /api/orders/{id}/status", False, code, data.get("detail", "Status update failed"))
            return False

    def test_cancel_order(self):
        """Test canceling an order"""
        if not hasattr(self, 'order_id'):
            self.log_result("DELETE /api/orders/{id}", False, None, "No order ID available")
            return False
            
        success, code, data = self.make_request("DELETE", f"orders/{self.order_id}", require_auth=True)
        
        if success and code == 200:
            if "message" in data and "annulée" in data["message"].lower():
                self.log_result("DELETE /api/orders/{id}", True, code)
                return True
            else:
                self.log_result("DELETE /api/orders/{id}", False, code, "Unexpected response format")
                return False
        else:
            self.log_result("DELETE /api/orders/{id}", False, code, data.get("detail", "Order cancellation failed"))
            return False

    def test_auth_without_token(self):
        """Test protected endpoints without authentication"""
        # Temporarily remove token
        temp_token = self.token
        self.token = None
        
        success, code, data = self.make_request("GET", "auth/me", require_auth=True)
        
        # Restore token
        self.token = temp_token
        
        if success and code == 401:
            self.log_result("Auth protection test", True, code)
            return True
        else:
            self.log_result("Auth protection test", False, code, "Should return 401 without token")
            return False

    def run_all_tests(self):
        """Run complete test suite"""
        print("=" * 80)
        print("🧪 DIESELEXPRESS API BACKEND TESTING SUITE")
        print("=" * 80)
        print(f"Testing against: {self.base_url}")
        print("-" * 80)
        print("STATUS | TEST NAME | CODE | ERROR")
        print("-" * 80)
        
        # Test order matters - some tests depend on previous ones
        test_sequence = [
            ("Public Endpoints", [
                self.test_pricing_endpoint,
            ]),
            ("Authentication", [
                self.test_user_registration,
                self.test_user_login,
                self.test_get_user_profile,
                self.test_auth_without_token,
            ]),
            ("User Data", [
                self.test_get_stats,
            ]),
            ("Order Management", [
                self.test_create_order,
                self.test_get_orders,
                self.test_get_single_order,
                self.test_update_order_status,
                self.test_cancel_order,
            ])
        ]
        
        for category, tests in test_sequence:
            print(f"\n📋 {category}")
            print("-" * 40)
            for test in tests:
                test()
        
        print("\n" + "=" * 80)
        print("📊 TEST RESULTS SUMMARY")
        print("=" * 80)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        # Detailed failure report
        failed_tests = [r for r in self.test_results if not r["success"]]
        if failed_tests:
            print("\n❌ FAILED TESTS:")
            print("-" * 40)
            for test in failed_tests:
                print(f"  • {test['test']}: {test['error']}")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test execution"""
    tester = DieselExpressAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except Exception as e:
        print(f"\n💥 CRITICAL ERROR: {str(e)}")
        return 2

if __name__ == "__main__":
    sys.exit(main())