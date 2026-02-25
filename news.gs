/***************************************
 * CONFIG
 ***************************************/
const NEWS_GEMINI_KEY = "AIzaSyD8CQPUpzs2x4yxeZuWY6x39TstVxMgHDo";
// BLOG_ID must be defined ONLY ONCE in your project (config.gs / Code.gs)
// const BLOG_ID = "7086030372114076686";

/***************************************
 * MOVIE NEWS RSS FEEDS
 ***************************************/
const MOVIE_NEWS_RSS = [
  "https://news.google.com/rss/search?q=telugu+movie+news&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=telugu+movie+update&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=ott+movie+release&hl=en-IN&gl=IN&ceid=IN:en",
  "https://news.google.com/rss/search?q=upcoming+movie+announcement&hl=en-IN&gl=IN&ceid=IN:en"
];

/***************************************
 * INITIALIZE (RUN ONCE MANUALLY)
 ***************************************/
function initNewsBotOnce() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("PROCESSED_NEWS")) {
    props.setProperty("PROCESSED_NEWS", JSON.stringify([]));
  }
  if (!props.getProperty("NEWS_POST_CONTROL")) {
    props.setProperty("NEWS_POST_CONTROL", JSON.stringify({}));
  }
}

/***************************************
 * DAILY + GAP CONTROL
 * maxPerDay = 4
 * gapMinutes = 90 (1.5 hours)
 ***************************************/
function canPostNews(maxPerDay, gapMinutes) {
  const props = PropertiesService.getScriptProperties();
  const now = new Date();
  const today = Utilities.formatDate(now, "Asia/Kolkata", "yyyy-MM-dd");

  let data = JSON.parse(props.getProperty("NEWS_POST_CONTROL") || "{}");

  // Reset every day
  if (data.date !== today) {
    data = {
      date: today,
      count: 0,
      lastTime: 0
    };
  }

  // Daily limit
  if (data.count >= maxPerDay) return false;

  // Gap check
  if (data.lastTime) {
    const diffMinutes = (now.getTime() - data.lastTime) / 60000;
    if (diffMinutes < gapMinutes) return false;
  }

  // Allow posting
  data.count++;
  data.lastTime = now.getTime();
  props.setProperty("NEWS_POST_CONTROL", JSON.stringify(data));
  return true;
}

/***************************************
 * MAIN NEWS POSTER
 ***************************************/
function postLatestMovieNews() {

  // ⛔ 3–4 posts/day with ~1.5 hour gap
  if (!canPostNews(4, 90)) {
    Logger.log("News daily limit or time gap not satisfied");
    return;
  }

  const props = PropertiesService.getScriptProperties();
  const processed = JSON.parse(props.getProperty("PROCESSED_NEWS") || "[]");

  for (let feedUrl of MOVIE_NEWS_RSS) {

    const response = UrlFetchApp.fetch(feedUrl, { muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) continue;

    const xml = response.getContentText();
    const doc = XmlService.parse(xml);
    const items = doc.getRootElement()
      .getChild("channel")
      .getChildren("item");

    for (let item of items) {

      const guid = item.getChildText("guid") || item.getChildText("link");
      if (processed.includes(guid)) continue;

      const title = item.getChildText("title");
      const description = item.getChildText("description") || "";

      const articleText = generateNewsArticle(title, description);
      const htmlContent = convertTextToHTML(articleText);

      publishNewsPost(title, htmlContent);

      processed.push(guid);
      props.setProperty("PROCESSED_NEWS", JSON.stringify(processed));

      return; // ✅ ONLY ONE NEWS PER TRIGGER RUN
    }
  }
}

/***************************************
 * GEMINI NEWS REWRITER
 ***************************************/
function generateNewsArticle(title, description) {

  const prompt = `
Rewrite the following movie news in ORIGINAL, PROFESSIONAL English.

Rules:
- Do NOT copy sentences
- Film news writing style
- Add background and clarity
- 800–1000 words
- Plain text only
- No emojis
- No markdown

Headline:
"${title}"

Source summary:
"${description}"
`;

  const res = UrlFetchApp.fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=" + NEWS_GEMINI_KEY,
    {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );

  return JSON.parse(res.getContentText())
    .candidates[0].content.parts[0].text;
}

/***************************************
 * TEXT → HTML
 ***************************************/
function convertTextToHTML(text) {
  return "<p>" + text
    .split("\n\n")
    .map(p => p.trim())
    .filter(p => p.length)
    .join("</p><p>") + "</p>";
}

/***************************************
 * BLOGGER PUBLISHER
 ***************************************/
function publishNewsPost(title, htmlContent) {

  UrlFetchApp.fetch(
    `https://www.googleapis.com/blogger/v3/blogs/${BLOG_ID}/posts/?isDraft=true`,
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: "Bearer " + ScriptApp.getOAuthToken()
      },
      payload: JSON.stringify({
        title: title,
        content: htmlContent,
        labels: ["Movie News", "Latest Updates", "Telugu Cinema"]
      })
    }
  );
}
