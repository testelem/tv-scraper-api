const express = require("express");
const puppeteer = require("puppeteer");

const app = express();
const PORT = process.env.PORT || 8080;

app.get("/api/tv", async (req, res) => {
  const { date, league } = req.query; // date = "dd/mm/yyyy", league pl. "La Liga"
  
  if (!date || !league) return res.status(400).json({ error: "Missing date or league" });

  try {
    const [day, month, year] = date.split("/");
    const siteDate = `${year}.${month}.${day}`; // focimagazin format YYYY.MM.DD
    
    const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();

    await page.goto("https://focimagazin.hu/content/tv-m%C5%B1sor-%C3%A9l%C5%91-foci-tv-ben-j%C3%B6v%C5%91-h%C3%A9ten", { waitUntil: "networkidle2" });

    // Kiolvassa az összes táblázatot
    const tvData = await page.evaluate((siteDate, league) => {
      const tables = Array.from(document.querySelectorAll("table.table"));
      const matches = [];

      tables.forEach(table => {
        const dateCell = table.querySelector("tr:first-child td");
        if (!dateCell) return;

        const tableDate = dateCell.innerText.match(/\d{4}\.\d{2}\.\d{2}/);
        if (!tableDate || tableDate[0] !== siteDate) return;

        table.querySelectorAll("tr").forEach((row, i) => {
          if (i === 0) return; // skip header
          const cells = row.querySelectorAll("td");
          if (cells.length < 3) return;

          const time = cells[0].innerText.trim();
          const channel = cells[1].innerText.trim();
          const matchText = cells[2].innerText.trim();
          if (matchText.toLowerCase().includes(league.toLowerCase()) || league === "All") {
            matches.push({
              time,
              channel,
              match: matchText
            });
          }
        });
      });

      return matches;
    }, siteDate, league);

    await browser.close();

    if (!tvData || tvData.length === 0) {
      return res.json([]);
    }

    res.json(tvData);

  } catch (err) {
    console.error("Error fetching TV data:", err);
    res.status(500).json({ error: "Failed to fetch TV schedule" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
});

app.listen(PORT, () => console.log("RUNNING ON:", PORT));
