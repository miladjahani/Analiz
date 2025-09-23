# Deployment Instructions for Render

Your application is now ready to be deployed on the Render hosting platform. The repository contains a `render.yaml` file, which will allow Render to automatically configure and deploy your application.

## Step-by-Step Guide

1.  **Create a Render Account:**
    *   If you don't have one, sign up for a free account at [https://render.com/](https://render.com/).

2.  **Create a New Blueprint Service:**
    *   On your Render Dashboard, click the **"New +"** button and select **"Blueprint"**. A "Blueprint" is Render's way of using an "Infrastructure as Code" file like the `render.yaml` in this repository.
    *   Connect your GitHub account to Render and select this repository.

3.  **Deploy:**
    *   Render will automatically detect the `render.yaml` file in your repository.
    *   It will show you the service it's about to create (`sieve-analysis-app`).
    *   Click **"Approve"** to start the deployment.

4.  **Done!**
    *   Render will now build your application by installing the Python dependencies and starting the `gunicorn` server. This might take a few minutes for the first deployment.
    *   Once the deployment is complete, Render will provide you with a public URL (e.g., `https://sieve-analysis-app.onrender.com`). You can visit this URL to see and use your live application.

Your application will now be running with its Python backend on Render.
