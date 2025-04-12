# NotesVault

A web application for managing and viewing documents (DOCX and PDF files).

## Features

- Upload and manage documents
- View DOCX files in browser
- View PDF files in browser
- Admin dashboard for document management

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file based on `.env.example`:
   ```bash
   cp .env.example .env
   ```
4. Update the `.env` file with your MongoDB credentials and other settings
5. Start the server:
   ```bash
   node app.js
   ```

## Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `PORT`: Server port (default: 4000)
- `ADMIN_PASSWORD`: Password for admin access

## Security Note

Make sure to:
- Never commit the `.env` file
- Use strong passwords
- Keep your MongoDB credentials secure 