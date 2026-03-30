import fitz
import os

def pdf_to_png(pdf_path, output_dir):
    doc = fitz.open(pdf_path)
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    for i in range(len(doc)):
        page = doc[i]
        pix = page.get_pixmap(dpi=300)
        out_path = os.path.join(output_dir, f"{base_name}_page_{i+1}.png")
        pix.save(out_path)
        print(f"Saved: {out_path}")

if __name__ == "__main__":
    out_dir = r"c:\Users\ccor1\OneDrive\Desktop\Marine guard project\web\public"
    pdf_to_png(r"c:\Users\ccor1\OneDrive\Desktop\Marine guard project\웨어러블 디바이스 PCB 도면.pdf", out_dir)
    pdf_to_png(r"c:\Users\ccor1\OneDrive\Desktop\Marine guard project\웨어러블 디바이스 수신기 PCB 도면.pdf", out_dir)
