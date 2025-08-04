# Hubble

A simple website homepage built with FastAPI and Python, featuring a navigation bar, title, and body content.

## Features

- Clean, modern navigation bar
- Responsive design
- FastAPI backend
- Jinja2 templating
- Static file serving

## Installation

1. Install the required dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
   Create a `.env` file in the project root with your Fivetran credentials:
   ```bash
   # Fivetran Configuration
   FIVETRAN_ACCOUNT_ID=your_account_id
   FIVETRAN_API_KEY=your_api_key
   FIVETRAN_API_SECRET=your_api_secret
   FIVETRAN_BASE64_KEY=your_base64_encoded_key
   ```

## Running the Application

1. Start the FastAPI server:
```bash
python main.py
```

Or alternatively:
```bash
uvicorn main:app --reload
```

2. Open your browser and navigate to:
```
http://localhost:8000
```

## Project Structure

```
├── main.py              # FastAPI application
├── requirements.txt     # Python dependencies
├── templates/
│   └── index.html      # Main HTML template
├── static/
│   └── styles.css      # CSS styling
└── README.md           # This file
```

## Customization

- Edit `templates/index.html` to modify the HTML content
- Edit `static/styles.css` to customize the styling
- Add new routes in `main.py` for additional pages 