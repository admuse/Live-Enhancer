# LiveEnhancer: Testing Guide

Welcome to **LiveEnhancer**, your AI-powered photo editing assistant. This guide will walk you through the key features and how to test them effectively.

## 🚀 Quick Start

1. **Open the App**: Navigate to the [LiveEnhancer URL](https://ais-dev-cnot3hgygpo4ifnpq6ye3b-541314118209.asia-southeast1.run.app).
2. **Permissions**: Ensure you grant **Microphone** access when prompted. This is required for the Gemini Live voice features.
3. **Upload an Image**: Click the "Upload Image" area or drag and drop a JPG/PNG file to begin.

---

## 🧪 Testing Scenarios

### 1. Magic Auto-Fix (The "One-Tap" Wonder)
*   **Goal**: Test Gemini's ability to analyze and repair a photo automatically.
*   **Action**: Click the vibrant **"Magic Auto-Fix"** button at the top of the sidebar.
*   **Expectation**: The AI should analyze the image and apply enhancements to lighting, color balance, and clarity.

### 2. Artistic Styles (Van Gogh & More)
*   **Goal**: Test the creative transformation capabilities.
*   **Action**: 
    1. Select the **"Artistic"** tab in the sidebar.
    2. Click the **"Van Gogh"** button.
*   **Expectation**: Your photo should transform into a post-impressionist masterpiece with swirling brushstrokes. Try other styles like "Cyberpunk" or "Sketch" as well.

### 3. Gemini Live (Voice-Guided Editing)
*   **Goal**: Experience real-time, conversational photo editing.
*   **Action**:
    1. Click the **"Start Live Session"** button.
    2. Once the status shows "LIVE", speak to the assistant.
    3. Try commands like:
        *   *"Gemini, make this photo look like a vintage 70s film."*
        *   *"Can you brighten the shadows and make it more vibrant?"*
        *   *"Replace the background with a snowy mountain landscape."*
*   **Expectation**: Gemini should respond via voice and apply the requested edits to the image preview.

### 4. Background Replacement
*   **Goal**: Test AI segmentation and background generation.
*   **Action**:
    1. Go to the **"Backgrounds"** tab.
    2. Select **"Studio"**, **"Nature"**, or **"Office"**.
*   **Expectation**: The subject should remain intact while the background is replaced with a high-quality AI-generated scene.

### 5. Comparison & Upscaling
*   **Goal**: Verify the quality of the final output.
*   **Action**:
    1. Use the **Comparison Slider** (the vertical line on the image) to swipe between "Before" and "After".
    2. Click the **"4x Upscale"** button.
*   **Expectation**: The comparison should clearly show the AI's work. Upscaling should increase the resolution and sharpness of the final image.

---

## 🛠 Troubleshooting

*   **Microphone Not Working**: Check your browser settings to ensure the site has permission to access your mic. Refresh the page after granting permission.
*   **Processing Takes Too Long**: Ensure you have a stable internet connection. Large images may take a few seconds to process via the Gemini API.
*   **"Missing API Key" Error**: Ensure the `GEMINI_API_KEY` is correctly set in the environment variables.

---

## 📝 Feedback
If you encounter any bugs or have suggestions for new artistic styles, please let me know!
