import os
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Fivetran Configuration
FIVETRAN_ACCOUNT_ID = os.getenv('FIVETRAN_ACCOUNT_ID', 'trustful_stencil')
FIVETRAN_API_KEY = os.getenv('FIVETRAN_API_KEY', '0EWLgaNodvL5aPOx')
FIVETRAN_API_SECRET = os.getenv('FIVETRAN_API_SECRET', 'K5tgCKzq2GRzUK6twRNlYCrwoULLuLq7')
FIVETRAN_BASE64_KEY = os.getenv('FIVETRAN_BASE64_KEY', 'MEVXTGdhTm9kdkw1YVBPeDpLNXRnQ0t6cTJHUnpVSzZ0d1JObFlDcndvVUxMdUxxNw==')

# Available connectors configuration
AVAILABLE_CONNECTORS = {
    'facebook_ads': {
        'name': 'Facebook Ads',
        'connector_id': 'facebook_ads',
        'description': 'Connect your Facebook Ads account to sync campaign data, ad performance metrics, and audience insights.',
        'icon': 'fab fa-facebook',
        'color': '#1877f2'
    }
} 