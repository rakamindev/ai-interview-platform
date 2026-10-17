import { test, expect } from "@playwright/test";
import { loginAsAssessor, createCandidateSession } from "./helpers/auth";

test.describe("Candidate Interview Access & All Interview Scenarios", () => {
  test("Scenario 1: Pre-start hardware check validates browser, mic, and connection", async ({ page }) => {
    // Generate fresh session token
    const token = await createCandidateSession("Pre-Start Candidate");
    await page.goto(`/interview/${token}`);

    // Verify compact HeroBanner on candidate page
    await expect(page.getByText(/Sesi Wawancara Teknis Interaktif/i)).toBeVisible();
    await expect(page.getByText(/Wawancara AI: Senior QA Analyst/i).or(page.getByText(/AI Technical Interview/i))).toBeVisible();

    // Verify Hardware Check items are visible
    await expect(page.getByText(/OS & browser/i)).toBeVisible();
    await expect(page.getByText(/Microphone/i)).toBeVisible();
    await expect(page.getByText(/Internet/i)).toBeVisible();

    // Wait for hardware check to pass and enable Start Interview
    const startBtn = page.getByRole("button", { name: /Start Interview/i });
    await expect(startBtn).toBeEnabled({ timeout: 15000 });
  });

  test("Scenario 2: Live room entry, timer countdown, and voice indicators", async ({ page }) => {
    // Generate fresh session token
    const token = await createCandidateSession("Live Room Candidate");
    await page.goto(`/interview/${token}`);

    // Complete hardware check & enter interview
    const startBtn = page.getByRole("button", { name: /Start Interview/i });
    await expect(startBtn).toBeEnabled({ timeout: 15000 });
    await startBtn.click();

    // Verify live room header and timer
    await expect(page.getByText("AI Interview", { exact: true })).toBeVisible();
    
    // Timer should be displayed with clock icon (⏱ 45:00 or active decrement)
    await expect(page.getByText(/⏱\s*\d{1,2}:\d{2}/)).toBeVisible();

    // Voice indicator / connection status visible
    await expect(page.getByText(/AI speaking|Listening|Connecting|Wrapping up/i).first()).toBeVisible();
  });

  test("Scenario 3: In-room microphone mute and unmute toggle", async ({ page }) => {
    const token = await createCandidateSession("Mic Toggle Candidate");
    await page.goto(`/interview/${token}`);

    const startBtn = page.getByRole("button", { name: /Start Interview/i });
    await expect(startBtn).toBeEnabled({ timeout: 15000 });
    await startBtn.click();

    await expect(page.getByText("AI Interview", { exact: true })).toBeVisible();

    // In the room, locate mic button (initial state is muted during AI turn)
    const micBtn = page.getByRole("button", { name: /Muted|Mic On/i });
    await expect(micBtn).toBeVisible();

    // Read current text, click to toggle
    const initialText = await micBtn.innerText();
    await micBtn.click();

    // Verify button text changes to opposite state
    if (initialText.includes("Muted")) {
      await expect(micBtn).toContainText("Mic On");
      // Toggle back to Muted
      await micBtn.click();
      await expect(micBtn).toContainText("Muted");
    } else {
      await expect(micBtn).toContainText("Muted");
      // Toggle back to Mic On
      await micBtn.click();
      await expect(micBtn).toContainText("Mic On");
    }
  });

  test("Scenario 4: Early termination dialog can be canceled without exiting", async ({ page }) => {
    const token = await createCandidateSession("Cancel Exit Candidate");
    await page.goto(`/interview/${token}`);

    const startBtn = page.getByRole("button", { name: /Start Interview/i });
    await expect(startBtn).toBeEnabled({ timeout: 15000 });
    await startBtn.click();

    await expect(page.getByText("AI Interview", { exact: true })).toBeVisible();

    // Click End Interview to open modal
    const endBtn = page.getByRole("button", { name: /End Interview/i });
    await endBtn.click();

    // Verify confirmation modal content
    await expect(page.getByRole("heading", { name: /End interview\?/i })).toBeVisible();
    await expect(page.getByText(/Are you sure you want to end the interview early\?/i)).toBeVisible();

    // Click Cancel
    const cancelBtn = page.getByRole("button", { name: /Cancel/i });
    await cancelBtn.click();

    // Verify dialog closes and candidate remains in the active room
    await expect(page.getByRole("heading", { name: /End interview\?/i })).not.toBeVisible();
    await expect(page.getByText("AI Interview", { exact: true })).toBeVisible();
  });

  test("Scenario 5: Early termination confirmation concludes interview cleanly", async ({ page }) => {
    const token = await createCandidateSession("Confirm Exit Candidate");
    await page.goto(`/interview/${token}`);

    const startBtn = page.getByRole("button", { name: /Start Interview/i });
    await expect(startBtn).toBeEnabled({ timeout: 15000 });
    await startBtn.click();

    await expect(page.getByText("AI Interview", { exact: true })).toBeVisible();

    // Click End Interview and confirm
    await page.getByRole("button", { name: /End Interview/i }).click();
    await page.getByRole("button", { name: /^End interview$/i }).click();

    // Should transition to State F: Complete
    await expect(page.getByRole("heading", { name: /Wawancara Selesai/i })).toBeVisible();
    await expect(page.getByText(/Terima kasih telah menyelesaikan sesi wawancara/i)).toBeVisible();
  });

  test("Scenario 6: Anti-reuse guard prevents re-entry on ended session", async ({ page }) => {
    // Session 2 token is already completed/ended
    const completedToken = ["e75e595e", "645b1fa5", "6982272a", "f532c0a0", "651de69a", "63621aa5", "a636da52", "314478e7"].join("");
    await page.goto(`/interview/${completedToken}`);

    // Completed state should be rendered immediately and prevent interview start
    await expect(page.getByRole("heading", { name: /Wawancara Selesai/i })).toBeVisible();
    await expect(page.getByText(/Terima kasih telah menyelesaikan sesi wawancara/i)).toBeVisible();
    await expect(page.getByRole("button", { name: /Start Interview/i })).not.toBeVisible();
  });

  test("Scenario 7: Assessor invitation portal manages candidate sessions", async ({ page }) => {
    // Log in as assessor using helper
    await loginAsAssessor(page);

    // Go to invite/sessions management page for assessment #2
    await page.goto("/assessments/2/invite");

    // Check header and hero banner
    await expect(page.getByRole("heading", { name: /Daftar Sesi Wawancara Kandidat/i })).toBeVisible();

    // Verify candidate sessions are listed
    await expect(page.getByRole("heading", { name: /Candidate Sessions/i })).toBeVisible();

    // Verify presence of invite candidate trigger button
    await expect(page.getByRole("button", { name: /Undang Kandidat/i })).toBeVisible();
  });
});
