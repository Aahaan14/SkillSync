import pytest
from httpx import AsyncClient

pytestmark = pytest.mark.asyncio

async def test_register_user(client: AsyncClient):
    """Test successful user registration."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "SecurePassword123",
            "full_name": "New User"
        }
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert data["role"] == "user"
    assert "password" not in data
    assert "password_hash" not in data
    assert data.get("access_token")
    
    # Check if cookies were set
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


async def test_register_duplicate_email(client: AsyncClient, test_user):
    """Test registration with an already existing email."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "test@example.com",  # Email of the test_user
            "password": "SecurePassword123",
            "full_name": "Duplicate User"
        }
    )
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


async def test_register_weak_password(client: AsyncClient):
    """Test registration with a weak password."""
    response = await client.post(
        "/api/auth/register",
        json={
            "email": "weak@example.com",
            "password": "weak",  # No numbers, no uppercase, too short
            "full_name": "Weak Password User"
        }
    )
    assert response.status_code == 422


async def test_login_success(client: AsyncClient, test_user):
    """Test successful login."""
    response = await client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "Password123"
        }
    )
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "test@example.com"
    
    assert "access_token" in response.cookies
    assert "refresh_token" in response.cookies


async def test_login_invalid_password(client: AsyncClient, test_user):
    """Test login with wrong password."""
    response = await client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "WrongPassword123"
        }
    )
    assert response.status_code == 401
    assert "Invalid email or password" in response.json()["detail"]


async def test_get_current_user_unauthorized(client: AsyncClient):
    """Test accessing protected route without a token."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


async def test_get_current_user_authorized(client: AsyncClient, test_user):
    """Test accessing protected route with valid login cookies."""
    # First login to get cookies
    await client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "Password123"
        }
    )
    
    # Then access protected route (client automatically sends cookies)
    response = await client.get("/api/auth/me")
    assert response.status_code == 200
    assert response.json()["email"] == "test@example.com"


async def test_logout(client: AsyncClient, test_user):
    """Test logout clears cookies."""
    # Login
    await client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "Password123"
        }
    )
    
    # Logout
    response = await client.post("/api/auth/logout")
    assert response.status_code == 200
    
    # The client's cookies should be cleared (specifically empty strings or expired)
    # Different test clients handle deleted cookies differently, but accessing a protected route should fail
    response = await client.get("/api/auth/me")
    assert response.status_code == 401


async def test_admin_route_forbidden_for_user(client: AsyncClient, test_user):
    """Test that a regular user cannot access admin routes."""
    await client.post(
        "/api/auth/login",
        json={
            "email": "test@example.com",
            "password": "Password123"
        }
    )
    
    response = await client.get("/api/admin/stats")
    assert response.status_code == 403
    assert "Admin access required" in response.json()["detail"]


async def test_admin_route_success(client: AsyncClient, admin_user):
    """Test that an admin user can access admin routes."""
    await client.post(
        "/api/auth/login",
        json={
            "email": "admin@example.com",
            "password": "AdminPass123"
        }
    )
    
    response = await client.get("/api/admin/stats")
    assert response.status_code == 200
    assert "total_users" in response.json()
