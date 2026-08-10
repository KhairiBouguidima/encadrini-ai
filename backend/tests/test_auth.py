import pytest
from httpx import AsyncClient
from app.core.security import verify_password, get_password_hash

@pytest.mark.asyncio
async def test_password_hashing():
    raw_password = "SecretPassword123!"
    hashed = get_password_hash(raw_password)
    assert hashed != raw_password
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False

@pytest.mark.asyncio
async def test_register_and_login_flow(client: AsyncClient):
    # 1. Register User
    register_payload = {
        "email": "student@test.com",
        "password": "Password123!",
        "first_name": "John",
        "last_name": "Doe",
        "role": "STUDENT"
    }
    response = await client.post("/api/v1/auth/register", json=register_payload)
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "student@test.com"
    assert data["role"] == "STUDENT"
    assert "id" in data

    # 2. Login User
    login_payload = {
        "email": "student@test.com",
        "password": "Password123!"
    }
    login_res = await client.post("/api/v1/auth/login", json=login_payload)
    assert login_res.status_code == 200
    token_data = login_res.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data
    access_token = token_data["access_token"]

    # 3. Get /me Profile
    headers = {"Authorization": f"Bearer {access_token}"}
    me_res = await client.get("/api/v1/auth/me", headers=headers)
    assert me_res.status_code == 200
    profile = me_res.json()
    assert profile["email"] == "student@test.com"
    assert profile["first_name"] == "John"
