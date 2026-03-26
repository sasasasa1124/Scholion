#!/usr/bin/env python3
"""
FreeCram scraper for MuleSoft Developer II exam questions.
Outputs: mulesoft_developer_ii_exam_en.csv
"""
import asyncio
import csv
import json
import re
import sys
from pathlib import Path

from playwright.async_api import async_playwright

EXAM_URL = "https://www.freecram.com/Salesforce-certification/Salesforce-MuleSoft-Developer-II-exam-questions.html"
CREDS_FILE = Path.home() / ".config" / "member-credentials" / "credentials.json"
OUTPUT_EN = Path(__file__).parent.parent / "mulesoft_developer_ii_exam_en.csv"

CSV_HEADER = ["duplicate", "#", "question", "choices", "answer", "explanation", "source"]
SOURCE = "freecram.com (EN)"


def load_credentials():
    with open(CREDS_FILE) as f:
        data = json.load(f)
    return data["freecram"]["email"], data["freecram"]["password"]


def parse_questions_from_html(page_source: str) -> list[dict]:
    """Parse question blocks from page HTML using BeautifulSoup."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(page_source, "html.parser")
    questions = []

    # Each question is in a div with class containing 'question' or similar
    # Let's find question blocks by looking for the question heading pattern
    q_divs = soup.find_all("div", class_=re.compile(r"(question|exam-question|q-block)", re.I))

    if not q_divs:
        # Fallback: try to find by structure
        q_divs = soup.select("div.question, div[id^='q'], .question-block")

    return questions


async def scrape(headed: bool = True):
    email, password = load_credentials()
    print(f"Using credentials: {email}", flush=True)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=not headed, slow_mo=100)
        context = await browser.new_context(viewport={"width": 1280, "height": 900})
        page = await context.new_page()

        # Navigate to exam page
        print("Navigating to exam page...", flush=True)
        await page.goto(EXAM_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)

        # Login
        print("Logging in...", flush=True)
        await page.goto("https://www.freecram.com/reg.php", wait_until="domcontentloaded")
        await page.wait_for_timeout(5000)

        login_link = page.locator("a:has-text('Login')").first
        await login_link.click()
        await page.wait_for_timeout(2000)

        await page.locator("#loginname").fill(email)
        await page.locator("#loginpwd").fill(password)
        await page.locator("form:has(#loginname) button[type='submit']").first.click()
        await page.wait_for_timeout(6000)

        content = await page.content()
        if "no match account" in content.lower():
            print("ERROR: Login failed - 'no match account'", flush=True)
            await browser.close()
            return []

        print("Login successful. Navigating to exam...", flush=True)
        await page.goto(EXAM_URL, wait_until="domcontentloaded")
        await page.wait_for_timeout(4000)

        # Set 100 questions per page
        try:
            await page.select_option("select", "100")
            await page.wait_for_timeout(3000)
        except Exception:
            print("Could not set 100 per page, continuing with default", flush=True)

        all_questions = []
        page_num = 1

        while True:
            print(f"Processing page {page_num}...", flush=True)

            # Click all "Show answers/explanations" buttons
            show_buttons = page.locator("button:has-text('Show answers/explanations'), input[value='Show answers/explanations']")
            btn_count = await show_buttons.count()
            print(f"  Found {btn_count} answer buttons", flush=True)

            for i in range(btn_count):
                try:
                    btn = show_buttons.nth(i)
                    await btn.scroll_into_view_if_needed()
                    await btn.click()
                    await page.wait_for_timeout(300)
                except Exception as e:
                    print(f"  Could not click button {i}: {e}", flush=True)

            await page.wait_for_timeout(1000)

            # Parse questions from current page
            html = await page.content()
            questions = parse_page_questions(html, page_num)
            print(f"  Parsed {len(questions)} questions", flush=True)
            all_questions.extend(questions)

            # Check for next page
            next_btn = page.locator("button:has-text('Next Page')").last
            is_disabled = await next_btn.get_attribute("disabled")
            is_visible = await next_btn.is_visible()

            if is_disabled is not None or not is_visible:
                print("No more pages.", flush=True)
                break

            # Check if we're at the free limit
            page_html = await page.content()
            if "FREE VERSION LIMIT REACHED" in page_html or "free version limit" in page_html.lower():
                print("Free version limit reached.", flush=True)
                break

            await next_btn.click()
            await page.wait_for_timeout(3000)
            page_num += 1

        await browser.close()
        return all_questions


def parse_page_questions(html: str, page_num: int) -> list[dict]:
    """Parse all questions from a single page's HTML."""
    from bs4 import BeautifulSoup

    soup = BeautifulSoup(html, "html.parser")

    # Find question containers
    # FreeCram uses divs with question text followed by radio inputs
    questions = []

    # Strategy: find all elements with "Question N" heading text
    q_headings = soup.find_all(string=re.compile(r'^Question\s+\d+$'))

    for heading_text in q_headings:
        heading_el = heading_text.parent
        # Walk up to find the container
        container = heading_el
        for _ in range(5):
            if container.parent:
                container = container.parent
            else:
                break

        # Try to find question text (the actual question, not just "Question N")
        q_num_match = re.search(r'Question\s+(\d+)', str(heading_text))
        q_num = int(q_num_match.group(1)) if q_num_match else 0

        # Find the question statement
        q_text = extract_question_text(container)
        choices = extract_choices(container)
        answer = extract_answer(container)
        explanation = extract_explanation(container)

        if q_text and choices:
            questions.append({
                "num": q_num,
                "question": q_text,
                "choices": choices,
                "answer": answer,
                "explanation": explanation,
            })

    return questions


def extract_question_text(container) -> str:
    """Extract the main question text from a container element."""
    from bs4 import BeautifulSoup, NavigableString

    # Look for paragraph or div with question content (not just "Question N")
    texts = []
    for el in container.find_all(["p", "div", "span", "h3", "h4", "h5"]):
        text = el.get_text(strip=True)
        if text and not re.match(r'^Question\s+\d+$', text) and len(text) > 20:
            # Skip choice labels (A., B., etc.)
            if not re.match(r'^[A-Z]\.\s', text):
                texts.append(text)
            break

    return texts[0] if texts else ""


def extract_choices(container) -> str:
    """Extract choices as 'A. text | B. text | ...'"""
    choices = []
    # Find all radio button labels
    radios = container.find_all("input", {"type": "radio"})
    for radio in radios:
        value = radio.get("value", "")
        # Get label text
        label = radio.find_next("label")
        if label:
            text = label.get_text(strip=True)
            choices.append(f"{value}. {text}")
        else:
            # Try sibling text
            parent = radio.parent
            if parent:
                text = parent.get_text(strip=True)
                if text:
                    choices.append(f"{value}. {text}")

    return " | ".join(choices)


def extract_answer(container) -> str:
    """Extract correct answer letter(s)."""
    # Look for answer div shown after clicking "Show answers"
    answer_div = container.find(class_=re.compile(r'answer|correct', re.I))
    if answer_div:
        text = answer_div.get_text(strip=True)
        # Extract just the letter
        match = re.search(r'(?:Answer|Correct)[\s:]*([A-Z](?:\s*,\s*[A-Z])*)', text, re.I)
        if match:
            return match.group(1).replace(" ", "").replace(",", "")
        # Try to find highlighted/checked radio
        match = re.search(r'^([A-Z])', text.strip())
        if match:
            return match.group(1)
    return ""


def extract_explanation(container) -> str:
    """Extract explanation text."""
    explanation_div = container.find(class_=re.compile(r'explanation|rationale|reason', re.I))
    if explanation_div:
        return explanation_div.get_text(strip=True)
    return ""


def write_csv(questions: list[dict], output_path: Path):
    """Write questions to CSV in the standard format."""
    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_HEADER)
        writer.writeheader()
        for i, q in enumerate(questions, 1):
            writer.writerow({
                "duplicate": "",
                "#": q.get("num", i),
                "question": q.get("question", ""),
                "choices": q.get("choices", ""),
                "answer": q.get("answer", ""),
                "explanation": q.get("explanation", ""),
                "source": SOURCE,
            })
    print(f"Written {len(questions)} questions to {output_path}", flush=True)


async def main():
    headed = "--headless" not in sys.argv
    questions = await scrape(headed=headed)

    if not questions:
        print("No questions scraped!", flush=True)
        return

    print(f"\nTotal questions scraped: {len(questions)}", flush=True)
    write_csv(questions, OUTPUT_EN)


if __name__ == "__main__":
    asyncio.run(main())
