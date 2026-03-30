import sys
import fitz  # PyMuPDF

def read_pdf(file_path):
    print(f"\n=== File: {file_path} ===")
    try:
        doc = fitz.open(file_path)
        for i in range(len(doc)):
            page = doc[i]
            text = page.get_text()
            if text.strip():
                print(f"--- Page {i+1} ---")
                print(text)
            else:
                print(f"--- Page {i+1} : No text found (might be vector/image) ---")
                # print some dict to see if it has images
                print(f"Images: {len(page.get_images())}, Vector drawings: {len(page.get_drawings())}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    read_pdf(r"c:\Users\ccor1\OneDrive\Desktop\Marine guard project\웨어러블 디바이스 PCB 도면.pdf")
    read_pdf(r"c:\Users\ccor1\OneDrive\Desktop\Marine guard project\웨어러블 디바이스 수신기 PCB 도면.pdf")
