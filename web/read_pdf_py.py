import sys
from PyPDF2 import PdfReader

def read_pdf(file_path):
    print(f"\n=== File: {file_path} ===")
    try:
        reader = PdfReader(file_path)
        for i, page in enumerate(reader.pages):
            print(f"--- Page {i+1} ---")
            print(page.extract_text())
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    read_pdf(r"c:\Users\ccor1\OneDrive\Desktop\Marine guard project\웨어러블 디바이스 PCB 도면.pdf")
    read_pdf(r"c:\Users\ccor1\OneDrive\Desktop\Marine guard project\웨어러블 디바이스 수신기 PCB 도면.pdf")
