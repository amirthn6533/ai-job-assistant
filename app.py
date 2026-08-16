import os
import gradio as gr
from main import app as fastapi_app

# Create a very simple dummy Gradio block to comply with HF Gradio SDK
with gr.Blocks(title="AI Job Assistant") as demo:
    gr.Markdown("# 🤖 AI Job Assistant Backend")
    gr.Markdown("This space runs the FastAPI career assistant backend. Visit the main tab to use the UI.")

# Mount the Gradio app onto our FastAPI app.
# We serve Gradio at '/gradio', leaving the root '/' to serve our FastAPI index.html!
app = gr.mount_gradio_app(fastapi_app, demo, path="/gradio")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860, reload=False)
