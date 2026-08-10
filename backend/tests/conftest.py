import pytest
import asyncio
from httpx import AsyncClient
from beanie import init_beanie
from motor.motor_asyncio import AsyncIOMotorClient
from app.main import app
from app.models.user import User

@pytest.fixture(scope="session")
def asyncio_event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="session", autouse=True)
async def initialize_test_db(asyncio_event_loop):
    client = AsyncIOMotorClient("mongodb://localhost:27017")
    test_db_name = "encadrini_test_db"
    await init_beanie(database=client[test_db_name], document_models=[User])
    yield
    await client.drop_database(test_db_name)

@pytest.fixture
async def client():
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac
