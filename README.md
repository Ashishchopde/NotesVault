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

## Production Deployment (Render)

To deploy on [Render](https://render.com):

1. Push your code to a GitHub repository.
2. Create a new Web Service on Render and connect your repository.
3. Set the following environment variables in the Render dashboard:
   - `MONGODB_URI` (your production MongoDB connection string)
   - `PORT` (usually set to 10000 or leave blank for Render to auto-assign)
   - `ADMIN_PASSWORD` (choose a strong admin password)
4. Set the Start Command to:
   ```bash
   node app.js
   ```
5. (Optional) Set the build command to:
   ```bash
   npm install
   ```
6. Make sure your MongoDB instance is accessible from Render (use a cloud provider like MongoDB Atlas).
7. (Optional) Set up a custom domain and HTTPS in Render settings.

## Security Note

Make sure to:
- Never commit the `.env` file
- Use strong passwords
- Keep your MongoDB credentials secure 