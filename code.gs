/***************************************
 * CONFIG
 ***************************************/
const GEMINI_API_KEY = "AIzaSyD8CQPUpzs2x4yxeZuWY6x39TstVxMgHDo";
const BLOG_ID = "7086030372114076686";

/***************************************
 * REVIEW WEBSITES POOL
 ***************************************/
const REVIEW_SITES_POOL = [
  "IMDb","BookMyShow","Google Users","Times of India",
  "GreatAndhra","123Telugu","Filmibeat","Pinkvilla",
  "Hindustan Times","Indian Express","Cinema Express",
  "Telugu360","OTTPlay","Cinejosh","The Hindu"
];

/***************************************
 * RANDOM SITE PICKER
 ***************************************/
function getRandomSites(count) {
  return [...REVIEW_SITES_POOL]
    .sort(() => 0.5 - Math.random())
    .slice(0, count);
}

/***************************************
 * YOUTUBE EMBED
 ***************************************/
function youtubeEmbed(url) {
  if (!url) return "";

  const match =
    url.match(/v=([^&]+)/) ||
    url.match(/youtu\.be\/([^?]+)/);

  if (!match) return "";

  return `
<div style="margin:30px 0;">
<iframe width="100%" height="420"
src="https://www.youtube.com/embed/${match[1]}"
frameborder="0"
allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
allowfullscreen></iframe>
</div>`;
}

/***************************************
 * TEXT HELPERS
 ***************************************/
function toParagraphs(text, parts = 3) {
  if (!text) return "";
  const s = text.split(/(?<=\.)\s+/);
  const size = Math.ceil(s.length / parts);
  return s.reduce((a, c, i) => {
    if (i % size === 0) a.push([]);
    a[a.length - 1].push(c);
    return a;
  }, []).map(p => `<p>${p.join(" ")}</p>`).join("");
}

function toBulletList(text, max = 4) {
  if (!text) return "<ul></ul>";
  return `<ul>${
    text.split("-").slice(0, max)
      .map(i => `<li>${i.trim()}</li>`).join("")
  }</ul>`;
}

/***************************************
 * UI BLOCK
 ***************************************/
function themedBlock(no, title, body) {
  return `
<div style="background:#fff;border:1px solid #eee;
border-radius:10px;padding:20px;margin-top:20px;">
<h2 style="color:#e60012;font-size:26px;margin-top:0;">
${no}. ${title}
</h2>
${body}
</div>`;
}

/***************************************
 * TABLE HELPERS
 ***************************************/
function movieInfoTable(info) {
  return `<table style="width:100%;border-collapse:collapse;">
${Object.keys(info).map(k => `
<tr>
<td style="font-weight:bold;width:35%;">${k}</td>
<td>${info[k] || "Not Available"}</td>
</tr>`).join("")}
</table>`;
}

function prosConsTable(pros, cons) {
  return `
<table style="width:100%;border-collapse:collapse;">
<tr>
<th style="text-align:left;">Pros</th>
<th style="text-align:left;">Cons</th>
</tr>
<tr>
<td>${toBulletList(pros, 4)}</td>
<td>${toBulletList(cons, 4)}</td>
</tr>
</table>`;
}

function ratingTables(ratings, sites) {
  return `
<h3>Category-wise Ratings</h3>
<table style="width:100%;border-collapse:collapse;">
<tr><th>Category</th><th>Rating</th></tr>
${ratings.map(r =>
  `<tr><td>${r.name}</td><td>${r.value}</td></tr>`
).join("")}
</table>

<h3>Critics & Audience Ratings</h3>
<table style="width:100%;border-collapse:collapse;">
<tr><th>Source</th><th>Rating</th></tr>
${sites.map(s =>
  `<tr><td>${s.name}</td><td>${s.value}</td></tr>`
).join("")}
</table>`;
}

/***************************************
 * MAIN POST CREATOR
 ***************************************/
function createMovieReviewDraft() {

  // ⛔ daily limit
  if (!canPostToday(7)) {
    Logger.log("⛔ Daily limit reached");
    return;
  }

  // ✅ get movie + trailer from movies.gs
  const movieData = getNextMovie();
  if (!movieData) return;

  const movieName = movieData.name;
  const trailerHtml = youtubeEmbed(movieData.trailer);

  const sites = getRandomSites(5);

  const prompt = `
Return ONLY valid JSON. No markdown.

IMPORTANT:
- Minimum 1500 words
- Professional SEO movie review
- Pros & Cons must be hyphen-separated bullet points
- Neutral tone

{
 "seoTitle":"",
 "seoMeta":"",
 "movieInfo":{
   "Movie Name":"${movieName}",
   "Release Date":"",
   "Director":"",
   "Lead Cast":"",
   "Supporting Cast":"",
   "Genre":"",
   "Language":"",
   "Music / Score":"",
   "Running Time":""
 },
 "introduction":"",
 "story":"",
 "performances":"",
 "vfx":"",
 "direction":"",
 "music":"",
 "themes":[
   {"title":"","description":""},
   {"title":"","description":""},
   {"title":"","description":""}
 ],
 "pros":"- point - point - point - point",
 "cons":"- point - point - point - point",
 "ratings":[
   {"name":"Story","value":" /5"},
   {"name":"Performances","value":" /5"},
   {"name":"Direction","value":" /5"},
   {"name":"Music","value":" /5"}
 ],
 "sites":[
   {"name":"${sites[0]}","value":" /5"},
   {"name":"${sites[1]}","value":" /5"},
   {"name":"${sites[2]}","value":" /5"},
   {"name":"${sites[3]}","value":" /5"},
   {"name":"${sites[4]}","value":" /5"}
 ],
 "verdict":"",
 "faq":[
   {"q":"","a":""},
   {"q":"","a":""},
   {"q":"","a":""}
 ]
}
`;

  const res = UrlFetchApp.fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  const json = JSON.parse(
    JSON.parse(res.getContentText())
      .candidates[0].content.parts[0].text
      .replace(/```json|```/gi, "")
      .trim()
  );

  let html = `<meta name="description" content="${json.seoMeta.substring(0,150)}">`;

  html += themedBlock("Movie Info","Movie Information",movieInfoTable(json.movieInfo));
  if (trailerHtml) html += themedBlock(1,"Official Trailer",trailerHtml);
  html += themedBlock(2,"Introduction",toParagraphs(json.introduction,3));
  html += themedBlock(3,"Story (Spoiler-Free)",toParagraphs(json.story,3));
  html += themedBlock(4,"Characters & Performances",toParagraphs(json.performances,3));
  html += themedBlock(5,"Action & Visual Effects",toParagraphs(json.vfx,2));
  html += themedBlock(6,"Direction",toParagraphs(json.direction,2));
  html += themedBlock(7,"Music & Background Score",toParagraphs(json.music,2));
  html += themedBlock(8,"Themes",json.themes.map(t =>
    `<p><strong>${t.title}</strong><br>${t.description}</p>`
  ).join(""));
  html += themedBlock(9,"Pros & Cons",prosConsTable(json.pros,json.cons));
  html += themedBlock(10,"Rating Box",ratingTables(json.ratings,json.sites));
  html += themedBlock(11,"Final Verdict",toParagraphs(json.verdict,2));
  html += themedBlock(12,"FAQ",json.faq.map(f =>
    `<p><strong>${f.q}</strong><br>${f.a}</p>`
  ).join(""));

  UrlFetchApp.fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/`,
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify({
        title: json.seoTitle || `${movieName} Movie Review`,
        content: html,
        labels: ["Movie Review", json.movieInfo.Genre || "Movies"]
      })
    }
  );
}

/***************************************
 * DAILY POST LIMIT
 ***************************************/
function canPostToday(limit) {
  const props = PropertiesService.getScriptProperties();
  const today = Utilities.formatDate(new Date(), "Asia/Kolkata", "yyyy-MM-dd");

  const data = JSON.parse(props.getProperty("DAILY_POSTS") || "{}");

  if (data.date !== today) {
    data.date = today;
    data.count = 0;
  }

  if (data.count >= limit) return false;

  data.count++;
  props.setProperty("DAILY_POSTS", JSON.stringify(data));
  return true;
}
