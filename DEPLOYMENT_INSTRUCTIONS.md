# Deployment Instructions for Render

Your application is now ready to be deployed on the Render hosting platform. The repository contains a `render.yaml` file, which will allow Render to automatically configure and deploy your application.

## Step-by-Step Guide

1.  **Create a Render Account:**
    *   If you don't have one, sign up for a free account at [https://render.com/](https://render.com/).

2.  **Create a New Blueprint Service:**
    *   On your Render Dashboard, click the **"New +"** button and select **"Blueprint"**.
    *   Connect your GitHub account to Render and select this repository.

3.  **Deploy:**
    *   Render will automatically detect the `render.yaml` file in your repository and show you the service it's about to create (`sieve-analysis-app`).
    *   Click **"Approve"** to start the deployment.

4.  **Done!**
    *   Render will now build your application. This might take a few minutes.
    *   Once the deployment is "Live", Render will provide you with a public URL (e.g., `https://sieve-analysis-app.onrender.com`). You can visit this URL to use your application.

## A Note on API Keys and Tokens (Environment Variables)

This application does **not** require any secret tokens or API keys to run.

However, if you build other applications that do (for example, to connect to a database or another API), you should **never** write them directly into your code. The best practice is to use **Environment Variables**.

On Render, you can set these securely in your service's **"Environment"** tab.

*   You would add a variable, for example, with the key `MY_API_KEY` and your secret value.
*   In your Python code, you would access it safely like this:
    ```python
    import os
    my_key = os.environ.get('MY_API_KEY')
    ```

This keeps your secrets safe and out of your source code.
