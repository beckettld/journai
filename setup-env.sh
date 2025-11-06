#!/bin/bash

# AI Mentor - Environment Setup Script
# This script creates a .env.local file with your Firebase and Gemini credentials

cat > .env.local << 'EOF'
# ============================================================
# FIREBASE CLIENT CONFIGURATION (Frontend - VITE)
# ============================================================
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id

# ============================================================
# FIREBASE ADMIN CONFIGURATION (Server-side)
# ⚠️  IMPORTANT: Get from Firebase Console > Project Settings > Service Accounts
# Click "Generate new private key" to download JSON, then extract the fields below
# The private_key field should have literal \n characters (not actual newlines)
# ============================================================
FIREBASE_PROJECT_ID=your-project
FIREBASE_PRIVATE_KEY="your-private-key-here-with-literal-backslash-n-characters"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com

# ============================================================
# LLM PROVIDER SELECTION
# Choose: 'openai' or 'gemini'
# ============================================================
LLM_PROVIDER=gemini

# ============================================================
# OPENAI API KEY (if using OpenAI)
# Get from https://platform.openai.com/api-keys
# ============================================================
OPENAI_API_KEY=sk-...

# ============================================================
# GOOGLE GEMINI API KEY (if using Gemini)
# Get from https://aistudio.google.com/app/apikey
# ============================================================
GEMINI_API_KEY=your-gemini-api-key-here
GEMINI_MODEL=gemini-2.5-flash
EOF

echo "✅ .env.local file created successfully!"
echo ""
echo "📝 NEXT STEPS:"
echo "1. Add your Firebase Admin SDK private key:"
echo "   - Go to: https://console.firebase.google.com/"
echo "   - Select your Firebase project"
echo "   - Project Settings > Service Accounts"
echo "   - Click 'Generate new private key'"
echo "   - Copy the 'private_key' value"
echo "   - Paste into FIREBASE_PRIVATE_KEY in .env.local"
echo ""
echo "2. Set FIREBASE_CLIENT_EMAIL from the same JSON file"
echo ""
echo "✨ All Firebase and Gemini credentials are ready!"
echo ""
echo "🚀 Start the dev server with: npm run dev"

