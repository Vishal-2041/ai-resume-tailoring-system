@echo off
echo Installing requirements...
pip install -r requirements.txt

echo.
echo Downloading required NLTK data...
python -m nltk.downloader punkt
python -m nltk.downloader punkt_tab
python -m nltk.downloader stopwords

echo.
echo Starting the AI Resume ATS Optimizer Server...
echo The application will be available at http://localhost:8000
echo Opening browser to http://localhost:8000
start http://localhost:8000
python -m uvicorn main:app --reload
