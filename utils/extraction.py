import PyPDF2
import io

def extract_text_from_pdf(uploaded_file):
    """
    Extracts text from an uploaded PDF file object.
    
    Args:
        uploaded_file: A file-like object (e.g., from Streamlit's file_uploader)
        
    Returns:
        str: The extracted text from all pages.
    """
    try:
        pdf_reader = PyPDF2.PdfReader(uploaded_file)
        text = ""
        for page_num in range(len(pdf_reader.pages)):
            page = pdf_reader.pages[page_num]
            extracted = page.extract_text()
            if extracted:
                text += extracted + "\n"
        return text
    except Exception as e:
        print(f"Error extracting PDF: {e}")
        return None
