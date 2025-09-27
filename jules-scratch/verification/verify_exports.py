import os
from playwright.sync_api import sync_playwright, expect
import time

def run_verification(playwright):
    browser = playwright.chromium.launch(headless=True)
    # This allows accepting downloads
    context = browser.new_context(accept_downloads=True)
    page = context.new_page()

    try:
        # Get the absolute path to the index.html file
        file_path = "file://" + os.path.abspath("index.html")
        page.goto(file_path)

        # 1. Fill in some data to avoid calculation errors
        weight_inputs = page.locator(".retained-weight")
        # Fill first 5 input fields with sample data
        for i in range(min(5, weight_inputs.count())):
            weight_inputs.nth(i).fill("100")

        # 2. Click the calculate button to enable the export buttons
        calculate_button = page.locator("#calculate")
        expect(calculate_button).to_be_enabled()
        calculate_button.click()

        # Wait for results to be visible, ensuring calculations are done
        expect(page.locator("#results")).to_be_visible(timeout=10000)
        print("Calculation successful, results are visible.")

        # 3. Verify PDF Export
        with page.expect_download() as download_info_pdf:
            page.locator("#export-pdf").click()
        download_pdf = download_info_pdf.value
        print(f"PDF download started: {download_pdf.suggested_filename}")

        # 4. Verify Word Export
        page.locator("#export-word").click()
        expect(page.locator("#word-export-modal")).to_be_visible()
        with page.expect_download() as download_info_word:
            page.locator("#confirm-word-export").click()
        download_word = download_info_word.value
        print(f"Word download started: {download_word.suggested_filename}")
        expect(page.locator("#word-export-modal")).to_be_hidden()

        # 5. Verify Excel Export
        with page.expect_download() as download_info_excel:
            page.locator("#export-excel").click()
        download_excel = download_info_excel.value
        print(f"Excel download started: {download_excel.suggested_filename}")

        # 6. Take a screenshot to confirm the UI is stable
        page.screenshot(path="jules-scratch/verification/verification.png")
        print("Screenshot taken. Verification complete.")

    finally:
        # It's important to close the browser context to save the downloaded files
        context.close()
        browser.close()

with sync_playwright() as playwright:
    run_verification(playwright)