const express = require("express");
const { connect } = require("puppeteer-real-browser");

const app = express();
const PORT = process.env.PORT || 3000;

const CACHE = {};
const TTL = 5 * 60 * 1000;

// --- dátum ---
function formatDate(dateStr){
  if(!dateStr || !dateStr.includes("/")) return null;
  const [dd, mm, yyyy] = dateStr.split("/");
  return `${yyyy}.${mm}.${dd}`;
}

// --- scraper ---
async function scrape(dateStr, league){

  const targetDate = formatDate(dateStr);
  if(!targetDate) return [];

  const { browser, page } = await connect({
    headless: true,
    turnstile: true,
    args: ["--no-sandbox"]
  });

  const urls = [
    "https://focimagazin.hu/content/tv-műsor-élő-foci-tv-ben",
    "https://focimagazin.hu/content/tv-műsor-élő-foci-tv-ben-jövő-héten"
  ];

  let results = [];

  for(const url of urls){

    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    await page.waitForSelector("table");

    const data = await page.evaluate((targetDate, league) => {

      const clean = t => t.replace(/\s+/g, " ").trim();
      let output = [];
      let currentDate = "";

      document.querySelectorAll("table tr").forEach(row => {

        const tds = row.querySelectorAll("td");

        if(tds.length === 1 && tds[0].colSpan === 3){
          currentDate = clean(tds[0].innerText.split(",")[0]);
        }

        if(tds.length === 3 && currentDate === targetDate){

          const time = clean(tds[0].innerText);
          const channel = clean(tds[1].innerText);
          const match = clean(tds[2].innerText);

          if(
            league === "All" ||
            match.toLowerCase().includes(league.toLowerCase())
          ){
            output.push({ time, channel, match });
          }
        }

      });

      return output;

    }, targetDate, league);

    results = results.concat(data);
  }

  await browser.close();
  return results;
}

// --- API ---
app.get("/api/tv", async (req, res) => {

  const date = req.query.date;
  const league = req.query.league || "All";

  if(!date) return res.json([]);

  const key = date + "_" + league;

  if(CACHE[key] && Date.now() - CACHE[key].time < TTL){
    return res.json(CACHE[key].data);
  }

  try{
    const data = await scrape(date, league);

    CACHE[key] = {
      time: Date.now(),
      data: data
    };

    res.json(data);

  }catch(e){
    console.error(e);
    res.json([]);
  }

});

app.listen(PORT, () => console.log("RUNNING ON:", PORT));
