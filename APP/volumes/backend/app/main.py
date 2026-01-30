from fastapi import FastAPI

app = FastAPI(title="MinuetAItor API")

@app.get("/health")
def health():
    return {"status": "ok"}