import os
import subprocess
import asyncio
from app.storage.storage_service import get_storage_service

async def convert_docx_to_pdf_task(storage_key: str) -> str:
    """
    Converts uploaded DOCX file to PDF for uniform visual canvas rendering.
    Returns the converted PDF storage key.
    """
    storage = get_storage_service()
    try:
        raw_bytes = await storage.get_file_bytes(storage_key)
        # Temp paths
        temp_dir = os.path.join("storage_data", "temp_conversions")
        os.makedirs(temp_dir, exist_ok=True)
        docx_path = os.path.join(temp_dir, f"input_{os.path.basename(storage_key)}")
        
        with open(docx_path, "wb") as f:
            f.write(raw_bytes)

        pdf_key = storage_key.rsplit(".", 1)[0] + ".pdf"
        
        # Check if soffice / libreoffice is installed
        proc = await asyncio.create_subprocess_exec(
            "soffice", "--headless", "--convert-to", "pdf", "--outdir", temp_dir, docx_path,
            stdout=subprocess.PIPE, stderr=subprocess.PIPE
        )
        await proc.communicate()

        converted_pdf_path = os.path.join(temp_dir, os.path.basename(pdf_key))
        if os.path.exists(converted_pdf_path):
            with open(converted_pdf_path, "rb") as f:
                pdf_bytes = f.read()
            await storage.upload_file(pdf_bytes, pdf_key)
            return pdf_key
        else:
            # Fallback if LibreOffice is not installed in local dev environment
            return storage_key
    except Exception as e:
        print(f"DOCX conversion warning: {e}")
        return storage_key
