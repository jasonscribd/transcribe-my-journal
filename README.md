# Journal Transcriber (Mistral API Version)

A web-based application for transcribing handwritten journal entries using Mistral AI's vision models. Upload PDFs or images, and the app will transcribe them into clean, readable text.

## Features

- 📄 **PDF Support**: Upload multi-page PDFs and transcribe each page
- 🖼️ **Image Support**: Upload images (JPG, PNG) for transcription
- 📝 **Text Files**: Upload or paste text files for improvement
- 🤖 **AI-Powered**: Uses Mistral's Pixtral vision models for accurate transcription
- ✏️ **Text Improvement**: Improve grammar, spelling, and readability
- 💾 **Local Storage**: All projects saved locally in your browser
- 📤 **Export**: Export transcripts as text files

## Setup

### 1. Fork This Repository

1. Navigate to the original repository on GitHub
2. Click the "Fork" button at the top-right corner
3. This creates a copy under your GitHub account

### 2. Clone Your Fork

```bash
git clone https://github.com/YOUR-USERNAME/REPOSITORY-NAME.git
cd REPOSITORY-NAME
```

### 3. Get a Mistral API Key

1. Visit [Mistral AI Console](https://console.mistral.ai/)
2. Sign up or log in
3. Navigate to your Workspace → API Keys
4. Create a new API key
5. Copy and securely store your API key

### 4. Run the Application

Since this is a client-side web application, you can run it in several ways:

**Option A: Simple HTTP Server (Python)**
```bash
python3 -m http.server 8000
```
Then open `http://localhost:8000` in your browser.

**Option B: Simple HTTP Server (Node.js)**
```bash
npx http-server -p 8000
```
Then open `http://localhost:8000` in your browser.

**Option C: VS Code Live Server**
- Install the "Live Server" extension in VS Code
- Right-click on `index.html` and select "Open with Live Server"

### 5. Configure the App

1. Open the application in your browser
2. Click the "Settings" button (⚙️) in the bottom toolbar
3. Enter your Mistral API key
4. Select a model:
   - **Pixtral Large** (Recommended): Best for vision/transcription tasks
   - **Pixtral 12B**: Alternative vision model
   - **Mistral Large**: For text-only improvement tasks
   - **Mistral Medium**: For text-only improvement tasks
5. Adjust other settings as needed
6. Click "Save"

## Usage

1. **Upload Files**: Click "Upload Pages" and select a PDF, image, or text file
2. **Paste Text**: Click "Paste Text" or press `Ctrl+V` (or `⌘+V` on Mac) to paste text directly
3. **Transcribe**: Pages will auto-transcribe when opened, or use "Transcribe All Pages" for batch processing
4. **Edit**: Transcripts are editable - make any corrections you need
5. **Improve**: Use "Improve Current Section" or "Improve Entire Document" to enhance text quality
6. **Export**: Click "Export" to download your transcripts as a text file

## API Models

This version uses **Mistral AI** instead of OpenAI:

- **Vision Models** (for image transcription):
  - `pixtral-large-latest`: Recommended for best accuracy
  - `pixtral-12b-2409`: Alternative option

- **Text Models** (for text improvement):
  - `mistral-large-latest`: Best for text tasks
  - `mistral-medium-latest`: Budget-friendly option

## Cost Optimization

- **Image Compression**: Enabled by default to reduce API costs (~30-50% savings)
- **Token Limits**: Adjust max tokens per request (500-2000) to balance cost and detail
- **Batch Processing**: Process multiple pages efficiently with progress tracking

## Technical Details

- **Pure Client-Side**: No backend server required
- **Local Storage**: Uses IndexedDB for project storage
- **No Data Sent to Servers**: Only images/text sent to Mistral API for processing
- **Modern JavaScript**: Uses ES6 modules and modern browser APIs

## Differences from OpenAI Version

- Uses Mistral AI API endpoint: `https://api.mistral.ai/v1/chat/completions`
- Default model changed to `pixtral-large-latest` (vision) and `mistral-large-latest` (text)
- All UI references updated from "OpenAI" to "Mistral"
- API key format may differ (Mistral keys don't start with "sk-")

## Troubleshooting

**"Please set your Mistral API key" error:**
- Make sure you've entered your API key in Settings
- Verify the key is correct and active in your Mistral console

**Transcription fails:**
- Check your API key has sufficient credits
- Verify the model you selected supports vision (use Pixtral models for images)
- Check browser console for detailed error messages

**Images not loading:**
- Ensure you're using a modern browser (Chrome, Firefox, Safari, Edge)
- Check that PDF.js library files are present in `libs/pdfjs/`

## License

[Add your license here]

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## Credits

Original version designed for OpenAI API. Adapted for Mistral AI by [Your Name].

