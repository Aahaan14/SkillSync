import pytest
from httpx import AsyncClient

from app.core.security import create_access_token

pytestmark = pytest.mark.asyncio

@pytest.fixture
async def auth_headers(client: AsyncClient, test_user):
    """Fixture that logs in test_user and returns headers with access_token."""
    response = await client.post(
        "/api/auth/login",
        json={"email": "test@example.com", "password": "Password123"}
    )
    # The client automatically handles cookies, so we don't strictly need to return headers for cookies,
    # but we can return the cookies dict if we want to manually set them in requests.
    return response.cookies


async def test_get_profile_not_found(client: AsyncClient, auth_headers):
    """Test getting a profile when it doesn't exist yet."""
    # Since client handles cookies, we just need to make the request
    response = await client.get("/api/profile")
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


async def test_upsert_profile(client: AsyncClient, auth_headers):
    """Test creating and updating a profile."""
    # Create profile
    profile_data = {
        "name": "Test User",
        "headline": "Software Engineer",
        "about": "Passionate about code.",
        "skills": [{"name": "Python"}, {"name": "FastAPI"}]
    }
    
    response = await client.put("/api/profile", json=profile_data)
    assert response.status_code == 200
    data = response.json()
    assert data["name"] == "Test User"
    assert len(data["skills"]) == 2
    
    # Update profile
    profile_data["headline"] = "Senior Software Engineer"
    response = await client.put("/api/profile", json=profile_data)
    assert response.status_code == 200
    assert response.json()["headline"] == "Senior Software Engineer"


async def test_profile_ownership_isolation(client: AsyncClient, admin_user, test_user):
    """Profiles are selected only from the authenticated identity."""
    user_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(test_user.id)})}"}
    admin_headers = {"Authorization": f"Bearer {create_access_token({'sub': str(admin_user.id)})}"}

    response = await client.put(
        "/api/profile",
        json={"name": "User One", "headline": "Engineer"},
        headers=user_headers,
    )
    assert response.status_code == 200

    # The other user's token cannot retrieve the first user's profile.
    response = await client.get("/api/profile", headers=admin_headers)
    assert response.status_code == 404

    response = await client.put(
        "/api/profile",
        json={"name": "Admin Profile", "headline": "Admin"},
        headers=admin_headers,
    )
    assert response.status_code == 200

    response = await client.get("/api/profile", headers=admin_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "Admin Profile"

    response = await client.get("/api/profile", headers=user_headers)
    assert response.status_code == 200
    assert response.json()["name"] == "User One"


async def test_profile_validation(client: AsyncClient, auth_headers):
    """Test profile input validation and HTML sanitization."""
    profile_data = {
        "name": "<script>alert('xss')</script>Hacker",
        "profile_url": "javascript:alert(1)"
    }
    
    response = await client.put("/api/profile", json=profile_data)
    assert response.status_code == 422
    # The URL validation should fail because 'javascript:' is blocked
    
    # Let's fix the URL and check sanitization
    profile_data = {
        "name": "<script>alert('xss')</script>Hacker",
        "profile_url": "https://linkedin.com/in/hacker"
    }
    
    response = await client.put("/api/profile", json=profile_data)
    assert response.status_code == 200
    # The name should have HTML stripped
    assert response.json()["name"] == "Hacker"
