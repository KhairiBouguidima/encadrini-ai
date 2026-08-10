import os
from abc import ABC, abstractmethod
import aiofiles
from app.core.config import settings

class BaseStorageService(ABC):
    @abstractmethod
    async def upload_file(self, file_content: bytes, destination_key: str) -> str:
        pass

    @abstractmethod
    async def get_file_bytes(self, storage_key: str) -> bytes:
        pass

class LocalStorageService(BaseStorageService):
    def __init__(self, base_dir: str = "storage_data"):
        self.base_dir = base_dir
        os.makedirs(self.base_dir, exist_ok=True)

    async def upload_file(self, file_content: bytes, destination_key: str) -> str:
        full_path = os.path.join(self.base_dir, destination_key)
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        async with aiofiles.open(full_path, "wb") as f:
            await f.write(file_content)
        return destination_key

    async def get_file_bytes(self, storage_key: str) -> bytes:
        full_path = os.path.join(self.base_dir, storage_key)
        if not os.path.exists(full_path):
            raise FileNotFoundError(f"File not found: {storage_key}")
        async with aiofiles.open(full_path, "rb") as f:
            return await f.read()

def get_storage_service() -> BaseStorageService:
    # Defaults to local storage abstraction for development flexibility
    return LocalStorageService()
